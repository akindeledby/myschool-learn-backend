import express from "express";
import { explainAssignment } from "../controllers/assignment.controller.js";
import { upload } from "../middleware/upload.js";

const router =
  express.Router();

router.post(
  "/assignment-helper", upload.single("file"), explainAssignment);

export default router;