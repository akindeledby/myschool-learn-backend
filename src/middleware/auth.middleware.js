import jwt from "jsonwebtoken";

export function authMiddleWare(
  roles = []
) {
  return (req, res, next) => {
    try {
      // console.log(
      //   "AUTH MIDDLEWARE START"
      // );

      const authHeader =
        req.headers.authorization;

      // console.log(
      //   "AUTH HEADER:",
      //   authHeader
      // );

      if (!authHeader) {
        return res.status(401).json({
          error:
            "Unauthorized: No token",
        });
      }

      if (
        !authHeader.startsWith(
          "Bearer "
        )
      ) {
        return res.status(401).json({
          error:
            "Unauthorized: Invalid format",
        });
      }

      const accessToken =
        authHeader.split(" ")[1];

      // console.log(
      //   "TOKEN EXTRACTED"
      // );

      const decoded = jwt.verify(
        accessToken,
        process.env.JWT_SECRET
      );

      // console.log(
      //   "TOKEN DECODED:",
      //   decoded
      // );

      req.user = decoded;

      // console.log(
      //   "AUTH USER:",
      //   req.user
      // );

      // Optional role guard
      if (
        roles.length > 0 &&
        !roles.includes(decoded.role)
      ) {
        return res.status(403).json({
          error:
            "Forbidden: Access denied",
        });
      }

      // console.log(
      //   "AUTH MIDDLEWARE END"
      // );

      next();

    } catch (error) {
      console.error(
        "AUTH MIDDLEWARE ERROR:",
        error
      );

      if (
        error.name ===
        "TokenExpiredError"
      ) {
        return res.status(401).json({
          error: "Token expired; Please sign in again.",
        });
      }

      if (
        error.name ===
        "JsonWebTokenError"
      ) {
        return res.status(401).json({
          error: "Invalid token",
        });
      }

      return res.status(500).json({
        error: "Server error",
      });
    }
  };
}
