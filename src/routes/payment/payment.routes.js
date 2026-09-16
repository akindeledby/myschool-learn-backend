import express from "express";

import { initializeSubscriptionPaymentController } from "../../controllers/payment/initializeSubscriptionPayment.controller.js";
import { getSubscriptionsAndPaymentHistory } from "../../controllers/payment/subscriptionHistory.controller.js";
import { authMiddleWare } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post(
  "/subscription-plan",
  initializeSubscriptionPaymentController
);

router.get(
  "/subscriptions-payment-history",
  authMiddleWare(),
  getSubscriptionsAndPaymentHistory
);


export default router;