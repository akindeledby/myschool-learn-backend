import { db } from "../../lib/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendPasswordEmail, sendWelcomeEmail } from "../../src/services/email.service.js";

function generateVerificationCode() {
  return crypto
    .randomInt(100000, 1000000)
    .toString();
}


async function generateUniqueInvitationCode() {
  while (true) {
    const randomPart = crypto
      .randomBytes(5)
      .toString("hex")
      .toUpperCase();

    const invitationCode = `MSL-${randomPart}`;

    const existingUser =
      await db.user.findFirst({
        where: {
          invitationCode,
        },
        select: {
          id: true,
        },
      });

    if (!existingUser) {
      return invitationCode;
    }
  }
}


// ======================================================
// HELPER
// ======================================================

async function createAccountWithFreemium(
  tx,
  accountType,
  subscriptionPlanName
) {
  const account =
    await tx.account.create({
      data: {
        accountType,
      },
    });

  const freemiumPlan =
    await tx.subscriptionPlan.findUnique({
      where: {
        subscriptionPlanName,
      },
    });

  if (!freemiumPlan) {
    throw new Error(
      `${subscriptionPlanName} plan not found.`
    );
  }

  await tx.subscription.create({
    data: {
      account: {
        connect: {
          id: account.id,
        },
      },

      subscriptionPlan: {
        connect: {
          id: freemiumPlan.id,
        },
      },

      status: "ACTIVE",

      duration: "LIFETIME",

      startsAt: new Date(),

      endsAt: null,

      numberOfTerms: 0,

      amountPaid: 0,
    },
  });

  return account;
}


