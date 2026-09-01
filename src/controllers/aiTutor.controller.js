import { db } from "../../lib/db.js";
import { buildTutorPrompt } from "../services/elevenLabs/tutorPrompt.service.js";
import { verifyConversationOwnership } from "../services/elevenLabs/conversationOwnership.service.js";
import { resolveStudent } from "../services/elevenLabs/studentResolver.service.js";
import { createConversation, saveMessage, getConversation, getStudentConversations } from "../services/elevenLabs/conversation.service.js";
import { buildTutorContext } from "../services/elevenLabs/tutorContext.service.js";
import { checkSubscriptionAccess } from "../services/subscription/subscription.access.js";
import { SUBSCRIPTION_FEATURES } from "../services/subscription/subscription.constants.js";
import { resolveTutorConversationContext } from "../services/aiTutor/resolveTutorConversationContext.service.js";
import { continueTutorLessonContext } from "../services/aiTutor/continueTutorLessonContext.service.js"
import { startTutorLessonFromContext } from "../services/aiTutor/startTutorLessonFromContext.service.js"
import { handleCompletedTutorLesson } from "../services/aiTutor/handleCompletedTutorLesson.js"
import { continueCompletedTutorLesson } from "../services/aiTutor/continueCompletedTutorLesson.js"

import { getAndValidateTopic } from "../services/aiTutor/tutorLessonValidation.service.js";
import { ensureTopicObjectives } from "../services/aiTutor/tutorObjectives.service.js";
import { getOrCreateTutorLessonProgress } from "../services/aiTutor/getOrCreateTutorLessonProgress.service.js";
import { createTutorLessonSession } from "../services/aiTutor/createTutorLessonSession.service.js";
import { determineNextTeachingState } from "../services/aiTutor/determineNextTeachingState.service.js";
import { getTutorStudentContext } from "../services/aiTutor/getTutorStudentContext.service.js";
import { buildLessonTeachingPrompt } from "../services/aiTutor/buildLessonTeachingPrompt.service.js";
import { streamTutorLesson } from "../services/aiTutor/streamTutorLesson.service.js";
import { verifyTutorLessonSession } from "../services/aiTutor/lesson/verifyTutorLessonSession.service.js";
import { streamTutorConversationResponse } from "../services/aiTutor/streamTutorConversationResponse.service.js";



