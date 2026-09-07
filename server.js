import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import authRoutes from "./src/routes/auth.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import adminRoutes from "./src/routes/admin/admin.routes.js";
import schoolRoutes from "./src/routes/school.route.js";
import parentRoutes from "./src/routes/parent.routes.js";
import studentRoutes from "./src/routes/student.routes.js";

import uploadRoutes from "./src/routes/upload.routes.js";
import lessonRoutes from "./src/routes/lesson.routes.js";

import schemeOfWorkRoutes from "./src/routes/scheme-of-work.routes.js";
import classRoutes from "./src/routes/class.routes.js";
import assignmentRoutes from "./src/routes/assignment.routes.js";
import millionaireRoutes from "./src/routes/millionaire.routes.js";

import aiTutorRoutes from "./src/routes/aiTutor.routes.js";
import speedChallengeRoutes from "./src/routes/speedChallenge.routes.js";
import leaderboardRoutes from "./src/routes/gamification/leaderboard.routes.js";
import achievementRoutes from "./src/routes/gamification/achievements.routes.js";
import challengeRoutes from "./src/routes/gamification/challenge.routes.js";
import subscriptionPlanRoutes from "./src/routes/subscriptionPlans.routes.js";
import pricePageSubscriptionPlanRoutes from "./src/routes/pricePageSubscriptionPlans.route.js"
import paymentRoutes from "./src/routes/payment.routes.js";
import verifyPaymentRoutes from "./src/routes/verifyPayment.routes.js";

import { tenantMiddleware } from "./src/middleware/tenantMiddleware.js";
import { authMiddleWare } from "./src/middleware/auth.middleware.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());


// ===================== PUBLIC AUTH ROUTES =====================
// No tenant middleware, no auth middleware here
// ===================== HEALTH CHECK =====================
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/price-page", pricePageSubscriptionPlanRoutes);
app.use("/api/verify-payment", verifyPaymentRoutes);

app.use((req, res, next) => {
  next();
});

// ===================== GLOBAL MIDDLEWARE FOR PROTECTED ROUTES =====================
app.use(tenantMiddleware);
app.use(authMiddleWare());


// ===================== PROTECTED ROUTES =====================
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/school", schoolRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/student", studentRoutes);
app.use("/api", uploadRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/scheme-of-work", schemeOfWorkRoutes);
app.use("/api/classes", classRoutes);
app.use("/api", assignmentRoutes);
app.use("/api/millionaire", millionaireRoutes);
app.use("/api/speed-challenge", speedChallengeRoutes);
app.use("/api/gamification/leaderboard", leaderboardRoutes);

app.use("/api/ai-tutor", aiTutorRoutes);
app.use("/api/gamification/achievements", achievementRoutes);
app.use("/api/gamification/challenges", challengeRoutes);
app.use("/api/subscription-plans", subscriptionPlanRoutes);
app.use("/api/payment", paymentRoutes);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});