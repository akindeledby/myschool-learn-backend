import express from "express";

import {
  verifySubscriptionPayment,
} from "../controllers/payment/verifySubscriptionPayment.controller.js";

import {
  paystackWebhook,
} from "../controllers/payment/paystackWebhook.controller.js";

const router = express.Router();

router.get(
  "/",
  verifySubscriptionPayment
);

router.post(
  "/subscription-plan/webhook",
  express.raw({
    type: "application/json",
  }),
  paystackWebhook
);

export default router;