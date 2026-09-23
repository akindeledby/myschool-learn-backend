import express from "express";

import {
  handleOfflineSync,
  handleOfflineQuizAttemptSync,
} from "../controllers/offline/offline.controller.js";

import { authMiddleWare } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post(
  "/sync",
  authMiddleWare(),
  handleOfflineSync
);

router.post(
  "/quiz-attempt/sync",
  authMiddleWare(),
  handleOfflineQuizAttemptSync
);

export default router;