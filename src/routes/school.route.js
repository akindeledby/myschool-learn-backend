import express from "express";

import {
  getRegisteredSchools, getSchoolProfile, updateSchoolProfile, updateBankAccount
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

router.put("/updateSchoolProfile", authMiddleWare(["SCHOOL_ADMIN"]), updateSchoolProfile);

router.put("/updateBankAccount", authMiddleWare(["SCHOOL_ADMIN"]), updateBankAccount);

export default router;