
import { resolveStudent } from "../services/elevenLabs/studentResolver.service.js";

import { getAndValidateTopic } from "../services/aiTutor/tutorLessonValidation.service.js";
import { ensureTopicObjectives } from "../services/aiTutor/tutorObjectives.service.js";
import { getOrCreateTutorLessonProgress } from "../services/aiTutor/getOrCreateTutorLessonProgress.service.js";
import { createTutorLessonSession } from "../services/aiTutor/createTutorLessonSession.service.js";
import { determineNextTeachingState } from "../services/aiTutor/determineNextTeachingState.service.js";
import { getTutorStudentContext } from "../services/aiTutor/getTutorStudentContext.service.js";
import { buildLessonTeachingPrompt } from "../services/aiTutor/buildLessonTeachingPrompt.service.js";
import { streamTutorLesson } from "../services/aiTutor/streamTutorLesson.service.js";

/**
 * Starts or resumes an AI Tutor curriculum lesson.
 *
 * The frontend provides:
 *
 *    subjectId
 *    termId
 *    topicId
 *
 * The authenticated user is used to resolve the actual student.
 * We deliberately do not trust a studentId supplied by the client.
 *
 * Flow:
 *
 *    1. Resolve authenticated student.
 *    2. Validate topic against student, subject and term.
 *    3. Ensure topic objectives exist.
 *    4. Find or create student's lesson progress.
 *    5. Create a lesson session.
 *    6. Determine exactly where teaching should continue.
 *    7. Load student's Tutor context.
 *    8. Build the lesson teaching prompt.
 *    9. Start the existing streaming pipeline.
 *
 * @param {Object} req
 * @param {Object} res
 * @returns {Promise<void>}
 */
