import express from "express";
import { register, login, setUserRole, getMe, resetPassword, forgotPassword, verifyPasswordCode, googleAuth } from "../controllers/auth.controller.js";
import { authMiddleWare } from "../middleware/auth.middleware.js";

const router = express.Router();


router.post("/google", googleAuth);
router.post("/register", register);
router.post("/login", login);
router.post("/setUserRole", authMiddleWare(), setUserRole);
router.get("/get-me", authMiddleWare(), getMe);
router.post("/forgot-password", forgotPassword);
router.post("/verify-password-code", verifyPasswordCode);
router.post("/reset-password", resetPassword);

export default router;