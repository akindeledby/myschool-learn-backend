import { db } from "../../lib/db.js";

function toNumber(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function roundNumber(value, decimals = 2) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function formatCurrency(value, currency = "NGN") {
  const amount = toNumber(value);

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatRelativeTime(date) {
  if (!date) {
    return "";
  }

  const now = Date.now();
  const created = new Date(date).getTime();

  if (!Number.isFinite(created)) {
    return "";
  }

  const difference = Math.max(
    0,
    now - created
  );

  const minutes = Math.floor(
    difference / (1000 * 60)
  );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} ${
      minutes === 1 ? "minute" : "minutes"
    } ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours} ${
      hours === 1 ? "hour" : "hours"
    } ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 7) {
    return `${days} ${
      days === 1 ? "day" : "days"
    } ago`;
  }

  return new Date(date).toLocaleDateString(
    "en-NG",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function getPercentage(
  numerator,
  denominator
) {
  if (
    !denominator ||
    denominator <= 0
  ) {
    return 0;
  }

  return roundNumber(
    (numerator / denominator) * 100,
    1
  );
}


export async function getSchoolProfile(req, res) {
  try {

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    let school = null;

    if (req.school?.id) {
      school = await db.school.findUnique({
        where: {
          id: req.school.id,
        },

        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              invitationCode: true,
              createdAt: true,
            },
          },
        },
      });
    } else {
      school = await db.school.findUnique({
        where: {
          userId,
        },

        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              invitationCode: true,
              createdAt: true,
            },
          },
        },
      });
    }

    if (!school) {
      return res.status(404).json({
        success: false,
        message: "School not found.",
      });
    }

    const authenticatedUser = await db.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        role: true,
        schoolId: true,
        accountId: true,
      },
    });

    if (!authenticatedUser) {
      return res.status(404).json({
        success: false,
        message: "Authenticated user was not found.",
      });
    }

    const isSchoolAdministrator =
      school.userId === userId;

    if (
      !isSchoolAdministrator ||
      authenticatedUser.role !== "SCHOOL_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to access this school dashboard.",
      });
    }

    const referralUserId = school.userId;

    const invitationCode =
      school.user?.invitationCode || null;

    const frontendUrl =
      process.env.FRONTEND_URL ||
      "https://myschoollearn.com";

    const invitationLink = invitationCode
      ? `${frontendUrl}/auth?mode=register&invitationCode=${encodeURIComponent(
          invitationCode
        )}`
      : null;


    const students = await db.student.findMany({
      where: {
        schoolId: school.id,
      },

      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        classId: true,
        createdAt: true,

        _count: {
          select: {
            lessonprogresses: true,
            quizAttempts: true,
          },
        },
      },
    });

    const registeredStudents = students.length;

    const studentIds = students.map(
      (student) => student.id
    );

    const studentUserIds = students
      .map((student) => student.userId)
      .filter(Boolean);

    void studentIds;
    void studentUserIds;


    const invitedUsers = await db.user.findMany({
      where: {
        invitedById: referralUserId,
      },

      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        schoolId: true,
        accountId: true,
        createdAt: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const invitedUserCount = invitedUsers.length;

    const referredPayments = await db.payment.findMany({
      where: {
        referredByUserId: referralUserId,
        status: "SUCCESS",
      },

      select: {
        id: true,
        accountId: true,
        amount: true,
        currency: true,
        createdAt: true,
        paidAt: true,
        reference: true,

        subscriptionPlan: {
          select: {
            subscriptionPlanName: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const subscribedAccountIds = new Set(
      referredPayments
        .map((payment) => payment.accountId)
        .filter(Boolean)
    );

    const subscribedUsers =
      subscribedAccountIds.size;

    const conversionRate = getPercentage(
      subscribedUsers,
      invitedUserCount
    );


    const commissions = await db.commission.findMany({
      where: {
        referrerUserId: referralUserId,
      },

      select: {
        id: true,
        paymentId: true,
        percentage: true,
        paymentAmount: true,
        commissionAmount: true,
        currency: true,
        status: true,
        createdAt: true,
        paidAt: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });


    const totalEarnings = commissions.reduce(
      (total, commission) =>
        total +
        toNumber(
          commission.commissionAmount
        ),
      0
    );


    const pendingPayout = commissions
      .filter(
        (commission) =>
          commission.status === "AVAILABLE"
      )
      .reduce(
        (total, commission) =>
          total +
          toNumber(
            commission.commissionAmount
          ),
        0
      );


    const commissionRate = toNumber(
      school.commissionRate
    );

    const classStudentCounts =
      await db.student.groupBy({
        by: ["classId"],

        where: {
          schoolId: school.id,
          classId: {
            not: null,
          },
        },

        _count: {
          id: true,
        },

        orderBy: {
          _count: {
            id: "desc",
          },
        },

        take: 10,
      });

    const classIds = classStudentCounts
      .map((item) => item.classId)
      .filter(Boolean);

    const classRecords =
      classIds.length > 0
        ? await db.class.findMany({
            where: {
              id: {
                in: classIds,
              },
            },

            select: {
              id: true,
              name: true,
            },
          })
        : [];

    const classMap = new Map(
      classRecords.map((classRecord) => [
        classRecord.id,
        classRecord,
      ])
    );

    const classes = classStudentCounts.map(
      (item) => {
        const classRecord =
          classMap.get(item.classId);

        const studentCount =
          item._count.id;

        const classStudents =
          students.filter(
            (student) =>
              student.classId ===
              item.classId
          );

        const activeClassStudents =
          classStudents.filter(
            (student) =>
              student._count
                .lessonprogresses > 0 ||
              student._count
                .quizAttempts > 0
          ).length;

        return {
          id: item.classId,

          name:
            classRecord?.name ||
            "Unnamed Class",

          students: studentCount,

          engagement: getPercentage(
            activeClassStudents,
            studentCount
          ),
        };
      }
    );

    const activeStudents =
      students.filter(
        (student) =>
          student._count
            .lessonprogresses > 0 ||
          student._count
            .quizAttempts > 0
      ).length;

    const lessonsCompleted =
      students.reduce(
        (total, student) =>
          total +
          student._count
            .lessonprogresses,
        0
      );

    const quizzesCompleted =
      students.reduce(
        (total, student) =>
          total +
          student._count
            .quizAttempts,
        0
      );

    const averageEngagement =
      getPercentage(
        activeStudents,
        registeredStudents
      );


    const recentRegisteredUsers =
      invitedUsers.slice(0, 10);

    const recentSuccessfulPayments =
      referredPayments.slice(0, 10);

    const recentCommissions =
      commissions.slice(0, 10);

    const activities = [];

    for (
      const user of recentRegisteredUsers
    ) {
      const fullName =
        [
          user.firstName,
          user.lastName,
        ]
          .filter(Boolean)
          .join(" ") ||
        user.email;

      let activityType =
        "registration";

      if (user.role === "PARENT") {
        activityType = "parent";
      } else if (user.role === "STUDENT") {
        activityType = "student";
      }

      activities.push({
        id: `registration-${user.id}`,

        type: activityType,

        title:
          user.role === "PARENT"
            ? "New parent registered"
            : user.role === "STUDENT"
            ? "New student registered"
            : "New user registered",

        description:
          `${fullName} joined using your invitation code`,

        createdAt: user.createdAt,
      });
    }


    for (
      const payment of recentSuccessfulPayments
    ) {
      activities.push({
        id: `payment-${payment.id}`,

        type: "subscription",

        title: "Subscription activated",

        description:
          `${
            payment.subscriptionPlan
              ?.subscriptionPlanName ||
            "Subscription"
          } payment of ${formatCurrency(
            payment.amount,
            payment.currency || "NGN"
          )} was completed`,

        createdAt:
          payment.paidAt ||
          payment.createdAt,
      });
    }

    for (
      const commission of recentCommissions
    ) {
      activities.push({
        id: `commission-${commission.id}`,

        type: "commission",

        title: "Commission earned",

        description:
          `You earned ${formatCurrency(
            commission.commissionAmount,
            commission.currency || "NGN"
          )} from a referred subscription`,

        createdAt:
          commission.createdAt,
      });
    }

    activities.sort(
      (a, b) =>
        new Date(
          b.createdAt
        ).getTime() -
        new Date(
          a.createdAt
        ).getTime()
    );

    const recentActivity =
      activities
        .slice(0, 10)
        .map((activity) => ({
          id: activity.id,
          type: activity.type,
          title: activity.title,
          description:
            activity.description,
          createdAt:
            activity.createdAt,
          time:
            formatRelativeTime(
              activity.createdAt
            ),
        }));


    const now = new Date();

    const registrationOverview = [];

    for (
      let index = 6;
      index >= 0;
      index--
    ) {
      const day = new Date(now);

      day.setHours(
        0,
        0,
        0,
        0
      );

      day.setDate(
        day.getDate() - index
      );

      const nextDay =
        new Date(day);

      nextDay.setDate(
        nextDay.getDate() + 1
      );

      const registrationsForDay =
        invitedUsers.filter(
          (user) => {
            const created =
              new Date(
                user.createdAt
              );

            return (
              created >= day &&
              created < nextDay
            );
          }
        ).length;


      const accountsSubscribedThatDay =
        new Set(
          referredPayments
            .filter(
              (payment) => {
                const paymentDate =
                  new Date(
                    payment.paidAt ||
                      payment.createdAt
                  );

                return (
                  paymentDate >= day &&
                  paymentDate < nextDay
                );
              }
            )
            .map(
              (payment) =>
                payment.accountId
            )
            .filter(Boolean)
        ).size;

      registrationOverview.push({
        date:
          day.toISOString(),

        day:
          day.toLocaleDateString(
            "en-NG",
            {
              weekday: "short",
            }
          ),

        invitations:
          registrationsForDay,

        registrations:
          registrationsForDay,

        subscriptions:
          accountsSubscribedThatDay,
      });
    }

    return res.status(200).json({
      success: true,

      data: {

        school: {
          id: school.id,

          name:
            school.name ||
            "MySchoolLearn School",

          invitationCode,

          invitationLink,

          schoolEmail:
            school.schoolEmail,

          schoolPhoneContact:
            school.schoolPhoneContact,

          address:
            school.address,

          website:
            school.website,

          subdomain:
            school.subdomain,

          status:
            school.status,

          commissionRate,

          bankAccountName:
            school.bankAccountName,

          accountNumber:
            school.accountNumber,

          bankName: 
            school.bankName,

          createdAt:
            school.createdAt,
        },

        administrator:
          school.user
            ? {
                id:
                  school.user.id,

                firstName:
                  school.user.firstName,

                lastName:
                  school.user.lastName,

                email:
                  school.user.email,

                role:
                  school.user.role,
              }
            : null,


        overview: {
          registeredStudents,

          invitedUsers:
            invitedUserCount,

          conversionRate,

          totalEarnings:
            roundNumber(
              totalEarnings,
              2
            ),

          totalEarningsFormatted:
            formatCurrency(
              totalEarnings
            ),
        },

        subscriptions: {
          planName:
            "School Partner",

          status:
            school.status,

          subscribedUsers,

          commissionRate,

          commissionEarned:
            roundNumber(
              totalEarnings,
              2
            ),

          pendingPayout:
            roundNumber(
              pendingPayout,
              2
            ),

          nextPayoutDate:
            null,
        },

        registrations:
          registrationOverview,

        activity:
          recentActivity,

        performance: {
          activeStudents,

          lessonsCompleted,

          quizzesCompleted,

          averageEngagement,
        },

        classes,
      },
    });
  } catch (error) {
    console.error(
      "[getSchoolProfile] ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error?.message ||
        "Unable to load school profile.",
    });
  }
}

export async function updateSchoolProfile(req, res) {
  try {
    const userId = req.user.userId;

    const user =
      await db.user.findUnique({
        where: {
          id: userId
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User profile not found.",
      });
    }

    const {
      name,
      schoolEmail,
      schoolPhoneContact,
    } = req.body;

    // ---------------------------------------------------------
    // 2. Clean values
    // ---------------------------------------------------------

    const cleanName = String(name).trim();
    const cleanSchoolEmail = String(schoolEmail).trim();
    const cleanSchoolPhoneContact = String(schoolPhoneContact).trim();


    // ---------------------------------------------------------
    // 6. Make sure school exists
    // ---------------------------------------------------------

    const school = await db.school.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: "School account not found.",
      });
    }

    // ---------------------------------------------------------
    // 7. Save bank details
    // ---------------------------------------------------------

    const updatedSchool = await db.school.update({
      where: {
        id: school.id,
      },
      data: {
        name: cleanName,
        schoolEmail: cleanSchoolEmail,
        schoolPhoneContact: cleanSchoolPhoneContact,
      },
    });

    // ---------------------------------------------------------
    // 8. Return saved details
    // ---------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "School details saved successfully.",
      bankAccount: updatedSchool,
    });
  } catch (error) {
    console.error(
      "Error saving school details:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while saving school details.",
    });
  }
}


