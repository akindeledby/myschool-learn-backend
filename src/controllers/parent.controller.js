import { db } from "../../lib/db.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { sendEmail } from "../../src/services/email.service.js";

// ============================================================
// CONSTANTS
// ============================================================

const RESET_CODE_EXPIRY_MINUTES = 10;
const MAX_RESET_ATTEMPTS = 5;

// ============================================================
// GENERATE 6 DIGIT CODE
// ============================================================

function generateResetCode() {
  return crypto
    .randomInt(100000, 1000000)
    .toString();
}

// ============================================================
// HASH RESET CODE
// ============================================================

function hashResetCode(code) {
  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
}

export async function getProfiles(
  req,
  res
) {
  try {
    const userId = req.user.userId;

    const user =
      await db.user.findUnique({
        where: {
          id: userId,
        },
        include: {
          parent: true,
          account: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.parent) {
      return res.status(403).json({
        success: false,
        message:
          "Only parents can access profiles",
      });
    }

    if (!user.accountId) {
      return res.status(404).json({
        success: false,
        message:
          "No account attached to parent",
      });
    }

    const students =
      await db.student.findMany({
        where: {
          accountId:
            user.accountId,
        },
        orderBy: {
          firstName: "asc",
        },
      });
    
    const totalStudentsAdded =
      await db.student.count({
        where: {
          accountId:
            user.accountId,
        },
      });

    // const totalUsersInvited =
    //   await db.user.count({
    //     where: {
    //       invitedby:
    //         user.id,
    //     },
    //   });

    const subscription = await db.subscription.findFirst({
      where: {
        accountId: user.accountId,
        status: "ACTIVE",
        OR: [
          {
            endsAt: null, // FREEMIUM or lifetime
          },
          {
            endsAt: {
              gt: new Date(),
            },
          },
        ],
      },
      include: {
        subscriptionPlan: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,

      parent: {
        id: user.parent.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.parent.phone,
        profileImageUrl: user.profileImageUrl
      },
      subscription: subscription?.subscriptionPlan.subscriptionPlanName || null,
      students,
      totalStudentsAdded,
      // totalUsersInvited
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch profiles",
    });
  }
};


export async function selectProfile(req, res) {
  try {
    const userId = req.user.userId;

    const {
      profileType,
      studentId,
      password: rawPassword,
    } = req.body;


    const password =
      typeof rawPassword === "string"
        ? rawPassword.trim()
        : "";


    if (!["PARENT", "STUDENT"].includes(profileType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid profile type",
      });
    }


    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        accountId: true,
        parent: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User or account not found",
      });
    }


    if (!user.parent) {
      return res.status(403).json({
        success: false,
        message:
          "Only parent accounts can select profiles",
      });
    }


    if (profileType === "PARENT") {
      const parent = await db.parent.findFirst({
        where: {
          userId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePasswordHash: true,
        },
      });

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent profile not found",
        });
      }


      if (!parent.profilePasswordHash) {
        return res.status(403).json({
          success: false,
          code: "PROFILE_PASSWORD_SETUP_REQUIRED",
          profileType: "PARENT",
          parent: {
            id: parent.id,
            firstName: parent.firstName,
            lastName: parent.lastName,
          },
        });
      }

      if (!password) {
        return res.status(401).json({
          success: false,
          code: "PROFILE_PASSWORD_REQUIRED",
          profileType: "PARENT",
          parent: {
            id: parent.id,
            firstName: parent.firstName,
            lastName: parent.lastName,
          },
        });
      }


      const passwordIsValid =
        await bcrypt.compare(
          password,
          parent.profilePasswordHash
        );

      if (!passwordIsValid) {
        return res.status(401).json({
          success: false,
          code: "INVALID_PROFILE_PASSWORD",
          message: "Incorrect profile password",
        });
      }


      return res.status(200).json({
        success: true,
        profileType: "PARENT",
        parent: {
          id: parent.id,
          firstName: parent.firstName,
          lastName: parent.lastName,
        },
      });
    }

    if (profileType === "STUDENT") {
      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: "Student ID is required",
        });
      }


      const student = await db.student.findFirst({
        where: {
          id: studentId,
          accountId: user.accountId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          classLevel: true,
          profilePasswordHash: true,
        },
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student profile not found",
        });
      }

      if (!student.profilePasswordHash) {
        return res.status(403).json({
          success: false,
          code: "PROFILE_PASSWORD_SETUP_REQUIRED",
          profileType: "STUDENT",
          student: {
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            classLevel: student.classLevel,
          },
        });
      }


      if (!password) {
        return res.status(401).json({
          success: false,
          code: "PROFILE_PASSWORD_REQUIRED",
          profileType: "STUDENT",
          student: {
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
          },
        });
      }


      const passwordIsValid =
        await bcrypt.compare(
          password,
          student.profilePasswordHash
        );

      if (!passwordIsValid) {
        return res.status(401).json({
          success: false,
          code: "INVALID_PROFILE_PASSWORD",
          message: "Incorrect profile password",
        });
      }


      return res.status(200).json({
        success: true,
        profileType: "STUDENT",
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          classLevel: student.classLevel,
        },
      });
    }


    return res.status(400).json({
      success: false,
      message: "Unable to select profile",
    });
  } catch (error) {
    console.error(
      "[selectProfile] Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to select profile",
    });
  }
}


