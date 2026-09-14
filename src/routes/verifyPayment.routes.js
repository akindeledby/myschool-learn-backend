import express from "express";

import {
  verifyPaymentController,
} from "../controllers/payment/verifyPayment.controller.js";

import {
  authMiddleWare,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/",
  authMiddleWare(),
  verifyPaymentController
);

export default router;