export async function getRegisteredSchools(req, res) {
  try {
    const schools = await db.school.findMany({
      where: {
        status: {
          in: ["PRE_REGISTERED", "ACTIVE"],
        },
      },

      select: {
        id: true,
        name: true,
        schoolEmail: true,
        address: true,
        website: true,
        subdomain: true,
        status: true,
      },

      orderBy: {
        name: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      data: schools,
    });
  } catch (error) {
    console.error(
      "getSchoolsForStudentRegistration error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch schools.",
    });
  }
}


export async function updateBankAccount(req, res) {
  try {
    const userId = req.user.userId;

    const user =
      await db.user.findUnique({
        where: {
          id: userId
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User profile not found.",
      });
    }

    const {
      accountNumber,
      accountName,
      bankName,
      bankCode,
    } = req.body;

    // ---------------------------------------------------------
    // 1. Validate required fields
    // ---------------------------------------------------------

    if (!accountNumber) {
      return res.status(400).json({
        success: false,
        message: "Account number is required.",
      });
    }

    if (!accountName) {
      return res.status(400).json({
        success: false,
        message: "Account name is required.",
      });
    }

    if (!bankName) {
      return res.status(400).json({
        success: false,
        message: "Bank name is required.",
      });
    }

    if (!bankCode) {
      return res.status(400).json({
        success: false,
        message: "Bank code is required.",
      });
    }

    // ---------------------------------------------------------
    // 2. Clean values
    // ---------------------------------------------------------

    const cleanAccountNumber = String(accountNumber).trim();
    const cleanAccountName = String(accountName).trim();
    const cleanBankName = String(bankName).trim();
    const cleanBankCode = String(bankCode).trim();

    // ---------------------------------------------------------
    // 3. Validate account number
    // ---------------------------------------------------------

    if (!/^\d{10}$/.test(cleanAccountNumber)) {
      return res.status(400).json({
        success: false,
        message: "Account number must be exactly 10 digits.",
      });
    }

    // ---------------------------------------------------------
    // 4. Validate account name
    // ---------------------------------------------------------

    if (cleanAccountName.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Invalid account name.",
      });
    }

    // ---------------------------------------------------------
    // 5. Validate bank details
    // ---------------------------------------------------------

    if (cleanBankName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Invalid bank name.",
      });
    }

    if (!/^\d+$/.test(cleanBankCode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bank code.",
      });
    }

    // ---------------------------------------------------------
    // 6. Make sure school exists
    // ---------------------------------------------------------

    const school = await db.school.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: "School account not found.",
      });
    }

    // ---------------------------------------------------------
    // 7. Save bank details
    // ---------------------------------------------------------

    const updatedSchool = await db.school.update({
      where: {
        id: school.id,
      },
      data: {
        accountNumber: cleanAccountNumber,
        bankAccountName: cleanAccountName,
        bankName: cleanBankName,
        bankCode: cleanBankCode,
      },
      select: {
        id: true,
        accountNumber: true,
        bankAccountName: true,
        bankName: true,
        bankCode: true,
      },
    });

    // ---------------------------------------------------------
    // 8. Return saved details
    // ---------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Bank account details saved successfully.",
      bankAccount: updatedSchool,
    });
  } catch (error) {
    console.error(
      "Error saving school bank account:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while saving the bank account details.",
    });
  }
}