import express from "express";

import {
  authMiddleWare,
} from "../../middleware/auth.middleware.js";

import {
  getAchievements,
} from "../../controllers/gamification/achievements.controller.js";

const router = express.Router();

/**
 * GET /api/gamification/achievements
 *
 * Returns all achievements earned by
 * the currently selected student.
 */
router.get(
  "/",
  authMiddleWare(),
  getAchievements
);

export default router;