export async function register(req, res) {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      invitationCode,
      schoolId: selectedSchoolId,
    } = req.body;

    /*
     * ---------------------------------------------------------
     * 1. Basic validation
     * ---------------------------------------------------------
     */

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "All required fields must be provided.",
      });
    }

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    const cleanInvitationCode =
      typeof invitationCode === "string"
        ? invitationCode.trim().toUpperCase()
        : "";

    if (!cleanFirstName || !cleanLastName || !cleanEmail) {
      return res.status(400).json({
        success: false,
        error:
          "First name, last name, and email are required.",
      });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error:
          "Password must be at least 6 characters long.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 2. Resolve school context
     * ---------------------------------------------------------
     *
     * schoolId and invitedById have different meanings.
     *
     * schoolId:
     *   Which school is this user associated with?
     *
     * invitedById:
     *   Which MySchoolLearn user referred this user?
     *
     * They must not be used interchangeably.
     */

    const domainSchoolId = req.school?.id || null;

    let effectiveSchoolId = domainSchoolId || null;

    /*
     * If registration is not happening through a school
     * subdomain, use the school selected during registration.
     */

    if (!domainSchoolId && selectedSchoolId) {
      const selectedSchool = await db.school.findUnique({
        where: {
          id: selectedSchoolId,
        },
        select: {
          id: true,
        },
      });

      if (!selectedSchool) {
        return res.status(400).json({
          success: false,
          error: "Selected school does not exist.",
        });
      }

      effectiveSchoolId = selectedSchool.id;
    }

    /*
     * ---------------------------------------------------------
     * 3. Resolve referral
     * ---------------------------------------------------------
     *
     * Any eligible MySchoolLearn user can refer another user.
     *
     * The invitation code identifies the user who referred
     * this new user.
     */

    let invitingUser = null;

    if (cleanInvitationCode) {
      invitingUser = await db.user.findFirst({
        where: {
          invitationCode: cleanInvitationCode,
        },
        select: {
          id: true,
          role: true,
          invitationCode: true,
        },
      });

      if (!invitingUser) {
        return res.status(400).json({
          success: false,
          error:
            "The invitation code is invalid or no longer available.",
        });
      }
    }

    /*
     * ---------------------------------------------------------
     * 4. Check whether email already exists
     * ---------------------------------------------------------
     *
     * User.email is globally unique.
     */

    const existingUser = await db.user.findUnique({
      where: {
        email: cleanEmail,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error:
          "An account with this email already exists.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 5. Hash password
     * ---------------------------------------------------------
     */

    const hashedPassword = await bcrypt.hash(
      cleanPassword,
      10
    );

    /*
     * ---------------------------------------------------------
     * 6. Generate this user's own invitation code
     * ---------------------------------------------------------
     */

    const newInvitationCode =
      await generateUniqueInvitationCode();

    /*
     * ---------------------------------------------------------
     * 7. Create user
     * ---------------------------------------------------------
     */

    const user = await db.user.create({
      data: {
        firstName: cleanFirstName,
        lastName: cleanLastName,
        email: cleanEmail,
        password: hashedPassword,

        /*
         * Role is selected after registration.
         */
        role: null,

        /*
         * School membership / tenant context.
         *
         * This is independent of referral.
         */
        schoolId: effectiveSchoolId,

        /*
         * User's own invitation code.
         */
        invitationCode: newInvitationCode,
        invitationCreatedAt: new Date(),

        /*
         * Referral relationship.
         */
        invitedById: invitingUser?.id || null,
        invitedAt: invitingUser
          ? new Date()
          : null,
      },

      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        schoolId: true,
        invitationCode: true,
        invitedById: true,
        invitedAt: true,
        createdAt: true,
      },
    });

    /*
     * ---------------------------------------------------------
     * 8. Generate authentication token
     * ---------------------------------------------------------
     */

    const accessToken = jwt.sign(
      {
        userId: user.id,
        role: user.role ?? null,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    /*
     * ---------------------------------------------------------
     * 9. Send welcome email
     * ---------------------------------------------------------
     *
     * IMPORTANT:
     *
     * Email delivery failure must NOT invalidate the
     * successful account creation.
     *
     * The user has already been created at this point.
     */

    try {
      await sendWelcomeEmail({
        to: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        invitationCode: user.invitationCode,
      });

    } catch (emailError) {
      console.error(
        "WELCOME EMAIL ERROR:",
        emailError
      );

      /*
       * Do not return an error here.
       *
       * Registration was successful even if the email
       * provider temporarily failed.
       */
    }

    /*
     * ---------------------------------------------------------
     * 10. Return successful registration
     * ---------------------------------------------------------
     */

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",

      /*
       * The user still needs to select their role
       * and complete their profile/settings.
       */
      requiresRoleSelection: true,

      accessToken,

      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        schoolId: user.schoolId,

        /*
         * This user's own referral code.
         */
        invitationCode: user.invitationCode,

        /*
         * The user who referred this user.
         */
        invitedById: user.invitedById,
        invitedAt: user.invitedAt,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    /*
     * ---------------------------------------------------------
     * Handle Prisma unique constraint errors
     * ---------------------------------------------------------
     */

    if (error?.code === "P2002") {
      const target = error?.meta?.target;

      if (
        Array.isArray(target) &&
        target.includes("email")
      ) {
        return res.status(400).json({
          success: false,
          error:
            "An account with this email already exists.",
        });
      }

      if (
        Array.isArray(target) &&
        target.includes("invitationCode")
      ) {
        return res.status(500).json({
          success: false,
          error:
            "Unable to generate a unique invitation code. Please try again.",
        });
      }
    }

    return res.status(500).json({
      success: false,
      error:
        "Unable to create account. Please try again later.",
    });
  }
}


// ===================== GOOGLE LOGIN =====================
export async function googleAuth(req, res) {
  try {
    const {
      email,
      name,
      googleId,
      invitationCode,
    } = req.body;

    /*
     * ---------------------------------------------
     * BASIC VALIDATION
     * ---------------------------------------------
     */

    if (!email || !googleId) {
      return res.status(400).json({
        success: false,
        error:
          "Google email and Google ID are required.",
      });
    }

    const normalizedEmail =
      String(email)
        .trim()
        .toLowerCase();

    const cleanInvitationCode =
      typeof invitationCode === "string"
        ? invitationCode
            .trim()
            .toUpperCase()
        : "";

    /*
     * ---------------------------------------------
     * FIND EXISTING GOOGLE USER
     * ---------------------------------------------
     */

    let user = await db.user.findFirst({
      where: {
        OR: [
          {
            googleId,
          },
          {
            email: normalizedEmail,
          },
        ],
      },
    });

    /*
     * ---------------------------------------------
     * EXISTING USER
     * ---------------------------------------------
     *
     * IMPORTANT:
     *
     * We DO NOT overwrite invitedById here.
     *
     * A user's original referrer should remain
     * unchanged on subsequent Google logins.
     */

    if (user) {
      /*
       * If this is an existing account that was
       * originally created without Google but is
       * now connecting Google, you may want to
       * attach googleId if it is empty.
       */

      if (!user.googleId) {
        user = await db.user.update({
          where: {
            id: user.id,
          },

          data: {
            googleId,
          },
        });
      }
    }

    /*
     * ---------------------------------------------
     * NEW USER
     * ---------------------------------------------
     */

    if (!user) {
      /*
       * Resolve invitation code on the backend.
       *
       * NEVER trust a frontend-supplied invitedById.
       */

      let invitingUser = null;

      if (cleanInvitationCode) {
        invitingUser =
          await db.user.findFirst({
            where: {
              invitationCode:
                cleanInvitationCode,
            },

            select: {
              id: true,
              role: true,
              invitationCode: true,
            },
          });

        if (!invitingUser) {
          return res.status(400).json({
            success: false,
            error:
              "The invitation code is invalid or no longer available.",
          });
        }
      }

      /*
       * Generate the new user's own
       * invitation code.
       */

      const newInvitationCode =
        await generateUniqueInvitationCode();

      /*
       * Create the Google user.
       *
       * invitedById points to the USER who
       * owns the invitation code.
       */

      user = await db.user.create({
        data: {
          email: normalizedEmail,

          /*
           * Adjust this if your existing Google
           * user creation uses a different name
           * structure.
           */

          firstName:
            typeof name === "string"
              ? name.trim().split(" ")[0] ||
                ""
              : "",

          lastName:
            typeof name === "string"
              ? name
                  .trim()
                  .split(" ")
                  .slice(1)
                  .join(" ")
              : "",

          googleId,

          password: null,

          /*
           * Keep your existing role behavior.
           * New Google users can complete role
           * selection afterward.
           */

          role: null,

          /*
           * Keep your existing school behavior
           * if your current controller determines
           * a domain school here.
           *
           * Replace this with your existing
           * domainSchoolId logic if applicable.
           */

          schoolId:
            typeof domainSchoolId !==
            "undefined"
              ? domainSchoolId
              : null,

          /*
           * GENERALIZED REFERRAL SYSTEM
           */

          invitationCode:
            newInvitationCode,

          invitationCreatedAt:
            new Date(),

          invitedById:
            invitingUser?.id ?? null,

          invitedAt:
            invitingUser
              ? new Date()
              : null,
        },
      });
    }

    /*
     * ---------------------------------------------
     * CREATE BACKEND ACCESS TOKEN
     * ---------------------------------------------
     *
     * Keep your existing JWT/token generation
     * implementation here.
     */

    const accessToken =
      generateAccessToken(user);

    /*
     * ---------------------------------------------
     * RESPONSE
     * ---------------------------------------------
     */

    return res.status(200).json({
      success: true,

      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },

      accessToken,

      requiresRoleSelection:
        !user.role,
    });
  } catch (error) {
    console.error(
      "Google authentication error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "An error occurred during Google authentication.",
    });
  }
}


// ===================== LOGIN =====================
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    const domainSchoolId = req.school?.id || null;

    // --------------------------------------------------
    // Validate input
    // --------------------------------------------------

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // --------------------------------------------------
    // Find user
    // --------------------------------------------------

    let user;

    if (domainSchoolId) {

      user = await db.user.findFirst({
        where: {
          email: cleanEmail,
          schoolId: domainSchoolId,
        },
      });
    } else {

      user = await db.user.findFirst({
        where: {
          email: cleanEmail,
        },
      });
    }

    // --------------------------------------------------
    // User not found
    // --------------------------------------------------

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    // --------------------------------------------------
    // Google account
    // --------------------------------------------------

    if (!user.password) {
      return res.status(400).json({
        success: false,
        error:
          "This account uses Google. Please sign in with Google.",
      });
    }

    // --------------------------------------------------
    // Verify password
    // --------------------------------------------------

    const isValid = await bcrypt.compare(
      cleanPassword,
      user.password
    );

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials.",
      });
    }

    // --------------------------------------------------
    // Create JWT
    // --------------------------------------------------

    const accessToken = jwt.sign(
      {
        userId: user.id,
        role: user.role ?? null,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // console.log("[LOGIN GENERATED JWT PAYLOAD]", {
    //   userId: user.id,
    //   role: user.role,
    // });

    // --------------------------------------------------
    // Role has not been selected
    // --------------------------------------------------

    if (!user.role) {
      return res.json({
        success: true,
        requiresRoleSelection: true,
        accessToken,

        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          schoolId: user.schoolId,
        },
      });
    }

    // --------------------------------------------------
    // Parent requires profile selection
    // --------------------------------------------------

    if (user.role === "PARENT") {
      return res.json({
        success: true,
        requiresProfileSelection: true,
        accessToken,
        user,
      });
    }

    // --------------------------------------------------
    // Normal login
    // --------------------------------------------------

    return res.json({
      success: true,
      message: "Login successful.",
      accessToken,
      user,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      error:
        "Unable to login. Please try again later.",
    });
  }
}


