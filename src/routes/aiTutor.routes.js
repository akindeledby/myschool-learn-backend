import express from "express";
import multer from "multer";

import {
  getConversations,
  getConversationById,
  deleteConversationById,
  chatWithTutorStream,
  startTutorLesson,
  transcribeTutorAudioController
} from "../controllers/aiTutor.controller.js";

import {
  authMiddleWare,
} from "../middleware/auth.middleware.js";

const router =
  express.Router();

router.post(
  "/chat-stream",
  authMiddleWare(),
  chatWithTutorStream
);

router.post(
  "/start-lesson",
  authMiddleWare(),
  startTutorLesson
);

router.get(
  "/conversations",
  authMiddleWare(),
  getConversations
);

router.get(
  "/conversations/:id",
  authMiddleWare(),
  getConversationById
);

router.delete(
  "/conversations/:id",
  authMiddleWare(),
  deleteConversationById
);

const upload =
  multer({
    dest: "uploads/audio-transcribe/",
    limits: {
      fileSize:
        10 * 1024 * 1024,
    },
  });

router.post(
  "/audio-transcribe",
  authMiddleWare(),
  upload.single("audio"),
  transcribeTutorAudioController
);

export default router;


