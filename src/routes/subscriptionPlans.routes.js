import express from "express";

import { authMiddleWare }
  from "../middleware/auth.middleware.js";

import {
  fetchSubscriptionPlans,
} from "../controllers/subscriptionPlans.controller.js";

const router = express.Router();

router.get(
  "/",
  authMiddleWare(),
  fetchSubscriptionPlans
);

export default router;