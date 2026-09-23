import express from "express";
import { getStudentProfile, fetchStudentProfile, updateStudentSubjects,
  saveTestScore, saveExamScore, 
  fetchStudentScores, getMyAchievements,   
  updateName, updatePhone,
  updateSchool, uploadStudentImageUrl,
  promoteChild, getLessonNote, saveLessonNote,
  deleteAccount, getStudentAcademicReport } from "../controllers/student.controller.js"
import { authMiddleWare } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/fetchStudentProfile", authMiddleWare(), fetchStudentProfile);
router.post("/update-name", authMiddleWare(), updateName);
router.post("/update-phone", authMiddleWare(), updatePhone);
router.post("/update-school-name", authMiddleWare(), updateSchool);
router.post("/upload-image-url", authMiddleWare(), uploadStudentImageUrl);
router.post("/student-scores/test", authMiddleWare(), saveTestScore);
router.post("/student-scores/exam", authMiddleWare(), saveExamScore);
router.get("/fetch-scores", authMiddleWare(), fetchStudentScores);
router.get("/achievements", authMiddleWare(), getMyAchievements);
router.get("/profile", authMiddleWare(), getStudentProfile);
router.put("/promote-child", authMiddleWare(), promoteChild);
router.get("/lesson-notes/get/:topicId", authMiddleWare(), getLessonNote);
router.put("/lesson-notes/save/:topicId", authMiddleWare(), saveLessonNote);
router.delete("/deleteAccount", authMiddleWare(), deleteAccount);

router.put("/update-subjects", authMiddleWare(), updateStudentSubjects);

router.get("/academic-report", authMiddleWare(), getStudentAcademicReport);


export default router;