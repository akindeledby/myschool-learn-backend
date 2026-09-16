import express from "express";

import {
  flutterwaveWebhookController,
} from "../../controllers/payment/flutterwaveWebhook.controller.js";

const router = express.Router();

router.post(
  "/",
  flutterwaveWebhookController
);

export default router;