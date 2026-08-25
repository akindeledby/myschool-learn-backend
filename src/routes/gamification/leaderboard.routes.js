import express from "express";

import {
  authMiddleWare,
} from "../../middleware/auth.middleware.js";

import {
  leaderboard,
} from "../../controllers/gamification/leaderboard.controller.js";

const router = express.Router();

/**
 * Overall leaderboard.
 */
router.get("/", authMiddleWare(), leaderboard
);

export default router;