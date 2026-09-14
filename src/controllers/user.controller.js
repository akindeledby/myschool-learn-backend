import { db } from "../../lib/db.js";


export async function fetchUserProfile(req, res) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    /*
     * =========================================================
     * 1. FETCH USER PROFILE
     * =========================================================
     *
     * Keep the original structure intact so the existing
     * frontend continues to receive:
     *
     * data.user
     * data.subscription
     * data.stats
     *
     * We are only extending the response with additional data.
     */

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        profileImageUrl: true,

        invitationCode: true,
        invitedById: true,
        invitedAt: true,
        invitationCreatedAt: true,

        createdAt: true,
        updatedAt: true,

        school: {
          select: {
            id: true,
            name: true,
          },
        },

        account: {
          select: {
            id: true,
            accountType: true,

            /*
             * Account statistics
             */
            _count: {
              select: {
                users: true,
                students: true,
                payments: true,
                subscriptions: true,
              },
            },

            /*
             * Latest subscription
             */
            subscriptions: {
              orderBy: {
                createdAt: "desc",
              },

              take: 1,

              select: {
                id: true,
                status: true,
                duration: true,
                startsAt: true,
                endsAt: true,
                amountPaid: true,
                numberOfTerms: true,
                isLifetime: true,
                createdAt: true,

                subscriptionPlan: {
                  select: {
                    id: true,
                    subscriptionPlanName: true,
                  },
                },
              },
            },
          },
        },

        /*
         * Number of users directly invited by this user
         */
        _count: {
          select: {
            invitedUsers: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    /*
     * =========================================================
     * 2. BASIC VALUES
     * =========================================================
     */

    const subscription =
      user.account?.subscriptions?.[0] ?? null;

    const totalUsersInvited =
      user._count?.invitedUsers ?? 0;

    const accountUsers =
      user.account?._count?.users ?? 0;

    const totalStudents =
      user.account?._count?.students ?? 0;

    /*
     * =========================================================
     * 3. CREATE INVITATION LINK
     * =========================================================
     *
     * Recommended .env:
     *
     * NEXT_PUBLIC_APP_URL=https://www.myschoollearn.com
     *
     * Development:
     *
     * NEXT_PUBLIC_APP_URL=http://localhost:3000
     */

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      "https://www.myschoollearn.com";

    const invitationLink = user.invitationCode
      ? `${appUrl.replace(
          /\/$/,
          ""
        )}/auth?mode=register&invitationCode=${encodeURIComponent(
          user.invitationCode
        )}`
      : null;

    /*
     * =========================================================
     * 4. FETCH INVITED USERS
     * =========================================================
     *
     * These are users whose invitedById points to this parent.
     */

    const invitedUsers = await db.user.findMany({
      where: {
        invitedById: user.id,
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        profileImageUrl: true,
        accountId: true,
        createdAt: true,

        account: {
          select: {
            id: true,

            subscriptions: {
              where: {
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

              orderBy: {
                createdAt: "desc",
              },

              take: 1,

              select: {
                id: true,
                status: true,
                createdAt: true,

                subscriptionPlan: {
                  select: {
                    subscriptionPlanName: true,
                  },
                },
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    /*
     * =========================================================
     * 5. COUNT SUBSCRIBED INVITED USERS
     * =========================================================
     */

    const subscribedInvitedUsers =
      invitedUsers.filter(
        (invitedUser) =>
          invitedUser.account?.subscriptions?.length > 0
      );

    const subscribedUsers =
      subscribedInvitedUsers.length;

    /*
     * =========================================================
     * 6. REFERRAL CONVERSION RATE
     * =========================================================
     */

    const conversionRate =
      totalUsersInvited > 0
        ? Number(
            (
              (subscribedUsers /
                totalUsersInvited) *
              100
            ).toFixed(2)
          )
        : 0;

    /*
     * =========================================================
     * 7. FETCH REFERRAL PAYMENTS
     * =========================================================
     *
     * This assumes your Payment model contains:
     *
     * referredByUserId
     * amount
     * currency
     * reference
     * status
     * createdAt
     * paidAt
     *
     * and subscriptionPlan relation.
     */

    const payments = await db.payment.findMany({
      where: {
        referredByUserId: user.id,
      },

      orderBy: {
        createdAt: "desc",
      },

      take: 50,

      select: {
        id: true,
        amount: true,
        currency: true,
        reference: true,
        status: true,
        createdAt: true,
        paidAt: true,

        subscriptionPlan: {
          select: {
            subscriptionPlanName: true,
          },
        },
      },
    });

    /*
     * =========================================================
     * 8. TOTAL REFERRAL PAYMENT VALUE
     * =========================================================
     */

    const totalReferralRevenue =
      payments.reduce((total, payment) => {
        return (
          total +
          (Number(payment.amount) || 0)
        );
      }, 0);

    /*
     * =========================================================
     * 9. FETCH COMMISSIONS
     * =========================================================
     */

    const commissions =
      await db.commission.findMany({
        where: {
          referrerUserId: user.id,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 50,

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
      });

    /*
     * =========================================================
     * 10. COMMISSION CALCULATIONS
     * ========================================================= */

    const totalEarnings =
      commissions.reduce((total, commission) => {
        return (
          total +
          (Number(
            commission.commissionAmount
          ) || 0)
        );
      }, 0);

    const pendingPayout =
      commissions
        .filter((commission) => {
          const status = String(
            commission.status || ""
          ).toUpperCase();

          return (
            status === "PENDING" ||
            status === "UNPAID"
          );
        })
        .reduce((total, commission) => {
          return (
            total +
            (Number(
              commission.commissionAmount
            ) || 0)
          );
        }, 0);

    const paidCommission =
      commissions
        .filter((commission) => {
          const status = String(
            commission.status || ""
          ).toUpperCase();

          return status === "PAID";
        })
        .reduce((total, commission) => {
          return (
            total +
            (Number(
              commission.commissionAmount
            ) || 0)
          );
        }, 0);

    /*
     * =========================================================
     * 11. COMMISSION RATE
     * =========================================================
     *
     * Use the latest commission record when available.
     *
     * Otherwise use the system default of 20%.
     */

    const commissionRate =
      commissions.length > 0
        ? Number(
            commissions[0].percentage
          ) || 0
        : 20;

    /*
     * =========================================================
     * 12. FORMAT TOTAL EARNINGS
     * ========================================================= */

    const earningsCurrency =
      commissions[0]?.currency ||
      payments[0]?.currency ||
      "NGN";

    const totalEarningsFormatted =
      new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: earningsCurrency,
      }).format(totalEarnings);

    /*
     * =========================================================
     * 13. LAST 7 DAYS REFERRAL ACTIVITY
     * ========================================================= */

    const sevenDaysAgo = new Date();

    sevenDaysAgo.setDate(
      sevenDaysAgo.getDate() - 6
    );

    sevenDaysAgo.setHours(
      0,
      0,
      0,
      0
    );

    const recentInvitedUsers =
      await db.user.findMany({
        where: {
          invitedById: user.id,

          createdAt: {
            gte: sevenDaysAgo,
          },
        },

        select: {
          id: true,
          createdAt: true,

          account: {
            select: {
              subscriptions: {
                where: {
                  status: "ACTIVE",
                },

                take: 1,

                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

    /*
     * =========================================================
     * 14. BUILD 7-DAY REGISTRATION DATA
     * ========================================================= */

    const registrations = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();

      date.setDate(
        date.getDate() - i
      );

      date.setHours(
        0,
        0,
        0,
        0
      );

      const nextDate = new Date(date);

      nextDate.setDate(
        nextDate.getDate() + 1
      );

      const dayUsers =
        recentInvitedUsers.filter(
          (invitedUser) =>
            invitedUser.createdAt >= date &&
            invitedUser.createdAt < nextDate
        );

      const daySubscriptions =
        dayUsers.filter(
          (invitedUser) =>
            invitedUser.account
              ?.subscriptions
              ?.length > 0
        );

      registrations.push({
        date: date.toISOString(),

        day: date.toLocaleDateString(
          "en-US",
          {
            weekday: "short",
          }
        ),

        invitations:
          dayUsers.length,

        registrations:
          dayUsers.length,

        subscriptions:
          daySubscriptions.length,
      });
    }

    /*
     * =========================================================
     * 15. RECENT REFERRAL ACTIVITY
     * ========================================================= */

    const activity =
      invitedUsers
        .slice(0, 10)
        .map((invitedUser) => {
          const fullName =
            `${invitedUser.firstName || ""} ${
              invitedUser.lastName || ""
            }`.trim() ||
            invitedUser.email;

          const subscribed =
            invitedUser.account
              ?.subscriptions
              ?.length > 0;

          return {
            id: invitedUser.id,

            type: subscribed
              ? "SUBSCRIPTION"
              : "REGISTRATION",

            title: subscribed
              ? "New subscription"
              : "New user registration",

            description: subscribed
              ? `${fullName} subscribed through your invitation.`
              : `${fullName} registered using your invitation.`,

            createdAt:
              invitedUser.createdAt,

            time:
              invitedUser.createdAt
                ? new Date(
                    invitedUser.createdAt
                  ).toLocaleString(
                    "en-NG"
                  )
                : null,
          };
        });

    /*
     * =========================================================
     * 16. DASHBOARD OVERVIEW
     * ========================================================= */

    const overview = {
      totalStudentsAdded:
        totalStudents,

      invitedUsers:
        totalUsersInvited,

      subscribedUsers,

      conversionRate,

      totalReferralRevenue,

      totalEarnings,

      totalEarningsFormatted,

      pendingPayout,

      paidCommission,
    };

    /*
     * =========================================================
     * 17. SUBSCRIPTION / COMMISSION SUMMARY
     * ========================================================= */

    const subscriptionsSummary = {
      planName:
        subscription
          ?.subscriptionPlan
          ?.subscriptionPlanName ||
        null,

      status:
        subscription?.status ||
        null,

      subscribedUsers,

      commissionRate,

      commissionEarned:
        totalEarnings,

      pendingPayout,

      paidCommission,

      nextPayoutDate: null,
    };

    /*
     * =========================================================
     * 18. RETURN RESPONSE
     * =========================================================
     *
     * IMPORTANT:
     *
     * The original structure is preserved:
     *
     * user
     * subscription
     * stats
     *
     * Additional dashboard sections are added underneath.
     */

    return res.status(200).json({
      success: true,

      /*
       * =======================================================
       * ORIGINAL USER OBJECT
       * =======================================================
       */

      user: {
        id: user.id,

        firstName:
          user.firstName,

        lastName:
          user.lastName,

        email:
          user.email,

        phone:
          user.phone,

        role:
          user.role,

        profileImageUrl:
          user.profileImageUrl,

        invitationCode:
          user.invitationCode,

        invitationLink,

        invitedById:
          user.invitedById,

        invitedAt:
          user.invitedAt,

        invitationCreatedAt:
          user.invitationCreatedAt,

        createdAt:
          user.createdAt,

        updatedAt:
          user.updatedAt,

        school: user.school
          ? {
              id:
                user.school.id,

              name:
                user.school.name,
            }
          : null,
      },

      /*
       * =======================================================
       * ORIGINAL SUBSCRIPTION OBJECT
       * =======================================================
       */

      subscription: subscription
        ? {
            id:
              subscription.id,

            status:
              subscription.status,

            duration:
              subscription.duration,

            startsAt:
              subscription.startsAt,

            endsAt:
              subscription.endsAt,

            amountPaid:
              subscription.amountPaid,

            numberOfTerms:
              subscription.numberOfTerms,

            isLifetime:
              subscription.isLifetime,

            createdAt:
              subscription.createdAt,

            plan:
              subscription.subscriptionPlan
                ? {
                    id:
                      subscription
                        .subscriptionPlan
                        .id,

                    name:
                      subscription
                        .subscriptionPlan
                        .subscriptionPlanName,
                  }
                : null,
          }
        : null,

      /*
       * =======================================================
       * ORIGINAL STATS OBJECT
       * =======================================================
       */

      stats: {
        totalUsersInvited,

        accountUsers,

        subscribedUsers,

        totalStudentsAdded:
          totalStudents,

        totalEarnings,

        pendingPayout,

        conversionRate,
      },

      /*
       * =======================================================
       * NEW DASHBOARD OVERVIEW
       * =======================================================
       */

      overview,

      /*
       * =======================================================
       * NEW SUBSCRIPTION / COMMISSION SUMMARY
       * =======================================================
       */

      subscriptions:
        subscriptionsSummary,

      /*
       * =======================================================
       * INVITED USERS
       * =======================================================
       */

      invitedUsers:
        invitedUsers.map(
          (invitedUser) => ({
            id:
              invitedUser.id,

            firstName:
              invitedUser.firstName,

            lastName:
              invitedUser.lastName,

            email:
              invitedUser.email,

            phone:
              invitedUser.phone,

            role:
              invitedUser.role,

            profileImageUrl:
              invitedUser.profileImageUrl,

            accountId:
              invitedUser.accountId,

            registeredAt:
              invitedUser.createdAt,

            subscribed:
              invitedUser.account
                ?.subscriptions
                ?.length > 0,

            subscriptionPlan:
              invitedUser.account
                ?.subscriptions?.[0]
                ?.subscriptionPlan
                ?.subscriptionPlanName ||
              null,
          })
        ),

      /*
       * =======================================================
       * PAYMENTS
       * =======================================================
       */

      payments:
        payments.map(
          (payment) => ({
            id:
              payment.id,

            amount:
              Number(
                payment.amount
              ) || 0,

            currency:
              payment.currency ||
              "NGN",

            reference:
              payment.reference ||
              null,

            status:
              payment.status ||
              null,

            createdAt:
              payment.createdAt,

            paidAt:
              payment.paidAt,

            planName:
              payment
                .subscriptionPlan
                ?.subscriptionPlanName ||
              null,
          })
        ),

      /*
       * =======================================================
       * COMMISSIONS
       * =======================================================
       */

      commissions:
        commissions.map(
          (commission) => ({
            id:
              commission.id,

            paymentId:
              commission.paymentId,

            percentage:
              Number(
                commission.percentage
              ) || 0,

            paymentAmount:
              Number(
                commission.paymentAmount
              ) || 0,

            commissionAmount:
              Number(
                commission
                  .commissionAmount
              ) || 0,

            currency:
              commission.currency ||
              "NGN",

            status:
              commission.status ||
              null,

            createdAt:
              commission.createdAt,

            paidAt:
              commission.paidAt,
          })
        ),

      /*
       * =======================================================
       * 7-DAY REGISTRATION DATA
       * =======================================================
       */

      registrations,

      /*
       * =======================================================
       * RECENT ACTIVITY
       * =======================================================
       */

      activity,

      /*
       * =======================================================
       * ACCOUNT INFORMATION
       * =======================================================
       */

      account: user.account
        ? {
            id:
              user.account.id,

            accountType:
              user.account.accountType,

            totalUsers:
              user.account
                ?._count?.users ||
              0,

            totalStudents:
              user.account
                ?._count?.students ||
              0,

            totalPayments:
              user.account
                ?._count?.payments ||
              0,

            totalSubscriptions:
              user.account
                ?._count
                ?.subscriptions ||
              0,
          }
        : null,
    });
  } catch (error) {
    console.error(
      "Fetch user profile error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error?.message ||
        "Failed to load user profile.",
    });
  }
}


export async function uploadProfileImageUrl(req, res) {
  try {
    const userId = req.user.userId;
    const { profileImageUrl } = req.body;

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

    const updated = await db.$transaction(async (tx) => {
        // Update the User profile image
        await tx.user.update({
          where: {
            id: userId,
          },
          data: {
            profileImageUrl,
          },
        });

        // Update the Parent profile image
        return await tx.parent.update({
          where: {
            userId,
          },
          data: {
            profileImageUrl,
          },
        });
      });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update parent image error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload parent image",
    });
  }
}


export async function updateName(req, res) {
  try {
    const userId = req.user.userId;

    const {
      firstName,
      lastName,
    } = req.body;

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

    // let updated;

    const updated = await db.$transaction(async (tx) => {
      // Update the User profile image
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          firstName,
          lastName
        },
      });

      // Update the Parent profile image
      return await tx.parent.update({
        where: {
          userId,
        },
        data: {
          firstName,
          lastName,
        },
      });
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error(
      "Save name error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update name",
    });
  }
}

export async function updatePhone(req, res) {
  try {
    const userId = req.user.userId;

    const { phone } = req.body;

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

    // let updated;

    const updated = await db.$transaction(async (tx) => {
      // Update the User profile image
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          phone,
        },
      });

      // Update the Parent profile image
      return await tx.parent.update({
        where: {
          userId,
        },
        data: {
          phone,
        },
      });
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error(
      "Update phone error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update phone",
    });
  }
}


export async function deleteAccount(req, res) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
        accountId: true,
        email: true,

        student: {
          select: {
            id: true,
            userId: true,
            parentId: true,

            parent: {
              select: {
                id: true,
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const role = user.role?.toUpperCase();

    // Only Student accounts require additional
    // ownership/parent checks.
    if (role === "STUDENT") {
      const student = user.student;

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student profile not found.",
        });
      }

      // Student belongs to a Parent/Family account.
      if (student.parent?.userId) {
        return res.status(403).json({
          success: false,
          message:
            "This student account is managed by a parent or family account. Account deletion must be managed by the parent or family account.",
        });
      }
    }

    // Only these roles are permitted to delete accounts.
    const allowedRoles = [
      "PARENT",
      "TEACHER",
      "SCHOOL",
      "STUDENT",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message:
          "Your account type is not permitted to delete an account.",
      });
    }

    // Delete the authenticated user's account.
    await db.$transaction(async (tx) => {
      await tx.user.delete({
        where: {
          id: user.id,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Account deleted successfully.",
    });
  } catch (error) {
    console.error("Delete account error:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete account.",
    });
  }
}
