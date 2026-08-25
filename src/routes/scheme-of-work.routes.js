import express from "express";
import { getSchemeOfWorkStatus, 
    fetchClassesAndSubjects, 
    fetchTopicsPerSubject } from "../controllers/scheme-of-work.controller.js";

const router = express.Router();

router.get("/:id/status", getSchemeOfWorkStatus);
router.get("/fetchClassesAndSubjects", fetchClassesAndSubjects);
router.get("/fetchTopicsPerSubject/:id", fetchTopicsPerSubject);

export default router;