export async function setProfilePassword(req, res) {
  try {
    const userId = req.user.userId;

    const {
      profileType,
      studentId,
      password,
    } = req.body;

    if (!["PARENT", "STUDENT"].includes(profileType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid profile type",
      });
    }


    if (
      typeof password !== "string" ||
      !password.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Profile password is required",
      });
    }

    const trimmedPassword = password.trim();


    if (trimmedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_TOO_SHORT",
        message:
          "Profile password must be at least 6 characters",
      });
    }


    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        accountId: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }


    if (profileType === "PARENT") {
      const parent = await db.parent.findFirst({
        where: {
          userId,
        },
        select: {
          id: true,
          profilePasswordHash: true,
        },
      });

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent profile not found",
        });
      }


      if (parent.profilePasswordHash) {
        return res.status(409).json({
          success: false,
          code: "PROFILE_PASSWORD_ALREADY_EXISTS",
          message:
            "A profile password has already been created",
        });
      }


      const passwordHash = await bcrypt.hash(
        trimmedPassword,
        12
      );


      await db.parent.update({
        where: {
          id: parent.id,
        },
        data: {
          profilePasswordHash: passwordHash,
        },
      });

      return res.status(200).json({
        success: true,
        profileType: "PARENT",
        message:
          "Profile password created successfully",
      });
    }


    if (profileType === "STUDENT") {
      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: "Student ID is required",
        });
      }


      const student = await db.student.findFirst({
        where: {
          id: studentId,
          accountId: user.accountId,
        },
        select: {
          id: true,
          profilePasswordHash: true,
        },
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student profile not found",
        });
      }


      if (student.profilePasswordHash) {
        return res.status(409).json({
          success: false,
          code: "PROFILE_PASSWORD_ALREADY_EXISTS",
          message:
            "A profile password has already been created",
        });
      }

      const passwordHash = await bcrypt.hash(
        trimmedPassword,
        12
      );


      await db.student.update({
        where: {
          id: student.id,
        },
        data: {
          profilePasswordHash: passwordHash,
        },
      });

      return res.status(200).json({
        success: true,
        profileType: "STUDENT",
        message:
          "Profile password created successfully",
      });
    }


    return res.status(400).json({
      success: false,
      message: "Unable to create profile password",
    });

  } catch (error) {
    console.error(
      "[setProfilePassword] Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create profile password",
    });
  }
}



