import { db } from "../../lib/db.js";

export async function tenantMiddleware(
  req,
  res,
  next
) {
  try {

    const subdomain =
      req.headers["x-school"];

    // PUBLIC USERS
    if (
      !subdomain ||
      subdomain === "public"
    ) {
      req.school = null;

      return next();
    }

    // CUSTOM SCHOOL
    const school =
      await db.school.findUnique({
        where: {
          subdomain,
        },
      });

    if (!school) {
      return res.status(404).json({
        error: "School not found",
      });
    }

    // Attach school info
    req.school = {
      id: school.id,
      name: school.name,
      subdomain:
        school.subdomain,
    };
    
    next();

  } catch (error) {
    console.error(
      "Tenant middleware error:",
      error
    );

    return res.status(500).json({
      error:
        "Internal server error",
    });
  }
}
