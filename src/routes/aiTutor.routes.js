import express from "express";

import {
  getConversations,
  getConversationById,
  deleteConversationById,
  chatWithTutorStream,
  startTutorLesson
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


export default router;