export async function requestParentProfilePasswordReset(req, res) {
  try {
    const userId = req.user.userId;

    // =========================================================
    // FIND PARENT AND REGISTERED USER EMAIL
    // =========================================================

    const parent = await db.parent.findFirst({
      where: {
        userId,
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePasswordHash: true,

        user: {
          select: {
            email: true,
          },
        },
      },
    });

    // =========================================================
    // PARENT NOT FOUND
    // =========================================================

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent profile not found.",
      });
    }

    // =========================================================
    // GET EMAIL FROM USER
    // =========================================================

    const email = parent.user?.email?.trim();

    // =========================================================
    // EMAIL REQUIRED
    // =========================================================

    if (!email) {
      return res.status(400).json({
        success: false,
        code: "PARENT_EMAIL_NOT_AVAILABLE",
        message:
          "No email address is associated with this parent account.",
      });
    }

    // =========================================================
    // PROFILE PASSWORD MUST ALREADY EXIST
    // =========================================================

    if (!parent.profilePasswordHash) {
      return res.status(400).json({
        success: false,
        code: "PROFILE_PASSWORD_NOT_SET",
        message:
          "A profile password has not been created yet.",
      });
    }

    // =========================================================
    // GENERATE 8 DIGIT RESET CODE
    // =========================================================

    const resetCode = generateResetCode();

    // =========================================================
    // HASH RESET CODE
    // =========================================================

    const resetCodeHash = hashResetCode(resetCode);

    // =========================================================
    // SET EXPIRATION TIME
    // =========================================================

    const resetExpiresAt = new Date(
      Date.now() +
        RESET_CODE_EXPIRY_MINUTES * 60 * 1000
    );

    // =========================================================
    // SAVE RESET INFORMATION
    // =========================================================

    await db.parent.update({
      where: {
        id: parent.id,
      },

      data: {
        profileResetCodeHash: resetCodeHash,
        profileResetExpiresAt: resetExpiresAt,
        profileResetAttempts: 0,
      },
    });

    // =========================================================
    // SEND RESET EMAIL
    //
    // IMPORTANT:
    // If the email provider fails, invalidate the reset code
    // because the parent never received it.
    // =========================================================

    try {
      await sendEmail({
        to: email,

        subject:
          "MySchoolLearn Profile Password Reset Code",

        html: `
          <div style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 30px;
            color: #1e293b;
            background-color: #ffffff;
          ">

            <h2 style="
              color: #4f46e5;
              margin-bottom: 20px;
            ">
              Reset Your Profile Password
            </h2>

            <p>
              Hello ${parent.firstName},
            </p>

            <p>
              We received a request to reset your
              MySchoolLearn parent profile password.
            </p>

            <p>
              Enter the verification code below
              to continue:
            </p>

            <div style="
              margin: 30px 0;
              padding: 20px;
              background: #eef2ff;
              border-radius: 12px;
              text-align: center;
            ">

              <div style="
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                color: #4338ca;
              ">
                ${resetCode}
              </div>

            </div>

            <p>
              This code will expire in
              ${RESET_CODE_EXPIRY_MINUTES} minutes.
            </p>

            <p style="
              color: #64748b;
              font-size: 14px;
            ">
              If you did not request this password reset,
              you can safely ignore this email.
            </p>

            <p style="
              margin-top: 30px;
              color: #334155;
            ">
              <strong>MySchoolLearn</strong><br />
              Learning made personal.
            </p>

          </div>
        `,
      });
    } catch (emailError) {
      // =======================================================
      // EMAIL FAILED
      // =======================================================

      console.error(
        "[requestParentProfilePasswordReset] Email failed:",
        emailError
      );

      // =======================================================
      // INVALIDATE THE RESET CODE
      // =======================================================

      try {
        await db.parent.update({
          where: {
            id: parent.id,
          },

          data: {
            profileResetCodeHash: null,
            profileResetExpiresAt: null,
            profileResetAttempts: 0,
          },
        });
      } catch (cleanupError) {
        console.error(
          "[requestParentProfilePasswordReset] Failed to clean up reset code:",
          cleanupError
        );
      }

      // =======================================================
      // RETURN EMAIL FAILURE TO FRONTEND
      // =======================================================

      return res.status(502).json({
        success: false,
        code: "RESET_EMAIL_FAILED",
        message:
          "We could not send the password reset email. Please try again.",
      });
    }

    // =========================================================
    // SUCCESS
    // =========================================================

    return res.status(200).json({
      success: true,

      message:
        "A password reset code has been sent to your registered email address.",

      expiresInMinutes:
        RESET_CODE_EXPIRY_MINUTES,
    });
  } catch (error) {
    console.error(
      "[requestParentProfilePasswordReset] Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to send password reset code. Please try again.",
    });
  }
}


