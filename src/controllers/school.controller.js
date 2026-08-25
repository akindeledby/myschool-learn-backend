import { db } from "../../lib/db.js";

export async function getSchoolsForStudentRegistration(req, res) {
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