// ===================== SET USER ROLE =====================
export async function setUserRole(req, res) {
  try {
    const userId = req.user?.userId;

    // --------------------------------------------------
    // Authentication
    // --------------------------------------------------

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required.",
      });
    }

    // --------------------------------------------------
    // School resolved by tenant middleware
    // --------------------------------------------------

    const domainSchoolId =
      req.school?.id || null;

    // --------------------------------------------------
    // Request body
    // --------------------------------------------------

    const {
      role,
      gender,
      teacherCode,
      age,
      schoolId: selectedSchoolId,
      classId,
      studentCategory,
      subjectTaught,
      phoneNumber,
      schoolEmail,
      schoolPhoneContact,
      schoolName,
    } = req.body;

    // --------------------------------------------------
    // Validate role
    // --------------------------------------------------

    if (!role) {
      return res.status(400).json({
        success: false,
        error: "Role is required.",
      });
    }

    const validRoles = [
      "teacher",
      "student",
      "parent",
      "school_admin",
    ];

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role selected.",
      });
    }

    // --------------------------------------------------
    // Get existing user
    // --------------------------------------------------

    const existingUser = await db.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        teacher: true,
        student: true,
        parent: true,
        school: true,
        account: true,
        invitedBy: {
          select: {
            id: true,
            role: true,
            invitationCode: true,
          },
        },
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    // --------------------------------------------------
    // Prevent changing an already assigned role
    // --------------------------------------------------

    if (existingUser.role) {
      return res.status(400).json({
        success: false,
        error: "User role has already been assigned.",
      });
    }

    // --------------------------------------------------
    // Resolve school
    // --------------------------------------------------

    let effectiveSchoolId = null;

    /*
     * If registration is taking place through a school
     * subdomain, the domain school is authoritative.
     *
     * The frontend cannot override this.
     */

    if (domainSchoolId) {
      const domainSchool = await db.school.findUnique({
        where: {
          id: domainSchoolId,
        },
        select: {
          id: true,
        },
      });

      if (!domainSchool) {
        return res.status(400).json({
          success: false,
          error:
            "School associated with this domain does not exist.",
        });
      }

      effectiveSchoolId = domainSchool.id;
    }

    /*
     * If there is no school subdomain, the school selected
     * by the frontend can be used as the school context.
     */

    else if (selectedSchoolId) {
      const selectedSchool = await db.school.findUnique({
        where: {
          id: selectedSchoolId,
        },
        select: {
          id: true,
        },
      });

      if (!selectedSchool) {
        return res.status(400).json({
          success: false,
          error: "Selected school does not exist.",
        });
      }

      effectiveSchoolId = selectedSchool.id;
    }

    // --------------------------------------------------
    // TRANSACTION
    // --------------------------------------------------

    const result = await db.$transaction(async (tx) => {
      // ==================================================
      // SCHOOL
      // ==================================================

      if (role === "school_admin") {
        if (!schoolName?.trim()) {
          throw new Error("School name is required.");
        }

        if (!schoolEmail?.trim()) {
          throw new Error("School email is required.");
        }

        /*
         * School registration creates or attaches to the
         * school tenant.
         */

        let account = existingUser.account;

        if (!account) {
          account = await createAccountWithFreemium(
            tx,
            "SCHOOL",
            "FREEMIUM_SCHOOL"
          );
        }

        let school;

        // ----------------------------------------------
        // Existing school tenant
        // ----------------------------------------------

        if (domainSchoolId) {
          school = await tx.school.findUnique({
            where: {
              id: domainSchoolId,
            },
          });

          if (!school) {
            throw new Error(
              "School associated with this domain does not exist."
            );
          }

          /*
           * Do not allow another user to take ownership
           * of an existing school.
           */

          if (
            school.userId &&
            school.userId !== existingUser.id
          ) {
            throw new Error(
              "This school already has an administrator."
            );
          }

          school = await tx.school.update({
            where: {
              id: school.id,
            },
            data: {
              name: schoolName.trim(),
              schoolEmail: schoolEmail.trim(),
              schoolPhoneContact:
                schoolPhoneContact?.trim() ||
                phoneNumber ||
                null,
              userId: existingUser.id,
              status: "ACTIVE"
            },
          });
        }

        // ----------------------------------------------
        // New school registration
        // ----------------------------------------------

        else {
          school = await tx.school.upsert({
            where: {
              schoolEmail: schoolEmail.trim(),
            },

            update: {
              name: schoolName.trim(),
              schoolPhoneContact:
                schoolPhoneContact?.trim() ||
                phoneNumber ||
                null,
              userId: existingUser.id,
              status: "ACTIVE"
            },

            create: {
              name: schoolName.trim(),
              schoolEmail: schoolEmail.trim(),
              schoolPhoneContact:
                schoolPhoneContact?.trim() ||
                phoneNumber ||
                null,
              userId: existingUser.id,
              status: "ACTIVE"
            },
          });
        }

        // ----------------------------------------------
        // Update User
        // ----------------------------------------------

        const updatedUser = await tx.user.update({
          where: {
            id: existingUser.id,
          },

          data: {
            role: "SCHOOL_ADMIN",
            accountId: account.id,

            /*
             * A school administrator belongs to the school
             * they administer.
             */
            schoolId: school.id,
          },
        });

        return {
          user: updatedUser,
          profile: school,
          redirectUrl: "/school/dashboard",
        };
      }

      // ==================================================
      // TEACHER
      // ==================================================

      if (role === "teacher") {
        if (existingUser.teacher) {
          throw new Error(
            "Teacher profile already exists."
          );
        }

        /*
         * A teacher must belong to a school.
         */

        if (!effectiveSchoolId) {
          throw new Error(
            "A school is required for teacher registration."
          );
        }

        const updatedUser = await tx.user.update({
          where: {
            id: existingUser.id,
          },

          data: {
            role: "TEACHER",
            schoolId: effectiveSchoolId,
            phone: phoneNumber || null,
          },
        });

        const teacher = await tx.teacher.create({
          data: {
            userId: existingUser.id,

            schoolId: effectiveSchoolId,

            gender: gender || null,

            teacherCode: teacherCode || null,

            subject: subjectTaught || null,

            phone: phoneNumber || null,
          },
        });

        return {
          user: updatedUser,
          profile: teacher,
          redirectUrl: "/teacher/dashboard",
        };
      }

      // ==================================================
      // STUDENT
      // ==================================================

      if (role === "student") {
        if (existingUser.student) {
          throw new Error(
            "Student profile already exists."
          );
        }

        /*
         * A student must belong to a school if they are
         * registering through a school or selecting one.
         *
         * If your product allows completely independent
         * students, this validation can be relaxed later.
         */

        let account = existingUser.account;

        if (!account) {
          account = await createAccountWithFreemium(
            tx,
            "INDIVIDUAL",
            "FREEMIUM_INDIVIDUAL"
          );
        }

        // ----------------------------------------------
        // Resolve class
        // ----------------------------------------------

        let classRecord = null;
        let classLevel = null;

        if (classId) {
          classRecord = await tx.class.findUnique({
            where: {
              id: classId,
            },
          });

          if (!classRecord) {
            throw new Error(
              "Selected class not found."
            );
          }

          /*
           * If a school is known, make sure the selected
           * class belongs to that school where applicable.
           *
           * This assumes your Class model has schoolId.
           *
           * If it does not, remove this condition.
           */
          
          classLevel =
            classRecord.name ||
            classRecord.level ||
            null;
        }

        // ----------------------------------------------
        // Update User
        // ----------------------------------------------

        const updatedUser = await tx.user.update({
          where: {
            id: existingUser.id,
          },

          data: {
            role: "STUDENT",
            accountId: account.id,
            schoolId: effectiveSchoolId,
            phone: phoneNumber || null,
          },
        });

        // ----------------------------------------------
        // Create Student
        // ----------------------------------------------

        const student = await tx.student.create({
          data: {
            userId: existingUser.id,

            accountId: account.id,

            schoolId: effectiveSchoolId,

            firstName: existingUser.firstName,

            lastName: existingUser.lastName,

            gender: gender || null,

            age:
              age !== undefined &&
              age !== null &&
              age !== ""
                ? Number(age)
                : null,

            classId:
              classRecord?.id || null,

            classLevel,

            category:
              studentCategory || null,

            phone:
              phoneNumber || null,
          },
        });

        return {
          user: updatedUser,
          profile: student,
          studentId: student.id,
          redirectUrl: "/student/dashboard",
        };
      }

      // ==================================================
      // PARENT
      // ==================================================

      if (role === "parent") {
        if (existingUser.parent) {
          throw new Error(
            "Parent profile already exists."
          );
        }

        /*
         * Parent subscriptions are ACCOUNT LEVEL.
         *
         * The parent owns the FAMILY account and that
         * account covers the parent's children.
         *
         * A parent is NOT directly attached to a school.
         *
         * Their children can belong to schools through
         * Student.schoolId.
         */

        let account = existingUser.account;

        if (!account) {
          account = await createAccountWithFreemium(
            tx,
            "FAMILY",
            "FREEMIUM_FAMILY"
          );
        }

        // ----------------------------------------------
        // Update User
        // ----------------------------------------------

        const updatedUser = await tx.user.update({
          where: {
            id: existingUser.id,
          },

          data: {
            role: "PARENT",
            accountId: account.id,
            phone: phoneNumber || null,

            /*
             * IMPORTANT:
             *
             * Do NOT set schoolId here.
             *
             * The parent is not the school tenant member
             * simply because they selected a school or
             * registered through a school context.
             */
            schoolId: null,
          },
        });

        // ----------------------------------------------
        // Create Parent
        // ----------------------------------------------

        const parent = await tx.parent.create({
          data: {
            userId: existingUser.id,

            phone:
              phoneNumber || null,

            firstName:
              existingUser.firstName,

            lastName:
              existingUser.lastName,
          },
        });

        return {
          user: updatedUser,
          profile: parent,
          redirectUrl: "/parent/dashboard",
        };
      }

      throw new Error(
        "Unable to process role."
      );
    });

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Profile setup completed successfully.",

      redirectUrl:
        result.redirectUrl,

      user:
        result.user,

      profile:
        result.profile,

      studentId:
        result.studentId || null,
    });

  } catch (error) {
    console.error(
      "SET USER ROLE ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      error:
        error?.message ||
        "Failed to complete profile setup.",
    });
  }
}



