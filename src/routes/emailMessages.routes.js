import express from "express";
import { sendEmailMessage } from "../controllers/email-message.controller.js";
import {
  emailRateLimiter,
} from "../middleware/emailRateLimiter.js";

const router = express.Router();

router.post(
  "/send-message",
  emailRateLimiter,
  sendEmailMessage
);

export default router;