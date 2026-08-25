import express from "express";
import { getProfiles, selectProfile, fetchChildrenData, 
        addChild, promoteChild, removeChild, setProfilePassword,
        requestParentProfilePasswordReset, resetParentProfilePassword, updateChildPassword,
        getStudentAcademicReport } from "../controllers/parent.controller.js"
import { authMiddleWare } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/profiles", authMiddleWare(), getProfiles)
router.post("/select-profile", authMiddleWare(), selectProfile);
router.get("/fetch-children-data", authMiddleWare(), fetchChildrenData);
router.post("/add-child", authMiddleWare(), addChild);
router.put("/promote-child", authMiddleWare(), promoteChild);
router.delete("/remove-child/:id", authMiddleWare(), removeChild);

router.post("/set-profile-password", authMiddleWare(), setProfilePassword);
router.post("/request-password-reset", authMiddleWare(), requestParentProfilePasswordReset);
router.post("/confirm-reset-profile-password", authMiddleWare(), resetParentProfilePassword);

router.put(
  "/update-child-password/:studentId",
  authMiddleWare(),
  updateChildPassword
);

router.get(
  "/students/:studentId/academic-report",
  authMiddleWare(),
  getStudentAcademicReport
);


export default router;