import express from "express";
import { getStudentProfile, fetchStudent, updateStudentSubjects,
  saveTestScore, saveExamScore, 
  fetchStudentScores, getMyAchievements,   
  updateName, updatePhone,
  updateSchool, uploadStudentImageUrl,
  promoteChild, getLessonNote, saveLessonNote,
  deleteAccount, getStudentAcademicReport } from "../controllers/student.controller.js"
import { authMiddleWare } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/fetchStudentProfile", fetchStudent);
router.post("/update-name", updateName);
router.post("/update-phone", updatePhone);
router.post("/update-school-name", updateSchool);
router.post("/upload-image-url", uploadStudentImageUrl);
router.post("/student-scores/test", saveTestScore);
router.post("/student-scores/exam", saveExamScore);
router.get("/fetch-scores", fetchStudentScores);
router.get("/achievements", authMiddleWare(), getMyAchievements);
router.get("/profile", authMiddleWare(), getStudentProfile);
router.put("/promote-child", authMiddleWare(), promoteChild);
router.get("/lesson-notes/get/:topicId", authMiddleWare(), getLessonNote);
router.put("/lesson-notes/save/:topicId", authMiddleWare(), saveLessonNote);
router.delete("/deleteAccount", authMiddleWare(), deleteAccount);

router.put("/update-subjects", authMiddleWare(), updateStudentSubjects);

router.get("/academic-report", authMiddleWare(), getStudentAcademicReport);


export default router;