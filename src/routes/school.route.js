import express from "express";
import {
  getSchoolsForStudentRegistration,
} from "../controllers/school.controller.js";

const router = express.Router();

router.get(
  "/registration/schools",
  getSchoolsForStudentRegistration
);

export default router;