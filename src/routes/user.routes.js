import express from "express";
import { authMiddleWare } from "../middleware/auth.middleware.js";
import { 
    fetchUserProfile, updateName, 
    updatePhone, uploadProfileImageUrl, updateBankAccount, deleteAccount } from "../controllers/user.controller.js"

const router = express.Router();

router.get("/fetchUserProfile", authMiddleWare(), fetchUserProfile);
router.post("/update-name", updateName);
router.post("/update-phone", updatePhone);
router.post("/upload-image-url", uploadProfileImageUrl);
router.put("/updateBankAccount", updateBankAccount);

router.delete(
  "/deleteAccount",
  authMiddleWare(),
  deleteAccount
);

export default router;