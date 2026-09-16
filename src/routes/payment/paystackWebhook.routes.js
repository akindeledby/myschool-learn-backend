import express from "express";

import {
  paystackWebhookController,
} from "../../controllers/payment/paystackWebhook.controller.js";

const router = express.Router();

router.post("/", paystackWebhookController);

export default router;