export async function chatWithTutorStream(req, res) {
  try {
    /*
    ============================================================
    AUTHENTICATION
    ============================================================
    */

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    /*
    ============================================================
    REQUEST DATA
    ============================================================
    */

    const {
      studentId,
      conversationId: requestedConversationId,
      lessonSessionId,
      message,
    } = req.body;

    // console.log(
    //   "[TutorStream] Request:",
    //   {
    //     studentId,
    //     conversationId:
    //       requestedConversationId,
    //     lessonSessionId,
    //   }
    // );

    /*
    ============================================================
    VALIDATE MESSAGE
    ============================================================
    */

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
      });
    }

    const normalizedMessage =
      message.trim();

    /*
    ============================================================
    RESOLVE STUDENT
    ============================================================
    */

    const student =
      await resolveStudent({
        userId,
        studentId,
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    /*
    ============================================================
    SUBSCRIPTION ACCESS
    ============================================================
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
    ============================================================
    RESOLVE TUTOR CONTEXT
    ============================================================
    */

    // console.log(
    //   "[TutorStream] Resolving Tutor conversation context..."
    // );

    const tutorContext =
      await resolveTutorConversationContext({
        student,

        message:
          normalizedMessage,

        conversationId:
          requestedConversationId ||
          null,

        lessonSessionId:
          lessonSessionId ||
          null,
      });

    // console.log(
    //   "[TutorStream] Tutor context resolved:",
    //   tutorContext?.type
    // );

    /*
    ============================================================
    RESOLVE CONVERSATION
    ============================================================
    */

    const resolvedConversationId =
      tutorContext?.conversationId ||
      null;

    let conversation = null;
    let isNewConversation = false;

    /*
    ------------------------------------------------------------
    EXISTING CONVERSATION
    ------------------------------------------------------------
    */

    if (resolvedConversationId) {
      // console.log(
      //   "[TutorStream] Verifying conversation ownership..."
      // );

      const ownedConversation =
        await verifyConversationOwnership({
          userId,

          studentId:
            student.id,

          conversationId:
            resolvedConversationId,
        });

      if (!ownedConversation) {
        return res.status(403).json({
          success: false,
          message: "Access denied.",
        });
      }

      conversation =
        await getConversation(
          resolvedConversationId
        );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message:
            "Conversation not found.",
        });
      }

      // console.log(
      //   "[TutorStream] Existing conversation:",
      //   conversation.id
      // );
    }

    /*
    ------------------------------------------------------------
    NEW CONVERSATION
    ------------------------------------------------------------
    */

    if (!conversation) {
      const title =
        normalizedMessage.length > 50
          ? `${normalizedMessage.substring(
              0,
              50
            )}...`
          : normalizedMessage;

      // console.log(
      //   "[TutorStream] Creating new conversation..."
      // );

      conversation =
        await createConversation({
          studentId:
            student.id,

          title,
        });

      isNewConversation = true;

      if (!conversation?.id) {
        throw new Error(
          "Unable to create the Tutor conversation."
        );
      }

      // console.log(
      //   "[TutorStream] Conversation created:",
      //   conversation.id
      // );
    }

    /*
    ============================================================
    VERIFY EXPLICIT LESSON SESSION
    ============================================================
    *
    * The context resolver already verifies the relationship
    * between the supplied lesson session, student and
    * conversation.
    *
    * We perform the ownership check once more here before
    * saving the incoming message.
    */

    let verifiedLessonSession = null;

    if (lessonSessionId) {
      // console.log(
      //   "[TutorStream] Verifying explicit lesson session..."
      // );

      verifiedLessonSession =
        await verifyTutorLessonSession({
          lessonSessionId,

          studentId:
            student.id,

          conversationId:
            conversation.id,
        });

      if (!verifiedLessonSession) {
        return res.status(403).json({
          success: false,
          message:
            "Invalid or unauthorized lesson session.",
        });
      }
    }

    /*
    ============================================================
    SAVE USER MESSAGE
    ============================================================
    *
    * The controller saves the incoming user message exactly
    * once.
    *
    * The unified streaming service must never save it again.
    */

    // console.log(
    //   "[TutorStream] Saving USER message..."
    // );

    const savedUserMessage =
      await saveMessage({
        conversationId:
          conversation.id,

        lessonSessionId:
          verifiedLessonSession?.id ||
          null,

        role:
          "user",

        content:
          normalizedMessage,
      });

    // console.log(
    //   "[TutorStream] USER message saved:",
    //   savedUserMessage?.id ||
    //     "(no id returned)"
    // );

    /*
    ============================================================
    REFRESH CONVERSATION
    ============================================================
    *
    * This ensures the newly saved user message is included in
    * the conversation data supplied to downstream services.
    */

    conversation =
      await getConversation(
        conversation.id
      );

    if (!conversation) {
      throw new Error(
        "Conversation could not be loaded after saving the user message."
      );
    }

    /*
    ============================================================
    COMPLETED LESSON
    ============================================================
    *
    * A completed lesson is no longer an active lesson stream.
    *
    * continueCompletedTutorLesson uses the unified conversation
    * streaming service for the actual response.
    */

    if (
      tutorContext.type ===
      "COMPLETED_LESSON"
    ) {
      // console.log(
      //   "[TutorStream] Routing to completed lesson..."
      // );

      return await continueCompletedTutorLesson({
        req,
        res,

        student,

        topic:
          tutorContext.topic,

        objectives:
          tutorContext.objectives ||
          [],

        lessonProgress:
          tutorContext.lessonProgress,

        teachingState: !tutorContext.isCompleted === true,

        message:
          normalizedMessage,

        conversation,

        isNewConversation,
      });
    }

    /*
    ============================================================
    CURRENT LESSON
    ============================================================
    */

    if (
      tutorContext.type ===
      "CURRENT_LESSON"
    ) {
      const currentLessonSession =
        tutorContext.lessonSession;

      if (!currentLessonSession?.id) {
        return res.status(500).json({
          success: false,
          message:
            "The current Tutor lesson session could not be found.",
        });
      }

      if (
        currentLessonSession.endedAt
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This Tutor lesson session has already ended. Please start or resume the lesson.",
        });
      }

      // console.log(
      //   "[TutorStream] Routing to active lesson..."
      // );

      return await continueTutorLessonContext({
        req,
        res,

        student,

        topic:
          tutorContext.topic,

        lessonProgress:
          tutorContext.lessonProgress,

        lessonSession:
          currentLessonSession,

        message:
          normalizedMessage,

        conversation,

        userMessage:
          savedUserMessage,

        isNewConversation,
      });
    }

    /*
    ============================================================
    PREVIOUS TOPIC
    ============================================================
    */

    if (
      tutorContext.type ===
      "PREVIOUS_TOPIC"
    ) {
      // console.log(
      //   "[TutorStream] Routing to previous topic..."
      // );

      return await startTutorLessonFromContext({
        req,
        res,

        student,

        topic:
          tutorContext.topic,

        lessonProgress:
          tutorContext.lessonProgress,

        lessonSession:
          tutorContext.lessonSession,

        message:
          normalizedMessage,

        conversation,

        userMessage:
          savedUserMessage,

        isNewConversation,
      });
    }

    /*
    ============================================================
    NEW TOPIC
    ============================================================
    */

    if (
      tutorContext.type ===
      "NEW_TOPIC"
    ) {
      // console.log(
      //   "[TutorStream] Routing to new topic..."
      // );

      return await startTutorLessonFromContext({
        req,
        res,

        student,

        topic:
          tutorContext.topic,

        lessonProgress:
          tutorContext.lessonProgress,

        lessonSession:
          tutorContext.lessonSession,

        message:
          normalizedMessage,

        conversation,

        userMessage:
          savedUserMessage,

        isNewConversation,
      });
    }

    /*
    ============================================================
    LESSON CONTEXT
    ============================================================
    *
    * An existing lesson conversation without an active lesson
    * session is resumed through the lesson context service.
    */

    if (
      tutorContext.type ===
      "LESSON_CONTEXT"
    ) {
      // console.log(
      //   "[TutorStream] Routing to lesson context..."
      // );

      return await startTutorLessonFromContext({
        req,
        res,

        student,

        topic:
          tutorContext.topic,

        lessonProgress:
          tutorContext.lessonProgress,

        lessonSession:
          tutorContext.lessonSession,

        message:
          normalizedMessage,

        conversation,

        userMessage:
          savedUserMessage,

        isNewConversation,
      });
    }

    /*
    ============================================================
    GENERAL TUTOR CONVERSATION
    ============================================================
    *
    * The request is not associated with a curriculum lesson.
    *
    * The controller now only builds the general Tutor context
    * and prompt.
    *
    * All actual streaming is delegated to:
    *
    * streamTutorConversationResponse()
    *
    * That service owns:
    *
    * 1. Gemini streaming
    * 2. Sentence extraction
    * 3. TTS generation
    * 4. Ordered sentence delivery
    * 5. Image generation
    * 6. Image ordering
    * 7. Audio storage
    * 8. Content block creation
    * 9. Assistant message persistence
    * 10. Conversation timestamp update
    * 11. Done event
    * 12. Background Tutor processing
    */

    // console.log(
    //   "[TutorStream] Building general Tutor context..."
    // );

    const generalTutorContext =
      await buildTutorContext(
        student.id
      );

    /*
    ------------------------------------------------------------
    BUILD GENERAL PROMPT
    ------------------------------------------------------------
    */

    const systemPrompt =
      buildTutorPrompt({
        firstName:
          student.firstName ||
          "Student",

        classLevel:
          student.classLevel ||
          "Unknown",

        context:
          generalTutorContext,
      });

    /*
    ------------------------------------------------------------
    PREVIOUS MESSAGES
    ------------------------------------------------------------
    *
    * The incoming user message has already been saved.
    *
    * It is passed separately as `message`, so exclude the last
    * saved user message from previousMessages.
    */

    const previousMessages =
      conversation.messages
        ?.slice(0, -1)
        ?.slice(-20)
        ?.map((msg) => ({
          role:
            msg.role === "assistant"
              ? "model"
              : "user",

          parts: [
            {
              text:
                msg.content,
            },
          ],
        })) || [];

    /*
    ============================================================
    UNIFIED CONVERSATION STREAM
    ============================================================
    */

    // console.log(
    //   "[TutorStream] Starting unified conversation stream..."
    // );

    return await streamTutorConversationResponse({
      req,
      res,

      student,

      conversation,

      message:
        normalizedMessage,

      systemPrompt,

      previousMessages,

      userMessage:
        savedUserMessage,

      isNewConversation,

      mode:
        "GENERAL",
    });
  } catch (error) {
    /*
    ============================================================
    CENTRAL ERROR HANDLING
    ============================================================
    */

    console.error(
      "[TutorStream] ERROR:",
      error
    );

    /*
    ============================================================
    ERROR BEFORE SSE
    ============================================================
    */

    if (!res.headersSent) {
      const statusCode =
        Number.isInteger(
          error?.statusCode
        )
          ? error.statusCode
          : 500;

      return res.status(statusCode).json({
        success: false,

        message:
          error?.message ||
          "Internal server error.",
      });
    }

    /*
    ============================================================
    ERROR AFTER SSE
    ============================================================
    */

    try {
      res.write(
        `data: ${JSON.stringify({
          type:
            "error",

          message:
            "Tutor failed.",
        })}\n\n`
      );

      if (res.flush) {
        res.flush();
      }
    } catch {}

    try {
      res.end();
    } catch {}
  }
}


