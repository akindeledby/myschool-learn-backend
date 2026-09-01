import { db } from "../../../lib/db.js";

import {
  resolveTutorTopic,
} from "./resolveTutorTopic.service.js";

export async function resolveTutorConversationContext({
  student,
  message,
  conversationId = null,
  lessonSessionId = null,
}) {
  if (!student?.id) {
    const error = new Error(
      "A valid student is required to resolve Tutor conversation context."
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    typeof message !== "string" ||
    !message.trim()
  ) {
    const error = new Error(
      "A valid Tutor message is required."
    );

    error.statusCode = 400;

    throw error;
  }

  /*
  ============================================================
  HELPER
  ============================================================
  */

  const buildCompletedState = (
    lessonProgress
  ) =>
    lessonProgress?.status === "COMPLETED";

  /*
  ============================================================
  STEP 1
  EXPLICIT LESSON SESSION
  ============================================================
  */

  if (lessonSessionId) {
    console.log(
      "[TutorContext] Checking explicit lesson session:",
      lessonSessionId
    );

    // const verifiedSession =
    //   await db.tutorLessonSession.findFirst({
    //     where: {
    //       id: lessonSessionId,

    //       studentId:
    //         student.id,

    //       ...(conversationId
    //         ? {
    //             conversationId,
    //           }
    //         }
    //         : {}),
    //     },

    //     include: {
    //       lessonProgress: {
    //         include: {
    //           topic: {
    //             include: {
    //               subject: true,
    //               term: true,
    //             },
    //           },

    //           memory: true,
    //         },
    //       },

    //       conversation: {
    //         select: {
    //           id: true,
    //           studentId: true,
    //         },
    //       },
    //     },
    //   });

        const verifiedSession =
      await db.tutorLessonSession.findFirst({
        where: {
          id: lessonSessionId,

          studentId:
            student.id,

          ...(conversationId
            ? {
                conversationId,
              }
            : {}),
        },

        include: {
          lessonProgress: {
            include: {
              topic: {
                include: {
                  subject: true,
                  term: true,
                },
              },

              memory: true,
            },
          },

          conversation: {
            select: {
              id: true,
              studentId: true,
            },
          },
        },
      });

    if (
      verifiedSession?.lessonProgress
    ) {
      const lessonProgress =
        verifiedSession.lessonProgress;

      const isCompleted =
        buildCompletedState(
          lessonProgress
        );

      if (
        isCompleted
      ) {
        console.log(
          "[TutorContext] Explicit session belongs to completed lesson:",
          lessonProgress.id
        );

        return {
          type:
            "COMPLETED_LESSON",

          matched:
            true,

          confidence:
            100,

          isCompleted:
            true,

          topic:
            lessonProgress.topic ||
            null,

          lessonProgress,

          lessonSession:
            verifiedSession,

          conversationId:
            verifiedSession.conversationId,

          reason:
            "The explicitly supplied lesson session belongs to a completed curriculum lesson.",
        };
      }

      if (
        !verifiedSession.endedAt
      ) {
        // console.log(
        //   "[TutorContext] Explicit session resolved as CURRENT_LESSON"
        // );

        return {
          type:
            "CURRENT_LESSON",

          matched:
            true,

          confidence:
            100,

          isCompleted:
            false,

          topic:
            lessonProgress.topic ||
            null,

          lessonProgress,

          lessonSession:
            verifiedSession,

          conversationId:
            verifiedSession.conversationId,

          reason:
            "The message belongs to the explicitly selected active Tutor lesson session.",
        };
      }

      console.warn(
        "[TutorContext] Explicit lesson session has ended:",
        lessonSessionId
      );
    }

    console.warn(
      "[TutorContext] Invalid or inactive lessonSessionId supplied:",
      lessonSessionId
    );
  }

  /*
  ============================================================
  STEP 2
  CURRENT CONVERSATION
  ============================================================
  */

  if (conversationId) {
    // console.log(
    //   "[TutorContext] Inspecting current conversation:",
    //   conversationId
    // );

    const conversation =
      await db.tutorConversation.findFirst({
        where: {
          id:
            conversationId,

          studentId:
            student.id,
        },

        include: {
          lessonProgress: {
            include: {
              topic: {
                include: {
                  subject: true,
                  term: true,
                },
              },

              memory: true,
            },
          },

          lessonSession: {
            include: {
              lessonProgress: {
                include: {
                  topic: {
                    include: {
                      subject: true,
                      term: true,
                    },
                  },

                  memory: true,
                },
              },
            },
          },
        },
      });

    if (conversation) {
      /*
      ----------------------------------------------------------
      CURRENT LESSON SESSION
      ----------------------------------------------------------
      */

      if (
        conversation.lessonSession?.lessonProgress
      ) {
        const lessonProgress =
          conversation.lessonSession.lessonProgress;

        const isCompleted =
          buildCompletedState(
            lessonProgress
          );

        if (
          isCompleted
        ) {
          // console.log(
          //   "[TutorContext] Current conversation contains a completed lesson."
          // );

          return {
            type:
              "COMPLETED_LESSON",

            matched:
              true,

            confidence:
              100,

            isCompleted:
              true,

            topic:
              lessonProgress.topic ||
              null,

            lessonProgress,

            lessonSession:
              conversation.lessonSession,

            conversationId:
              conversation.id,

            reason:
              "The current conversation has a lesson session whose curriculum lesson has already been completed.",
          };
        }

        if (
          !conversation.lessonSession.endedAt
        ) {
          // console.log(
          //   "[TutorContext] Current conversation resolved as CURRENT_LESSON"
          // );

          return {
            type:
              "CURRENT_LESSON",

            matched:
              true,

            confidence:
              100,

            isCompleted:
              false,

            topic:
              lessonProgress.topic ||
              null,

            lessonProgress,

            lessonSession:
              conversation.lessonSession,

            conversationId:
              conversation.id,

            reason:
              "The current conversation has an active Tutor lesson session.",
          };
        }
      }

      /*
      ----------------------------------------------------------
      CONVERSATION LESSON PROGRESS
      ----------------------------------------------------------
      */

      if (
        conversation.lessonProgress?.topic
      ) {
        const lessonProgress =
          conversation.lessonProgress;

        const isCompleted =
          buildCompletedState(
            lessonProgress
          );

        if (
          isCompleted
        ) {
          // console.log(
          //   "[TutorContext] Current conversation is associated with a completed lesson."
          // );

          return {
            type:
              "COMPLETED_LESSON",

            matched:
              true,

            confidence:
              100,

            isCompleted:
              true,

            topic:
              lessonProgress.topic,

            lessonProgress,

            lessonSession:
              conversation.lessonSession ||
              null,

            conversationId:
              conversation.id,

            reason:
              "The current conversation is associated with a curriculum lesson that has already been completed.",
          };
        }

        // console.log(
        //   "[TutorContext] Current conversation resolved as LESSON_CONTEXT"
        // );

        return {
          type:
            "LESSON_CONTEXT",

          matched:
            true,

          confidence:
            95,

          isCompleted:
            false,

          topic:
            lessonProgress.topic,

          lessonProgress,

          lessonSession:
            null,

          conversationId:
            conversation.id,

          reason:
            "The conversation is associated with an existing curriculum lesson, but the lesson has not been completed.",
        };
      }
    }
  }

  /*
  ============================================================
  STEP 3
  FIND RECENT LESSON CONVERSATIONS
  ============================================================
  */

  const recentLessonConversations =
    await db.tutorConversation.findMany({
      where: {
        studentId:
          student.id,

        lessonProgress: {
          isNot:
            null,
        },
      },

      orderBy: {
        updatedAt:
          "desc",
      },

      take:
        5,

      include: {
        lessonProgress: {
          include: {
            topic: {
              include: {
                subject: true,
                term: true,
              },
            },
          },
        },
      },
    });

  /*
  ============================================================
  STEP 4
  RECENT COMPLETED LESSON FALLBACK
  ============================================================
  */

  const completedRecentConversation =
    recentLessonConversations.find(
      (conversation) =>
        conversation.lessonProgress
          ?.status ===
        "COMPLETED"
    );

  /*
  ============================================================
  STEP 5
  RESOLVE MESSAGE TO CURRICULUM TOPIC
  ============================================================
  */

  const topicResolution =
    await resolveTutorTopic({
      student,
      message,
    });

  /*
  ============================================================
  STEP 6
  TOPIC MATCH
  ============================================================
  */

  if (
    topicResolution?.matched &&
    topicResolution.topic
  ) {
    const resolvedTopic =
      topicResolution.topic;

    // console.log(
    //   "[TutorContext] Querying TutorLessonProgress for resolved topic:",
    //   resolvedTopic.id
    // );

    /*
    ============================================================
    DATABASE SOURCE OF TRUTH
    ============================================================
    *
    * Do not assume that the topic is completed merely because
    * the conversation contains the topic.
    *
    * TutorLessonProgress is the authoritative curriculum
    * progress record.
    */

    const tutorLessonProgress =
      await db.tutorLessonProgress.findUnique({
        where: {
          studentId_topicId: {
            studentId:
              student.id,

            topicId:
              resolvedTopic.id,
          },
        },

        include: {
          topic: {
            include: {
              subject: true,
              term: true,
            },
          },

          memory: true,
        },
      });

    const isCompleted =
      buildCompletedState(
        tutorLessonProgress
      );

    // console.log(
    //   "[TutorContext] TutorLessonProgress result:",
    //   {
    //     id:
    //       tutorLessonProgress?.id,

    //     topicId:
    //       tutorLessonProgress?.topicId,

    //     status:
    //       tutorLessonProgress?.status,

    //     isCompleted,
    //   }
    // );

    /*
    ----------------------------------------------------------
    COMPLETED TOPIC
    ----------------------------------------------------------
    */

    if (
      tutorLessonProgress &&
      isCompleted
    ) {
      const completedConversation =
        recentLessonConversations.find(
          (conversation) =>
            conversation.lessonProgress
              ?.topicId ===
            resolvedTopic.id
        );

      // console.log(
      //   "[TutorContext] Topic is confirmed COMPLETED by TutorLessonProgress."
      // );

      return {
        type:
          "COMPLETED_LESSON",

        matched:
          true,

        confidence:
          topicResolution.confidence,

        isCompleted:
          true,

        topic:
          tutorLessonProgress.topic ||
          resolvedTopic,

        lessonProgress:
          tutorLessonProgress,

        lessonSession:
          null,

        conversationId:
          conversationId ||
          completedConversation?.id ||
          null,

        reason:
          "The resolved curriculum topic has a TutorLessonProgress record with COMPLETED status.",
      };
    }

    /*
    ----------------------------------------------------------
    PREVIOUSLY STUDIED TOPIC
    ----------------------------------------------------------
    */

    const recentConversation =
      recentLessonConversations.find(
        (conversation) =>
          conversation.lessonProgress
            ?.topicId ===
          resolvedTopic.id
      );

    if (
      recentConversation
    ) {
      // console.log(
      //   "[TutorContext] Topic resolved as PREVIOUS_TOPIC"
      // );

      return {
        type:
          "PREVIOUS_TOPIC",

        matched:
          true,

        confidence:
          topicResolution.confidence,

        isCompleted:
          false,

        topic:
          resolvedTopic,

        lessonProgress:
          tutorLessonProgress ||
          recentConversation.lessonProgress ||
          null,

        lessonSession:
          null,

        conversationId:
          conversationId ||
          recentConversation.id,

        reason:
          "The message matches a curriculum topic the student studied recently, but the lesson is not currently marked as completed.",
      };
    }

    /*
    ----------------------------------------------------------
    NEW TOPIC
    ----------------------------------------------------------
    */

    // console.log(
    //   "[TutorContext] Topic resolved as NEW_TOPIC"
    // );

    return {
      type:
        "NEW_TOPIC",

      matched:
        true,

      confidence:
        topicResolution.confidence,

      isCompleted:
        false,

      topic:
        resolvedTopic,

      lessonProgress:
        tutorLessonProgress ||
        null,

      lessonSession:
        null,

      conversationId:
        conversationId ||
        null,

      reason:
        "The message matches an available curriculum topic that is not marked as completed.",
    };
  }

  /*
  ============================================================
  STEP 7
  COMPLETED LESSON FALLBACK
  ============================================================
  */

  if (
    completedRecentConversation
  ) {
    const lessonProgress =
      completedRecentConversation.lessonProgress;

    // console.log(
    //   "[TutorContext] Falling back to recently completed lesson."
    // );

    return {
      type:
        "COMPLETED_LESSON",

      matched:
        true,

      confidence:
        80,

      isCompleted:
        true,

      topic:
        lessonProgress?.topic ||
        null,

      lessonProgress:
        lessonProgress ||
        null,

      lessonSession:
        null,

      conversationId:
        completedRecentConversation.id,

      reason:
        "The message could not be matched to another topic, so the most recently completed lesson remains the Tutor context.",
    };
  }

  /*
  ============================================================
  STEP 8
  GENERAL CONVERSATION
  ============================================================
  */

  // console.log(
  //   "[TutorContext] No curriculum context found. Using GENERAL."
  // );

  return {
    type:
      "GENERAL",

    matched:
      false,

    confidence:
      0,

    isCompleted:
      false,

    topic:
      null,

    lessonProgress:
      null,

    lessonSession:
      null,

    conversationId:
      conversationId ||
      null,

    reason:
      "The message could not be confidently associated with a current lesson or curriculum topic.",
  };
}
