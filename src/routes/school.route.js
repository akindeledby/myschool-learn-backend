import express from "express";

import {
  getRegisteredSchools, getSchoolProfile,
} from "../controllers/school.controller.js";

import {
  authMiddleWare,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/registered-schools",
  getRegisteredSchools
);

router.get(
  "/fetchSchoolProfile",
  authMiddleWare(["SCHOOL_ADMIN"]),
  getSchoolProfile
);

export default router;