export async function getConversations(
  req,
  res
) {
  try {
    const userId = req.user.userId;
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
    Check Subscription Access
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

    const conversations =
      await getStudentConversations(
        student.id
      );

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error(
      "Get conversations error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch conversations",
    });
  }
}

export async function getConversationById(
  req,
  res
) {
  try {
    const userId = req.user.userId;

    const { studentId } = req.query;

    const { id } = req.params;

    const student =
      await resolveStudent({
        userId,
        studentId,
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

     /*
    ==========================================
    Check Subscription Access
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

    const conversation =
      await db.tutorConversation.findFirst({
        where: {
          id,
          studentId: student.id,
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message:
          "Conversation not found",
      });
    }

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error(
      "Get conversation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch conversation",
    });
  }
}

export async function deleteConversationById(
  req,
  res
) {
  try {
    const userId = req.user.userId;
    const { studentId } = req.query;
    const { id } = req.params;

    const student =
      await resolveStudent({
        userId,
        studentId,
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const conversation =
      await db.tutorConversation.findFirst({
        where: {
          id,
          studentId: student.id,
        },
      });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message:
          "Conversation not found",
      });
    }

    await db.tutorConversation.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Conversation deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete conversation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete conversation",
    });
  }
}



export async function startTutorLesson(req, res) {
  try {

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    const { studentId } = req.query;

    // console.log(
    //   "[START LESSON] studentId:",
    //   studentId
    // );

    const student =
      await resolveStudent({
        userId,
        studentId,
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    // console.log("Student is", student)

    // console.log(
    //   "[START LESSON] Student:",
    //   student.id
    // );

    const access =
      await checkSubscriptionAccess({
        userId,
        feature:
          SUBSCRIPTION_FEATURES.AI_CHAT,
      });


    if (!access?.success) {
      return res.status(403).json(access);
    }

    const {
      subjectId,
      termId,
      topicId,
    } = req.body;

    if (
      !subjectId ||
      !termId ||
      !topicId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "subjectId, termId and topicId are required.",
      });
    }

    // console.log(
    //   "[START LESSON] Calling getAndValidateTopic..."
    // );

    const curriculumContext =
      await getAndValidateTopic({
        userId,
        topicId,
        subjectId,
        termId,
        studentId: student.id,
      });

    // console.log(
    //   "[START LESSON] getAndValidateTopic completed"
    // );

    const { topic } =
      curriculumContext;

    if (!topic?.id) {
      const error = new Error(
        "The requested lesson topic could not be found."
      );

      error.statusCode = 404;

      throw error;
    }

    const objectives =
      await ensureTopicObjectives(
        topic
      );



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


    const lessonProgress =
      await getOrCreateTutorLessonProgress({
        studentId: student.id,
        topicId,
        objectives,
      });


    if (!lessonProgress?.id) {
      const error = new Error(
        "Unable to load or create Tutor lesson progress."
      );

      error.statusCode = 500;

      throw error;
    }

    const teachingState =
      await determineNextTeachingState({
        lessonProgress,
        objectives,
      });


    if (teachingState?.isComplete) {
      // console.log(
      //   "[START LESSON] Lesson is already completed."
      // );

      return await handleCompletedTutorLesson({
        req,
        res,

        studentId: student.id,

        topic,

        objectives,

        lessonProgress:
          teachingState.lessonProgress ||
          lessonProgress,

        teachingState,
      });
    }

    const session =
      await createTutorLessonSession({
        studentId: student.id,

        lessonProgress:
          teachingState.lessonProgress ||
          lessonProgress,
      });

    if (!session?.id) {
      const error = new Error(
        "Unable to create the Tutor lesson session."
      );

      error.statusCode = 500;

      throw error;
    }


    const tutorStudentContext =
      await getTutorStudentContext(student.id);


    if (
      !tutorStudentContext?.student
    ) {
      const error = new Error(
        "Unable to load the student's Tutor context."
      );

      error.statusCode = 500;

      throw error;
    }

    const prompt =
      await buildLessonTeachingPrompt({
        student:
          tutorStudentContext.student,

        topic,

        objectives,

        lessonProgress:
          teachingState.lessonProgress ||
          lessonProgress,

        teachingState,

        learningProfile:
          tutorStudentContext.learningProfile,

        learningInsight:
          tutorStudentContext.learningInsight,
      });


    return await streamTutorLesson({
      req,
      res,

      studentId: student.id,

      topic,

      session,

      lessonProgress:
        teachingState.lessonProgress ||
        lessonProgress,

      teachingState,

      prompt,
    });
  } catch (error) {
    console.error(
      "[START LESSON] ERROR:",
      error
    );

    if (res.headersSent) {
      console.error(
        "[START LESSON] Headers already sent. Ending response."
      );

      try {
        res.end();
      } catch {}

      return;
    }

    const statusCode =
      Number.isInteger(
        error?.statusCode
      )
        ? error.statusCode
        : 500;

    return res.status(
      statusCode
    ).json({
      success: false,

      message:
        error?.message ||
        "Unable to start the Tutor lesson.",
    });
  }
}