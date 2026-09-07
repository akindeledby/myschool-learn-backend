import express from "express";
import { authMiddleWare } from "../../middleware/auth.middleware.js";
import { uploadPDF } from "../../controllers/upload.controller.js";
import { preRegisterSchool } from "../../controllers/admin/admin.controller.js";

const router = express.Router();

// Only ADMIN can access
router.get("/dashboard", authMiddleWare(["ADMIN"]), (req, res) => {
  res.json({
    message: "Welcome Admin",
    user: req.user,
  });
});
router.post("/upload", authMiddleWare(), uploadPDF);
router.post(
  "/admin/onboard",
  authMiddleWare(),
  preRegisterSchool
);

export default router;