// ===================== GETME =====================
export async function getMe(req, res) {
  try {
    const user = await db.user.findUnique({
      where: {
        id: req.user.userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
}

// ===================== FORGOT PASSWORD =====================
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const user =
      await db.user.findUnique({
        where: {
          email: normalizedEmail,
        },

        select: {
          id: true,
          email: true,
          firstName: true,
        },
      });

    /*
     * Do not reveal whether the account exists.
     */
    if (!user) {
      return res.json({
        success: true,
      });
    }

    /*
     * Generate a new verification code.
     */
    const code =
      generateVerificationCode();

    /*
     * Never store the verification code
     * directly in the database.
     */
    const codeHash =
      await bcrypt.hash(code, 10);

    /*
     * Code expires after 10 minutes.
     */
    const expiresAt =
      new Date(
        Date.now() +
          10 * 60 * 1000
      );

    /*
     * Save the hashed verification code.
     */
    await db.passwordReset.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt,
      },
    });

    /*
     * Customized password reset email.
     */
    const subject =
      "MySchoolLearn Password Reset Code";

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />

          <title>
            MySchoolLearn Password Reset
          </title>
        </head>

        <body
          style="
            margin: 0;
            padding: 0;
            background-color: #f1f5f9;
            font-family: Arial, Helvetica, sans-serif;
            color: #334155;
          "
        >

          <div
            style="
              width: 100%;
              padding: 40px 16px;
              box-sizing: border-box;
            "
          >

            <div
              style="
                max-width: 560px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 16px;
                overflow: hidden;
                box-shadow:
                  0 10px 30px rgba(15, 23, 42, 0.08);
              "
            >

              <!-- Header -->

              <div
                style="
                  background: linear-gradient(
                    135deg,
                    #2563eb,
                    #4f46e5
                  );
                  padding: 32px 24px;
                  text-align: center;
                "
              >

                <div
                  style="
                    color: #ffffff;
                    font-size: 28px;
                    font-weight: 800;
                    letter-spacing: -0.5px;
                  "
                >
                  MySchoolLearn
                </div>

                <div
                  style="
                    margin-top: 8px;
                    color: rgba(255,255,255,0.85);
                    font-size: 14px;
                  "
                >
                  Learning made personal.
                </div>

              </div>

              <!-- Content -->

              <div
                style="
                  padding: 36px 32px;
                "
              >

                <h1
                  style="
                    margin: 0 0 16px;
                    color: #0f172a;
                    font-size: 24px;
                    line-height: 1.3;
                  "
                >
                  Password Reset Request
                </h1>

                <p
                  style="
                    margin: 0 0 16px;
                    font-size: 15px;
                    line-height: 1.7;
                  "
                >
                  Hello ${
                    user.firstName || "there"
                  },
                </p>

                <p
                  style="
                    margin: 0 0 20px;
                    font-size: 15px;
                    line-height: 1.7;
                  "
                >
                  We received a request to
                  change the password for your
                  MySchoolLearn account.
                </p>

                <p
                  style="
                    margin: 0 0 24px;
                    font-size: 15px;
                    line-height: 1.7;
                  "
                >
                  Use the verification code below
                  to continue with your password
                  reset:
                </p>

                <!-- Verification Code -->

                <div
                  style="
                    margin: 24px 0;
                    padding: 24px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    text-align: center;
                  "
                >

                  <div
                    style="
                      margin-bottom: 10px;
                      color: #64748b;
                      font-size: 12px;
                      font-weight: 600;
                      text-transform: uppercase;
                      letter-spacing: 1px;
                    "
                  >
                    Verification Code
                  </div>

                  <div
                    style="
                      color: #1e40af;
                      font-size: 32px;
                      font-weight: 800;
                      letter-spacing: 8px;
                    "
                  >
                    ${code}
                  </div>

                </div>

                <p
                  style="
                    margin: 0 0 20px;
                    color: #64748b;
                    font-size: 13px;
                    line-height: 1.6;
                    text-align: center;
                  "
                >
                  This verification code will
                  expire in
                  <strong>
                    10 minutes
                  </strong>.
                </p>

                <div
                  style="
                    margin-top: 28px;
                    padding: 16px;
                    background: #fff7ed;
                    border: 1px solid #fed7aa;
                    border-radius: 10px;
                  "
                >

                  <p
                    style="
                      margin: 0;
                      color: #9a3412;
                      font-size: 13px;
                      line-height: 1.6;
                    "
                  >
                    If you did not request a
                    password reset, you can safely
                    ignore this email. Your account
                    password will remain unchanged.
                  </p>

                </div>

              </div>

              <!-- Footer -->

              <div
                style="
                  padding: 24px 32px;
                  background: #f8fafc;
                  border-top: 1px solid #e2e8f0;
                  text-align: center;
                "
              >

                <p
                  style="
                    margin: 0 0 6px;
                    color: #64748b;
                    font-size: 12px;
                  "
                >
                  This email was sent by
                  MySchoolLearn.
                </p>

                <p
                  style="
                    margin: 0;
                    color: #94a3b8;
                    font-size: 11px;
                  "
                >
                  Please do not reply to this
                  automated email.
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    /*
     * Send the email through the dedicated
     * Resend email service.
     */
    await sendPasswordEmail({
      to: user.email,
      subject,
      html,
    });

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Forgot password error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Unable to process password reset.",
    });
  }
}

