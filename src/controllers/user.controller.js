import { db } from "../../lib/db.js";


export async function fetchUserProfile(req, res) {
  try {
    const userId = req.user.userId;

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
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        profileImageUrl: true,

        invitationCode: true,
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

            _count: {
              select: {
                users: true,
              },
            },
          },
        },

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

    const subscription = user.account?.subscriptions?.[0] ?? null;

    const totalUsersInvited = user._count?.invitedUsers ?? 0;

    return res.status(200).json({
      success: true,

      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImageUrl: user.profileImageUrl,

        invitationCode: user.invitationCode,
        invitedAt: user.invitedAt,
        invitationCreatedAt: user.invitationCreatedAt,

        createdAt: user.createdAt,
        updatedAt: user.updatedAt,

        school: user.school
          ? {
              id: user.school.id,
              name: user.school.name,
            }
          : null,
      },

      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            duration: subscription.duration,
            startsAt: subscription.startsAt,
            endsAt: subscription.endsAt,
            amountPaid: subscription.amountPaid,
            numberOfTerms: subscription.numberOfTerms,
            isLifetime: subscription.isLifetime,
            createdAt: subscription.createdAt,

            plan: subscription.subscriptionPlan
              ? {
                  id: subscription.subscriptionPlan.id,
                  name: subscription.subscriptionPlan.subscriptionPlanName,
                }
              : null,
          }
        : null,

      stats: {
        totalUsersInvited,
        accountUsers: user.account?._count?.users ?? 0,
      },
    });
  } catch (error) {
    console.error("Fetch user profile error:", error);

    return res.status(500).json({
      success: false,
      message:
        error?.message || "Failed to load user profile.",
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
