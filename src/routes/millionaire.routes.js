import express from "express";

import {
  saveMillionaireAttempt,
  getMyMillionaireStats,
  askAI
} from "../controllers/millionaire.controller.js";

import { authMiddleWare } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/attempt", authMiddleWare(), saveMillionaireAttempt);
router.get("/stats", authMiddleWare(), getMyMillionaireStats);
router.post("/ask-ai", authMiddleWare(), askAI);


export default router;