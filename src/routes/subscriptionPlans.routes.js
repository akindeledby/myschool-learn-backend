import express from "express";

import { authMiddleWare }
  from "../middleware/auth.middleware.js";

import {
  fetchSubscriptionPlans, fetchPricPageSubscriptionPlans
} from "../controllers/subscriptionPlans.controller.js";

const router = express.Router();

router.get(
  "/user",
  authMiddleWare(),
  fetchSubscriptionPlans
);

router.get("/price-page", fetchPricPageSubscriptionPlans);


export default router;