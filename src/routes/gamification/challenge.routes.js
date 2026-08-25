import express from "express";

import { authMiddleWare }
  from "../../middleware/auth.middleware.js";

import {
  getChallenges,
} from "../../controllers/gamification/challenge.controller.js";

const router = express.Router();

router.get("/", authMiddleWare(), getChallenges);

export default router;