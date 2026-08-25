import express from "express";
import { generateLessonHandler, getTopicStatus } from "../controllers/lesson.controller.js";
import { authMiddleWare } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/generate/:id/status", getTopicStatus);
router.post("/generate", authMiddleWare(["SCHOOLADMIN", "ADMIN", "SUPERADMIN"]), generateLessonHandler);

export default router;