export async function resetParentProfilePassword(req, res) {
  try {
    const userId = req.user.userId;

    const {
      code,
      password,
    } = req.body;

    // =========================================================
    // TRIM INPUTS
    // =========================================================

    const trimmedCode =
      typeof code === "string"
        ? code.trim()
        : "";

    const trimmedPassword =
      typeof password === "string"
        ? password.trim()
        : "";

    // =========================================================
    // VALIDATE RESET CODE
    // =========================================================

    if (!/^\d{6}$/.test(trimmedCode)) {
      return res.status(400).json({
        success: false,
        message:
          "A valid 6 digit verification code is required.",
      });
    }

    // =========================================================
    // VALIDATE NEW PASSWORD
    // =========================================================

    if (!trimmedPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a new profile password.",
      });
    }

    if (trimmedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_TOO_SHORT",
        message:
          "Profile password must be at least 6 characters.",
      });
    }

    // =========================================================
    // FIND PARENT
    // =========================================================

    const parent =
      await db.parent.findFirst({
        where: {
          userId,
        },

        select: {
          id: true,
          profileResetCodeHash: true,
          profileResetExpiresAt: true,
          profileResetAttempts: true,
        },
      });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message:
          "Parent profile not found.",
      });
    }

    // =========================================================
    // CHECK ACTIVE RESET REQUEST
    // =========================================================

    if (
      !parent.profileResetCodeHash ||
      !parent.profileResetExpiresAt
    ) {
      return res.status(400).json({
        success: false,
        code: "RESET_CODE_NOT_FOUND",
        message:
          "No active password reset request was found. Please request a new reset code.",
      });
    }

    // =========================================================
    // CHECK MAXIMUM RESET ATTEMPTS
    // =========================================================

    if (
      parent.profileResetAttempts >=
      MAX_RESET_ATTEMPTS
    ) {
      return res.status(429).json({
        success: false,
        code: "RESET_ATTEMPTS_EXCEEDED",
        message:
          "Too many incorrect attempts. Please request a new code.",
      });
    }

    // =========================================================
    // CHECK CODE EXPIRATION
    // =========================================================

    if (
      new Date() >
      parent.profileResetExpiresAt
    ) {
      await db.parent.update({
        where: {
          id: parent.id,
        },

        data: {
          profileResetCodeHash: null,
          profileResetExpiresAt: null,
          profileResetAttempts: 0,
        },
      });

      return res.status(400).json({
        success: false,
        code: "RESET_CODE_EXPIRED",
        message:
          "This verification code has expired. Please request a new one.",
      });
    }

    // =========================================================
    // HASH SUBMITTED CODE
    // =========================================================

    const submittedCodeHash =
      hashResetCode(trimmedCode);

    // =========================================================
    // VERIFY RESET CODE
    // =========================================================

    if (
      submittedCodeHash !==
      parent.profileResetCodeHash
    ) {
      await db.parent.update({
        where: {
          id: parent.id,
        },

        data: {
          profileResetAttempts: {
            increment: 1,
          },
        },
      });

      return res.status(400).json({
        success: false,
        code: "INVALID_RESET_CODE",
        message:
          "The verification code is incorrect.",
      });
    }

    // =========================================================
    // HASH NEW PROFILE PASSWORD
    // =========================================================

    const passwordHash =
      await bcrypt.hash(
        trimmedPassword,
        12
      );

    // =========================================================
    // UPDATE PASSWORD
    //
    // The reset information is cleared immediately
    // so the code cannot be reused.
    // =========================================================

    await db.parent.update({
      where: {
        id: parent.id,
      },

      data: {
        profilePasswordHash:
          passwordHash,

        profileResetCodeHash: null,

        profileResetExpiresAt: null,

        profileResetAttempts: 0,
      },
    });

    // =========================================================
    // SUCCESS
    // =========================================================

    return res.status(200).json({
      success: true,
      message:
        "Your profile password has been reset successfully.",
    });
  } catch (error) {
    console.error(
      "[resetParentProfilePassword] Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to reset profile password. Please try again.",
    });
  }
}

export async function fetchChildrenData(
  req,
  res
) {
  try {
    const userId = req.user.userId;

    const user =
      await db.user.findUnique({
        where: {
          id: userId,
        },
        include: {
          parent: true,
          account: true
        },
      });

    // const user =
    //   await db.user.findUnique({
    //     where: {
    //       id: userId,
    //     },
    //     select: {
    //       parent: true,
    //       account: true
    //     },
    //   });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.parent) {
      return res.status(403).json({
        success: false,
        message:
          "Only parents can access profiles",
      });
    }

     if (!user.account) {
      return res.status(403).json({
        success: false,
        message:
          "No subscription available for user",
      });
    }

    const students =
      await db.student.findMany({
        where: {
          parentId: user.parent.id,
        },
        orderBy: {
          firstName: "asc",
        },
      });

    const subscription = await db.subscription.findFirst({
      where: {
        accountId: user.account.id
      },
      select: {
        subscriptionPlan: true,
      }
    })

    return res.status(200).json({
      success: true,
      students,
      subscription: subscription.subscriptionPlan.maxStudents
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch profiles",
    });
  }
};