export async function startTutorLesson(req, res) {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    const { studentId } = req.query;
    
    const student = await resolveStudent({
       userId,
       studentId,
    });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Students not found",
      });
    }


     /*
    ==========================================
      SUBSCRIPTION ACCESS
    ==========================================
    */
    
    const access =
      await checkSubscriptionAccess({
        userId,
        feature:
          SUBSCRIPTION_FEATURES.AI_CHAT,
      });
    
    if (!access.success) {
      return res.status(403).json(access);
    }

    /*
     * ----------------------------------------------------------
     * 2. Validate request body
     * ----------------------------------------------------------
     */
    const {
      subjectId,
      termId,
      topicId,
    } = req.body;

    if (!subjectId || !termId || !topicId) {
      return res.status(400).json({
        success: false,
        message:
          "subjectId, termId and topicId are required.",
      });
    }


    /*
     * ----------------------------------------------------------
     * 4. Validate the selected topic
     * ----------------------------------------------------------
     *
     * getAndValidateTopic() verifies:
     *
     *    topic exists
     *    topic belongs to subject
     *    topic belongs to term
     *    topic belongs to student's class
     *    term belongs to student's class
     *    term belongs to subject
     *    topic, term and subject are internally consistent
     */
    const curriculumContext =
      await getAndValidateTopic({
        topicId,
        subjectId,
        termId,
        studentId,
      });

    const {
      topic,
    } = curriculumContext;

    /*
     * ----------------------------------------------------------
     * 5. Ensure TopicObjective records exist
     * ----------------------------------------------------------
     *
     * If the topic already has objectives, they are reused.
     *
     * If objectives do not exist, the objective generation
     * service creates them from the topic's lesson contents.
     */
    const objectives =
      await ensureTopicObjectives(topicId);

    /*
     * Make sure objective generation actually produced
     * usable objectives.
     */
    if (
      !Array.isArray(objectives) ||
      objectives.length === 0
    ) {
      const error = new Error(
        "No lesson objectives are available for this topic."
      );

      error.statusCode = 500;

      throw error;
    }

    /*
     * ----------------------------------------------------------
     * 6. Find or create lesson progress
     * ----------------------------------------------------------
     *
     * Because TutorLessonProgress has:
     *
     *    @@unique([studentId, topicId])
     *
     * the same student's progress for the same topic is reused
     * whenever the student returns to the topic.
     */
    const lessonProgress =
      await getOrCreateTutorLessonProgress({
        studentId,
        topicId,
      });

    /*
     * ----------------------------------------------------------
     * 7. Create a new lesson session
     * ----------------------------------------------------------
     *
     * A lesson progress represents the long-lived state of
     * learning the topic.
     *
     * A lesson session represents this particular visit.
     */
    const session =
      await createTutorLessonSession({
        studentId,
        lessonProgressId:
          lessonProgress.id,
      });

    /*
     * ----------------------------------------------------------
     * 8. Determine where teaching should continue
     * ----------------------------------------------------------
     *
     * This is where the Tutor decides whether to:
     *
     *    start the first objective
     *    resume an objective
     *    move to the next incomplete objective
     *    resume from a previous step
     *    recognize that the lesson is complete
     */
    const teachingState =
      await determineNextTeachingState({
        lessonProgress,
        objectives,
      });

    /*
     * ----------------------------------------------------------
     * 9. Handle an already completed lesson
     * ----------------------------------------------------------
     *
     * There is no reason to start Gemini streaming when every
     * objective has already been completed.
     */
    if (teachingState.isComplete) {
      return res.status(200).json({
        success: true,

        status: "COMPLETED",

        message:
          "This lesson has already been completed.",

        lesson: {
          topicId: topic.id,
          topicTitle: topic.title,

          progressPercent:
            teachingState.progressPercent,

          completedObjectives:
            teachingState.completedObjectives,

          totalObjectives:
            teachingState.totalObjectives,
        },

        lessonProgress: {
          id: teachingState.lessonProgress.id,
          status:
            teachingState.lessonProgress.status,
          progressPercent:
            teachingState.lessonProgress
              .progressPercent,
        },
      });
    }

    /*
     * ----------------------------------------------------------
     * 10. Load student's general Tutor context
     * ----------------------------------------------------------
     *
     * This includes:
     *
     *    student identity
     *    learning profile
     *    learning insight
     *    general Tutor memory
     *    topic progress
     *    recent Tutor sessions
     */
    const tutorStudentContext =
      await getTutorStudentContext(
        studentId
      );

    /*
     * ----------------------------------------------------------
     * 11. Build the curriculum teaching prompt
     * ----------------------------------------------------------
     */
    const prompt =
      await buildLessonTeachingPrompt({
        student:
          tutorStudentContext.student,

        topic,

        objectives,

        lessonProgress:
          teachingState.lessonProgress,

        teachingState,

        learningProfile:
          tutorStudentContext
            .learningProfile,

        learningInsight:
          tutorStudentContext
            .learningInsight,
      });

    /*
     * ----------------------------------------------------------
     * 12. Start streaming
     * ----------------------------------------------------------
     *
     * streamTutorLesson() is responsible for:
     *
     *    Gemini streaming
     *    sentence extraction
     *    TTS generation
     *    audio streaming
     *    image handling
     *    TutorMessage persistence
     *    lesson session association
     *    lesson state updates
     *
     * The controller does not perform those operations itself.
     */
    return await streamTutorLesson({
      req,
      res,

      studentId,

      topic,

      session,

      lessonProgress:
        teachingState.lessonProgress,

      teachingState,

      prompt,
    });
  } catch (error) {
    /*
     * ----------------------------------------------------------
     * Central error handling
     * ----------------------------------------------------------
     */

    console.error(
      "startTutorLesson error:",
      error
    );

    /*
     * Once SSE headers have been sent, Express cannot safely
     * send a normal JSON response.
     *
     * streamTutorLesson() should therefore handle streaming
     * errors after the stream has started.
     */
    if (res.headersSent) {
      return;
    }

    const statusCode =
      Number.isInteger(error?.statusCode)
        ? error.statusCode
        : 500;

    return res.status(statusCode).json({
      success: false,

      message:
        error?.message ||
        "Unable to start the Tutor lesson.",
    });
  }
}