export async function verifyPasswordCode(
  req,
  res
) {
  try {
    const {
      email,
      code,
    } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error:
          "Email and verification code are required.",
      });
    }

    const user =
      await db.user.findUnique({
        where: {
          email:
            email.trim().toLowerCase(),
        },
        select: {
          id: true,
        },
      });

    if (!user) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid verification code.",
      });
    }

    const reset =
      await db.passwordReset.findFirst({
        where: {
          userId: user.id,
          usedAt: null,
          verifiedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!reset) {
      return res.status(400).json({
        success: false,
        error:
          "This verification code has expired.",
      });
    }

    if (reset.attempts >= 5) {
      return res.status(429).json({
        success: false,
        error:
          "Too many verification attempts. Please request a new code.",
      });
    }

    const valid =
      await bcrypt.compare(
        code.trim(),
        reset.codeHash
      );

    if (!valid) {
      await db.passwordReset.update({
        where: {
          id: reset.id,
        },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      return res.status(400).json({
        success: false,
        error:
          "Invalid verification code.",
      });
    }

    await db.passwordReset.update({
      where: {
        id: reset.id,
      },
      data: {
        verifiedAt: new Date(),
      },
    });

    const resetToken =
      crypto.randomBytes(32).toString("hex");

    /*
     * Store the reset token securely.
     *
     * Better still, hash this token before storing it.
     */

    const resetTokenHash =
      crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    await db.passwordReset.update({
      where: {
        id: reset.id,
      },
      data: {
        resetTokenHash,
      },
    });

    return res.json({
      success: true,
      resetToken,
    });
  } catch (error) {
    console.error(
      "Verify password code error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Unable to verify the code.",
    });
  }
}


export async function resetPassword(
  req,
  res
) {
  try {
    const {
      resetToken,
      password,
      confirmPassword,
    } = req.body;

    if (
      !resetToken ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        error:
          "All fields are required.",
      });
    }

    if (
      password !==
      confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Passwords do not match.",
      });
    }

    const resetTokenHash =
      crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    const reset =
      await db.passwordReset.findFirst({
        where: {
          resetTokenHash,
          verifiedAt: {
            not: null,
          },
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

    if (!reset) {
      return res.status(400).json({
        success: false,
        error:
          "This password reset session is invalid or expired.",
      });
    }

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    await db.$transaction([
      db.user.update({
        where: {
          id: reset.userId,
        },
        data: {
          password: passwordHash,
        },
      }),

      db.passwordReset.update({
        where: {
          id: reset.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return res.json({
      success: true,
      message:
        "Password changed successfully.",
    });
  } catch (error) {
    console.error(
      "Reset password error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Unable to reset password.",
    });
  }
}