export async function addChild(
  req,
  res
) {
  try {
    const schoolId = req.school?.id || null;

    const userId = req.user.userId;

    const { firstName, lastName, age, classId, gender, studentCategory } = req.body;

    if(!firstName || !lastName || !age || !classId || !gender || !studentCategory) {
      return res.status(401).json({
        success: false,
        message:
          "All fields are required",
      });
    }

    const user =
      await db.user.findUnique({
        where: {
          id: userId,
        },
        include: {
          parent: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.parent) {
      return res.status(403).json({
        success: false,
        message:
          "Only parents can access profiles",
      });
    }


    if (!user.parent) {
      return res.status(403).json({
        success: false,
        message:
          "Only parents can access profiles",
      });
    }

    const activeSubscription =
      await db.subscription.findFirst({
        where: {
          accountId: user.accountId,
          status: "ACTIVE",
          OR: [
            {
              endsAt: null,
            },
            {
              endsAt: {
                gt: new Date(),
              },
            },
          ],
        },
        include: {
          subscriptionPlan: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!activeSubscription) {
      return res.status(400).json({
        success: false,
        message:
          "No active subscription found for this account",
      });
    }

    const maxStudents =
      activeSubscription
        .subscriptionPlan
        .maxStudents;

    const currentStudents =
      await db.student.count({
        where: {
          accountId: user.accountId,
        },
      });

    if (
      currentStudents >= maxStudents
    ) {
      return res.status(400).json({
        success: false,
        message: `You have reached the maximum limit of ${maxStudents} students for your current subscription plan.`,
      });
    }

    const existingStudent =
      await db.student.findFirst({
        where: {
          firstName,
          lastName,
          accountId: user.accountId,
        },
      });

    if (existingStudent) {
      return res.status(401).json({
        error: "Child's record already created",
      });
    }

    let classRecord = null;
    let classLevel = null;

    if (classId) {
      classRecord =
        await db.class.findUnique({
          where: {
            id: classId,
          },
        });

      if (!classRecord) {
        throw new Error(
          "Selected class not found"
        );
      }

      classLevel =
        classRecord.name ||
        classRecord.level ||
        null;
    }

    let schoolRecord = null;

    if (schoolId) {
      schoolRecord =
        await db.school.findUnique({
          where: {
            id: schoolId,
          },
        });

      if (!schoolRecord) {
        return res.status(404).json({
          error:
            "School is not onboarded or does not exist",
        });
      }
    }

    const student =
      await db.student.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          age: age
            ? Number(age)
            : null,
          gender,
          category: studentCategory,
          classId:
            classRecord?.id ||
            null,
          classLevel,
          parentId: user.parent.id,
          accountId: user.accountId,
          schoolId: schoolRecord?.id || null,
        }
      });

    return res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    console.error(error);
    console.log(error)

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch profiles",
    });
  }
};


export async function promoteChild(req, res) {
  try {
    const userId = req.user.userId;

    const {
      studentId,
      age,
      category,
      classId,
    } = req.body;

    //----------------------------------------------------
    // Validate input
    //----------------------------------------------------

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student is required.",
      });
    }

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: "Class is required.",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Student category is required.",
      });
    }

    if (
      age === undefined ||
      age === null ||
      age === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Student age is required.",
      });
    }

    const numericAge = Number(age);

    if (
      !Number.isInteger(numericAge) ||
      numericAge < 1 ||
      numericAge > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid age.",
      });
    }

    //----------------------------------------------------
    // Get authenticated parent
    //----------------------------------------------------

    const currentUser = await db.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        parent: true,
      },
    });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!currentUser.parent) {
      return res.status(403).json({
        success: false,
        message: "Only parents can access profiles.",
      });
    }

    //----------------------------------------------------
    // Find student belonging to this parent
    //----------------------------------------------------

    const student = await db.student.findFirst({
      where: {
        id: studentId,
        parentId: currentUser.parent.id,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student to promote not found.",
      });
    }

    //----------------------------------------------------
    // Find selected class
    //----------------------------------------------------

    const selectedClass = await db.class.findUnique({
      where: {
        id: classId,
      },
    });

    if (!selectedClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found.",
      });
    }

    //----------------------------------------------------
    // Validate category against selected class
    //----------------------------------------------------

    const className = selectedClass.name
      .trim()
      .toUpperCase();

    let validClass = false;

    if (category.toLowerCase() === "primary") {
      validClass = /^PRIMARY\s+[1-6]$/.test(
        className
      );
    }

    if (category.toLowerCase() === "secondary") {
      validClass = /^(JSS|SS)[1-3]$/.test(
        className
      );
    }

    if (!validClass) {
      return res.status(400).json({
        success: false,
        message:
          "The selected class does not belong to the selected student category.",
      });
    }

    //----------------------------------------------------
    // Update student
    //----------------------------------------------------

    const updatedStudent =
      await db.student.update({
        where: {
          id: student.id,
        },
        data: {
          age: numericAge,
          category: category.toLowerCase(),
          classId,
          classLevel: selectedClass.name,
        },
      });

    //----------------------------------------------------
    // Success
    //----------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Student promoted successfully.",
      student: updatedStudent,
    });
  } catch (error) {
    console.error(
      "Promote child error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to promote student.",
    });
  }
}


