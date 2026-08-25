import express from "express";
import multer from "multer";
import path from "path";
import { uploadPDF } from "../controllers/upload.controller.js";
import { authMiddleWare } from "../middleware/auth.middleware.js";

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    const allowedExt = [".pdf", ".doc", ".docx", ".txt"];

    const ext = path.extname(file.originalname).toLowerCase();

    // ❌ reject if both fail
    if (
      !allowedMimeTypes.includes(file.mimetype) ||
      !allowedExt.includes(ext)
    ) {
      return cb(
        new Error("Only PDF, DOC, DOCX, and TXT files are allowed"),
        false
      );
    }

    cb(null, true);
  },
});

router.post(
  "/upload",
  authMiddleWare(["SUPERADMIN", "ADMIN", "SCHOOLADMIN"]),
  upload.single("file"),
  uploadPDF
);

export default router;