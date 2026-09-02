import express from "express";
import { authMiddleWare } from "../middleware/auth.middleware.js";
import { getClasses, 
    getClassSubjectsVideo,
    getClassSubjectsTutor, 
    getTopicsBySubject, 
    getVideoLesson, 
    getQuestionsByTopics, 
    getQuestionsBySubject, 
    getTermsBySubject, 
    getTopicsByTerm,
    getQuestionsByTerms,
    downloadVideo,
} from "../controllers/class.controller.js";


const router = express.Router();

router.get("/", getClasses);
router.get("/subjects-video", authMiddleWare(), getClassSubjectsVideo);
router.get("/subjects-tutor", authMiddleWare(), getClassSubjectsTutor);
router.get("/topics/:subjectId", authMiddleWare(), getTopicsBySubject);
router.get("/video/:topicId", authMiddleWare(), getVideoLesson);
router.post("/topics/questions", authMiddleWare(), getQuestionsByTopics);
router.get("/subjects/:subjectId/questions", getQuestionsBySubject);
router.get("/terms/:subjectId", authMiddleWare(), getTermsBySubject);
router.get("/topics/terms/:termId", authMiddleWare(), getTopicsByTerm);
router.post("/terms/questions", authMiddleWare(), getQuestionsByTerms);
router.get("/video/:topicId/download", authMiddleWare(), downloadVideo);

export default router;