export async function removeChild(req, res) {
  try {
    const userId = req.user.userId;

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Child or Student ID is required",
      });
    }

    const currentUser = await db.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        parent: true,
      },
    });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!currentUser.parent) {
      return res.status(403).json({
        success: false,
        message: "Only parents can access profiles",
      });
    }

    const student = await db.student.findUnique({
      where: {
        id,
        parentId: currentUser.parent.id,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student or child to delete not found",
      });
    }

    await db.student.delete({
      where: {
        id: student.id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Child removed successfully",
    });
  } catch (error) {
    console.error("Remove child error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete child or student",
    });
  }
}


export async function updateChildPassword(req, res) {
  try {
    const { studentId } = req.params;
    const { password } = req.body;

    // ==========================================
    // 1. VALIDATE AUTHENTICATED USER
    // ==========================================

    const userId = req.user.userId;

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        parent: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // ==========================================
    // 2. VERIFY USER IS A PARENT
    // ==========================================

    if (user.role !== "PARENT") {
      return res.status(403).json({
        success: false,
        message:
          "Only parents can update a child's password.",
      });
    }

    if (!user.parent) {
      return res.status(403).json({
        success: false,
        message:
          "Parent profile not found.",
      });
    }

    // ==========================================
    // 3. VALIDATE REQUEST
    // ==========================================

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required.",
      });
    }

    if (typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "Password is required.",
      });
    }

    const trimmedPassword = password.trim();

    if (!trimmedPassword) {
      return res.status(400).json({
        success: false,
        message: "Password cannot be empty.",
      });
    }

    // ==========================================
    // 4. VALIDATE PASSWORD LENGTH
    // ==========================================

    if (trimmedPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long.",
      });
    }

    // ==========================================
    // 5. FIND STUDENT
    //    AND VERIFY PARENT OWNERSHIP
    // ==========================================

    const student = await db.student.findFirst({
      where: {
        id: studentId,
        parentId: user.parent.id,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found or does not belong to this parent.",
      });
    }

    // ==========================================
    // 6. HASH PASSWORD
    // ==========================================

    const hashedPassword = await bcrypt.hash(
      trimmedPassword,
      12
    );

    // ==========================================
    // 7. UPDATE STUDENT PASSWORD
    // ==========================================

    await db.student.update({
      where: {
        id: student.id,
      },
      data: {
        profilePasswordHash: hashedPassword,
      },
    });

    // ==========================================
    // 8. RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,
      message: `Password updated successfully for ${student.firstName} ${student.lastName}.`,
    });
  } catch (error) {
    console.error(
      "Update child password error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update student password.",
    });
  }
}


