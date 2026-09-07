import express from "express";

import {
  fetchPricPageSubscriptionPlans
} from "../controllers/pricePageSubscriptionPlans.controller.js";

const router = express.Router();

router.get("/subscription-plans", fetchPricPageSubscriptionPlans);


export default router;