import express from "express";
import { submitSpeedChallenge, getMySpeedChallengeStats } from "../controllers/speedChallenge.controller.js";
import { authMiddleWare } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/attempt", authMiddleWare(), submitSpeedChallenge);
router.get("/stats", authMiddleWare(), getMySpeedChallengeStats);

export default router;