export async function getStudentAcademicReport(req, res) {
  try {
    // ==========================================
    // AUTHENTICATION
    // ==========================================

    const userId = req.user?.userId;
    const { studentId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "studentId is required.",
      });
    }

    // ==========================================
    // VERIFY USER
    // ==========================================

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },

      include: {
        parent: true,
      },
    });

    if (!user || !user.role) {
      return res.status(403).json({
        success: false,
        message: "User account or role not found.",
      });
    }

    // ==========================================
    // VERIFY PARENT ROLE
    // ==========================================

    if (user.role !== "PARENT") {
      return res.status(403).json({
        success: false,
        message: "Only parents can access student reports.",
      });
    }

    // ==========================================
    // VERIFY PARENT PROFILE
    // ==========================================

    if (!user.parent) {
      return res.status(403).json({
        success: false,
        message: "Parent profile not found.",
      });
    }

    // ==========================================
    // FETCH STUDENT
    //
    // parentId ensures the authenticated parent
    // can only access their own child.
    // ==========================================

    const student = await db.student.findFirst({
      where: {
        id: studentId,
        parentId: user.parent.id,
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        classLevel: true,

        // ======================================
        // STUDENT PROFILE
        // ======================================

        studentProfile: {
          select: {
            xp: true,
            level: true,
            totalGames: true,
            totalWins: true,
            streak: true,
            highestScore: true,
            totalCorrect: true,
            totalWrong: true,
          },
        },

        // ======================================
        // SUBJECT SCORES
        //
        // StudentScore is now unique by:
        //
        // studentId + subjectId + termId
        //
        // Therefore we fetch the term as well.
        // ======================================

        studentScores: {
          orderBy: [
            {
              subject: {
                name: "asc",
              },
            },
            {
              term: {
                name: "asc",
              },
            },
          ],

          select: {
            id: true,

            studentId: true,
            subjectId: true,
            termId: true,

            // ==================================
            // TEST
            // ==================================

            testTotalCorrect: true,
            testTotalQuestions: true,
            testCount: true,

            testLowestScore: true,
            testHighestScore: true,
            testAverageScore: true,

            testTopics: true,
            noOfTopics: true,

            // ==================================
            // EXAM
            // ==================================

            examTotalCorrect: true,
            examTotalQuestions: true,
            examTotalScore: true,
            examCount: true,

            examLowestScore: true,
            examHighestScore: true,
            examAverageScore: true,

            examTerms: true,

            // ==================================
            // SUBJECT
            // ==================================

            subject: {
              select: {
                id: true,
                name: true,
              },
            },

            // ==================================
            // TERM
            // ==================================

            term: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },

        // ======================================
        // ACHIEVEMENTS
        // ======================================

        studentAchievements: {
          orderBy: {
            earnedAt: "desc",
          },

          select: {
            id: true,
            achievementId: true,
            earnedAt: true,

            achievement: {
              select: {
                id: true,
                title: true,
                icon: true,
                code: true,
                description: true
              },
            },
          },
        },

        // ======================================
        // TOPIC ANALYTICS
        // ======================================

        topicAnalytics: {
          orderBy: {
            lastAccessed: "desc",
          },

          select: {
            id: true,
            topicId: true,

            completionRate: true,
            averageScore: true,

            testCount: true,
            totalQuestions: true,
            totalCorrect: true,

            attemptedQuestionIds: true,

            lastScore: true,
            highestScore: true,
            lowestScore: true,

            lastAccessed: true,

            topic: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    // ==========================================
    // VERIFY STUDENT
    // ==========================================

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found or does not belong to this parent.",
      });
    }

    // ==========================================
    // STUDENT PROFILE
    // ==========================================

    const profile = student.studentProfile;

    const totalGames = profile?.totalGames ?? 0;
    const totalWins = profile?.totalWins ?? 0;
    const totalCorrect = profile?.totalCorrect ?? 0;
    const totalWrong = profile?.totalWrong ?? 0;

    const totalAnswered =
      totalCorrect + totalWrong;

    // ==========================================
    // WIN RATE
    // ==========================================

    const winRate =
      totalGames > 0
        ? Number(
            ((totalWins / totalGames) * 100).toFixed(2)
          )
        : 0;

    // ==========================================
    // ACCURACY
    // ==========================================

    const accuracy =
      totalAnswered > 0
        ? Number(
            ((totalCorrect / totalAnswered) * 100).toFixed(2)
          )
        : 0;

    // ==========================================
    // SUBJECT REPORTS
    //
    // StudentScore now has one record per:
    //
    // student + subject + term
    //
    // Therefore group the records by subject.
    // ==========================================

    const subjectMap = new Map();

    for (const score of student.studentScores) {
      const subjectId = score.subjectId;

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          id: subjectId,

          name:
            score.subject?.name ??
            "Unknown Subject",

          terms: [],
        });
      }

      const subject = subjectMap.get(subjectId);

      // ======================================
      // NORMALIZE TEST TOPICS
      // ======================================

      let testTopics = [];

      if (Array.isArray(score.testTopics)) {
        testTopics = score.testTopics;
      } else if (score.testTopics) {
        testTopics = score.testTopics;
      }

      // ======================================
      // NORMALIZE EXAM TERMS
      // ======================================

      let examTerms = [];

      if (Array.isArray(score.examTerms)) {
        examTerms = score.examTerms;
      } else if (score.examTerms) {
        examTerms = score.examTerms;
      }

      // ======================================
      // TERM REPORT
      // ======================================

      subject.terms.push({
        id: score.termId,

        term: {
          id: score.term?.id ?? score.termId,
          name:
            score.term?.name ??
            "Unknown Term",
        },

        // ====================================
        // TEST
        // ====================================

        test: {
          totalCorrect:
            score.testTotalCorrect ?? 0,

          totalQuestions:
            score.testTotalQuestions ?? 0,

          count:
            score.testCount ?? 0,

          lowestScore:
            score.testLowestScore ?? 0,

          highestScore:
            score.testHighestScore ?? 0,

          averageScore:
            score.testAverageScore ?? 0,

          noOfTopics:
            score.noOfTopics ?? 0,

          topics: testTopics,
        },

        // ====================================
        // EXAM
        // ====================================

        exam: {
          totalCorrect:
            score.examTotalCorrect ?? 0,

          totalQuestions:
            score.examTotalQuestions ?? 0,

          totalScore:
            score.examTotalScore ?? 0,

          count:
            score.examCount ?? 0,

          lowestScore:
            score.examLowestScore ?? 0,

          highestScore:
            score.examHighestScore ?? 0,

          averageScore:
            score.examAverageScore ?? 0,

          terms:
            examTerms,
        },
      });
    }

    const subjects = Array.from(
      subjectMap.values()
    );

    // ==========================================
    // ACHIEVEMENT REPORT
    // ==========================================

    const achievements =
      student.studentAchievements.map(
        (studentAchievement) => ({
          id: studentAchievement.id,

          achievementId:
            studentAchievement.achievementId,

          code:
            studentAchievement.achievement?.code ?? null,

          title:
            studentAchievement.achievement?.title ??
            "Achievement",

          icon:
            studentAchievement.achievement?.icon ??
            "🏆",

          description:
            studentAchievement.achievement?.description ??
            null,

          earnedAt:
            studentAchievement.earnedAt,
        })
      );

    // ==========================================
    // TOPIC PROGRESS
    // ==========================================

    const topicProgress =
      student.topicAnalytics.map(
        (analytics) => ({
          id: analytics.id,

          topicId:
            analytics.topicId,

          title:
            analytics.topic?.title ??
            "Unknown Topic",

          completionRate:
            analytics.completionRate ?? 0,

          averageScore:
            analytics.averageScore ?? 0,

          testCount:
            analytics.testCount ?? 0,

          totalQuestions:
            analytics.totalQuestions ?? 0,

          totalCorrect:
            analytics.totalCorrect ?? 0,

          attemptedQuestionIds:
            analytics.attemptedQuestionIds ?? [],

          lastScore:
            analytics.lastScore ?? null,

          highestScore:
            analytics.highestScore ?? null,

          lowestScore:
            analytics.lowestScore ?? null,

          lastAccessed:
            analytics.lastAccessed ?? null,
        })
      );

    // ==========================================
    // TOPIC SUMMARY
    // ==========================================

    const totalTopics =
      topicProgress.length;

    const completedTopics =
      topicProgress.filter(
        (topic) =>
          topic.completionRate >= 100
      ).length;

    const overallCompletionRate =
      totalTopics > 0
        ? topicProgress.reduce(
            (total, topic) =>
              total +
              (topic.completionRate ?? 0),
            0
          ) / totalTopics
        : 0;

    const topicsWithScores =
      topicProgress.filter(
        (topic) =>
          typeof topic.averageScore ===
            "number" &&
          topic.averageScore > 0
      );

    const overallAverageScore =
      topicsWithScores.length > 0
        ? topicsWithScores.reduce(
            (total, topic) =>
              total +
              topic.averageScore,
            0
          ) / topicsWithScores.length
        : 0;

    // ==========================================
    // SUBJECT SUMMARY
    //
    // Useful because subjects are now grouped
    // across multiple terms.
    // ==========================================

    const totalSubjects =
      subjects.length;

    const totalSubjectTerms =
      subjects.reduce(
        (total, subject) =>
          total +
          subject.terms.length,
        0
      );

    // ==========================================
    // FINAL RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,

      data: {
        // ======================================
        // STUDENT
        // ======================================

        student: {
          id: student.id,

          firstName:
            student.firstName,

          lastName:
            student.lastName,

          classLevel:
            student.classLevel,
        },

        // ======================================
        // PROFILE
        // ======================================

        profile: {
          xp:
            profile?.xp ?? 0,

          level:
            profile?.level ?? 1,

          totalGames,

          totalWins,

          winRate,

          streak:
            profile?.streak ?? 0,

          highestScore:
            profile?.highestScore ?? 0,

          totalCorrect,

          totalWrong,

          totalAnswered,

          accuracy,
        },

        // ======================================
        // SUBJECT REPORTS
        // ======================================

        subjects,

        subjectSummary: {
          totalSubjects,
          totalSubjectTerms,
        },

        // ======================================
        // ACHIEVEMENTS
        // ======================================

        achievements,

        // ======================================
        // TOPIC PROGRESS
        // ======================================

        topicProgress,

        // ======================================
        // TOPIC SUMMARY
        // ======================================

        topicSummary: {
          totalTopics,

          completedTopics,

          overallCompletionRate:
            Number(
              overallCompletionRate.toFixed(2)
            ),

          overallAverageScore:
            Number(
              overallAverageScore.toFixed(2)
            ),
        },
      },
    });
  } catch (error) {
    console.error(
      "getStudentAcademicReport error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch academic report.",
    });
  }
}
