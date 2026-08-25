import { db } from "../../lib/db.js";

export async function preRegisterSchool(req, res) {
  try {
    // ==========================================
    // AUTHENTICATION
    // ==========================================

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // ==========================================
    // VERIFY CURRENT USER
    // ==========================================

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "User account not found.",
      });
    }

    // ==========================================
    // IMPORTANT
    // Replace this role with whatever role your
    // platform administrator actually uses.
    // ==========================================

    if (user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message:
          "Only platform administrators can register schools.",
      });
    }

    // ==========================================
    // REQUEST BODY
    // ==========================================

    const {
      name,
      schoolEmail,
      address,
      website,
      subdomain,
    } = req.body;

    // ==========================================
    // VALIDATION
    // ==========================================

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "School name is required.",
      });
    }

    const schoolName = name.trim();

    const normalizedEmail =
      typeof schoolEmail === "string" &&
      schoolEmail.trim()
        ? schoolEmail.trim().toLowerCase()
        : null;

    const normalizedAddress =
      typeof address === "string" &&
      address.trim()
        ? address.trim()
        : null;

    const normalizedWebsite =
      typeof website === "string" &&
      website.trim()
        ? website.trim()
        : null;

    const normalizedSubdomain =
      typeof subdomain === "string" &&
      subdomain.trim()
        ? subdomain
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
        : null;

    // ==========================================
    // SUBDOMAIN VALIDATION
    // ==========================================

    if (
      subdomain &&
      !normalizedSubdomain
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid school subdomain is required.",
      });
    }

    // ==========================================
    // CHECK DUPLICATE SCHOOL NAME
    // ==========================================

    const existingSchool =
      await db.school.findFirst({
        where: {
          name: {
            equals: schoolName,
            mode: "insensitive",
          },
        },

        select: {
          id: true,
          name: true,
          status: true,
        },
      });

    if (existingSchool) {
      return res.status(409).json({
        success: false,
        message:
          "A school with this name already exists.",
      });
    }

    // ==========================================
    // CHECK SUBDOMAIN
    // ==========================================

    if (normalizedSubdomain) {
      const existingSubdomain =
        await db.school.findUnique({
          where: {
            subdomain: normalizedSubdomain,
          },

          select: {
            id: true,
            name: true,
          },
        });

      if (existingSubdomain) {
        return res.status(409).json({
          success: false,
          message:
            "This school subdomain is already in use.",
        });
      }
    }

    // ==========================================
    // CREATE SCHOOL
    // ==========================================
    //
    // IMPORTANT:
    //
    // userId is deliberately NOT supplied here.
    //
    // The school is only being pre registered.
    // The eventual school administrator will be
    // connected later.
    //
    // ==========================================

    const school = await db.school.create({
      data: {
        name: schoolName,

        schoolEmail:
          normalizedEmail,

        address:
          normalizedAddress,

        website:
          normalizedWebsite,

        subdomain:
          normalizedSubdomain,

        status: "PRE_REGISTERED",

        userId: null,
      },

      select: {
        id: true,
        name: true,
        schoolEmail: true,
        address: true,
        website: true,
        subdomain: true,
        status: true,
        userId: true,
        createdAt: true,
      },
    });

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(201).json({
      success: true,

      message:
        "School successfully pre registered.",

      data: {
        school,
      },
    });
  } catch (error) {
    console.error(
      "preRegisterSchool error:",
      error
    );

    // ==========================================
    // PRISMA UNIQUE CONSTRAINT
    // ==========================================

    if (error?.code === "P2002") {
      return res.status(409).json({
        success: false,
        message:
          "A school with one of these unique details already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to register school.",
    });
  }
}

export async function resetSubjectRanking({
  studentId,
  subjectId,
}) {
  return await db.subjectRanking.update({
    where: {
      studentId_subjectId: {
        studentId,
        subjectId,
      },
    },

    data: {
      xp: 0,
      level: 1,
    },
  });
}