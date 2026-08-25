import { db } from "../../lib/db.js";
import { resolveStudent } from "../services/elevenLabs/studentResolver.service.js";

import {
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { s3 } from "../lib/aws-s3.js";

import { checkSubscriptionAccess } from "../services/subscription/subscription.access.js";
import { unlockVideoLesson } from "../services/subscription/subscription.usage.js";
import { SUBSCRIPTION_FEATURES } from "../services/subscription/subscription.constants.js";

export async function getClasses(
  req,
  res
) {

  try {
    const classes =
      await db.class.findMany({
        orderBy: {
          name: "asc",
        },

        select: {
          id: true,
          name: true,
        },
      });

    return res.status(200).json(
      classes
    );
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message:
        "Failed to fetch classes",
    });
  }
}

export async function getClassSubjects(
  req,
  res
) {
  try {
    const userId = req.user.userId;
    const { studentId } = req.query;

    let student;

    if (studentId) {
      student = await db.student.findUnique({
        where: {
          id: studentId,
        },
        select: {
          id: true,
          classId: true,
        },
      });
    } else {
      student = await db.student.findUnique({
        where: {
          userId,
        },
        select: {
          id: true,
          classId: true,
        },
      });
    }

    if (!student) {
      return res.status(404).json({
        message: "Student record not found",
      });
    }

    const classSubjects =
      await db.classSubject.findMany({
        where: {
          classId: student.classId,
        },
        include: {
          subject: true,
        },
      });

    if (classSubjects.length === 0) {
      return res.status(404).json({
        message:
          "No subjects found for this class",
      });
    }

    const subjects = classSubjects
      .map(({ subject }) => subject)
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );

    return res.status(200).json(subjects);
  } catch (error) {
    console.error(
      "getClassSubjects error:",
      error
    );

    return res.status(500).json({
      message: "Failed to fetch subjects",
    });
  }
}


export async function getTopicsBySubject(
  req,
  res
) {
  try {
    const { subjectId } = req.params;

    if(!subjectId) {
      return res.status(401).json({
        success: false,
        message: "SubjectId is required",
      });
    }

    const topics =
      await db.topic.findMany({
        where: {
          subjectId,
          status: "COMPLETED",
        },

        select: {
          id: true,
          title: true,
          lessonContents: true,
          hlsUrl: true,
          renderedVideoUrl: true,
        },
      });

    res.json(topics);
  } catch (error) {
    res.status(500).json({
      message:
        "Failed to fetch topics",
    });
  }
}

/////////////////////////////////////////////////////
export async function getTermsBySubject(
  req,
  res
) {
  try {
    const { subjectId } = req.params;

    if(!subjectId) {
      return res.status(401).json({
        success: false,
        message: "SubjectId is required",
      });
    }

    const terms =
      await db.term.findMany({
        where: {
          subjectId,
        },

        select: {
          id: true,
          name: true,
          position: true,
        },

        orderBy: {
          position: "asc",
        },
      });

    res.json(terms);
  } catch (error) {
    res.status(500).json({
      message:
        "Failed to fetch terms",
    });
  }
}


export async function getTopicsByTerm(
  req,
  res
) {
  try {
    const { termId } = req.params;

    if(!termId) {
      return res.status(401).json({
        success: false,
        message: "termId is required",
      });
    }

    const topics =
      await db.topic.findMany({
        where: {
          termId,
          status: "COMPLETED",
        },

        select: {
          id: true,
          week: true,
          title: true,
          lessonContents: true,
          hlsUrl: true,
          renderedVideoUrl: true,
        },

        orderBy: {
          week: "asc",
        },
      });

    res.json(topics);
  } catch (error) {
    res.status(500).json({
      message:
        "Failed to fetch topics",
    });
  }
}


export async function getVideoLesson(
  req,
  res
) {
  try {
    const { topicId } = req.params;

    if (!topicId) {
      return res.status(400).json({
        success: false,
        message: "TopicId is required",
      });
    }

    /**
     * Check subscription access
     */
    const access =
      await checkSubscriptionAccess({
        userId: req.user.userId,
        feature:
          SUBSCRIPTION_FEATURES.VIDEO_LESSON,
      });

    if (!access.success) {
      return res.status(403).json(access);
    }

    /**
     * Fetch lesson
     */
    const topic =
      await db.topic.findUnique({
        where: {
          id: topicId,
        },

        select: {
          id: true,
          title: true,
          hlsUrl: true,
          renderedVideoUrl: true,
          status: true,
        },
      });

    /**
     * Consume one usage only after
     * the lesson is successfully available.
     */
    await unlockVideoLesson({
      accountId: access.accountId,
      topicId,
      plan: access.plan,
    });

    return res.status(200).json({
      success: true,
      topic,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch lesson",
    });
  }
}

export async function getQuestionsBySubject(
  req,
  res
) {
  try {
    const { subjectId } = req.params;

    if (!subjectId) {
      return res.status(400).json({
        success: false,
        message: "Subject ID is required",
      });
    }

    /**
     * Number of questions requested.
     *
     * Examples:
     * Flash Card      -> 20
     * Speed Challenge -> 30
     * Millionaire     -> 15
     */
    const requestedLimit = Number(
      req.query.limit
    );

    const limit =
      Number.isFinite(requestedLimit) &&
      requestedLimit > 0
        ? Math.min(requestedLimit, 50)
        : 20;

    /**
     * Check subscription access
     */
    const access =
      await checkSubscriptionAccess({
        userId: req.user.userId,
        feature:
          SUBSCRIPTION_FEATURES.CARD_GAME,
      });

    if (!access.success) {
      return res.status(403).json(access);
    }

    /**
     * Fetch more questions than requested so
     * invalid questions can be discarded while
     * still returning the requested amount.
     */
    const questions =
      await db.$queryRaw`
        SELECT
          q.id,
          q.text,
          q.options,
          q."correctAnswer",
          q."quizId"
        FROM "Question" q
        INNER JOIN "Quiz" quiz
          ON quiz.id = q."quizId"
        INNER JOIN "Topic" topic
          ON topic.id = quiz."topicId"
        WHERE topic."subjectId" = ${subjectId}
        ORDER BY RANDOM()
        LIMIT ${limit * 3};
      `;

    /**
     * Keep only valid questions.
     *
     * Rules:
     * 1. Must have exactly 4 options.
     * 2. All options must be unique.
     * 3. Correct answer must exist in the options.
     */
    const validQuestions =
      questions
        .filter((question) => {
          const options =
            Array.isArray(
              question.options
            )
              ? question.options
              : [];

          return (
            options.length === 4 &&
            new Set(options).size === 4 &&
            options.includes(
              question.correctAnswer
            )
          );
        })
        .slice(0, limit);

    if (
      validQuestions.length === 0
    ) {
      return res.status(200).json({
        success: true,
        count: 0,
        questions: [],
        message:
          "No valid questions found for this subject",
      });
    }

    /**
     * Warn if we couldn't return the full amount.
     * This usually means there are many malformed
     * questions in the database.
     */
    if (
      validQuestions.length < limit
    ) {
      console.warn(
        `Only ${validQuestions.length} valid questions found out of ${limit} requested for subject ${subjectId}.`
      );
    }

    return res.status(200).json({
      success: true,
      count:
        validQuestions.length,
      questions:
        validQuestions,
    });
  } catch (error) {
    console.error(
      "getQuestionsBySubject:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch questions",
    });
  }
}



export async function getQuestionsByTopics(req, res) {
  try {
    /*
     * ============================================================
     * CHECK AUTHENTICATION
     * ============================================================
     */

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    /*
     * ============================================================
     * CHECK SUBSCRIPTION ACCESS
     * ============================================================
     */

    const access = await checkSubscriptionAccess({
      userId: req.user.userId,
      feature: SUBSCRIPTION_FEATURES.TAKE_TEST,
    });

    if (!access.success) {
      return res.status(403).json(access);
    }

    /*
     * ============================================================
     * GET TOPIC IDS
     * ============================================================
     */

    const { topicIds } = req.body;

    if (!Array.isArray(topicIds) || topicIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one topic.",
      });
    }

    /*
     * Normalize topic IDs.
     */

    const normalizedTopicIds = [
      ...new Set(
        topicIds
          .filter((id) => typeof id === "string")
          .map((id) => id.trim())
          .filter(Boolean)
      ),
    ];

    if (normalizedTopicIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid topic IDs were provided.",
      });
    }

    /*
     * ============================================================
     * FETCH TOPICS
     * ============================================================
     */

    const topics = await db.topic.findMany({
      where: {
        id: {
          in: normalizedTopicIds,
        },
      },

      select: {
        id: true,
        title: true,
      },
    });

    if (topics.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No selected topics were found.",
      });
    }

    const topicMap = new Map(
      topics.map((topic) => [
        topic.id,
        topic.title,
      ])
    );

    /*
     * ============================================================
     * FETCH QUESTIONS
     * ============================================================
     *
     * IMPORTANT:
     *
     * correctAnswer is intentionally NOT selected.
     *
     * explanation is intentionally NOT selected.
     *
     * Therefore neither is sent to the browser before submission.
     */

    const allQuestions = [];
    const topicsWithQuestions = [];

    for (const topicId of normalizedTopicIds) {
      if (!topicMap.has(topicId)) {
        continue;
      }

      const topicQuestions =
        await db.question.findMany({
          where: {
            quiz: {
              topicId,
            },
          },

          select: {
            id: true,
            text: true,
            options: true,
            quizId: true,

            quiz: {
              select: {
                id: true,
                title: true,
                topicId: true,
              },
            },
          },
        });

      /*
       * ==========================================================
       * VALIDATE QUESTIONS
       * ==========================================================
       */

      const validQuestions =
        topicQuestions.filter(
          (question) => {
            if (!Array.isArray(question.options)) {
              return false;
            }

            if (question.options.length < 2) {
              return false;
            }

            if (
              new Set(question.options).size !==
              question.options.length
            ) {
              return false;
            }

            if (
              !question.id ||
              !question.quizId ||
              !question.quiz?.topicId ||
              !question.text
            ) {
              return false;
            }

            if (
              question.quiz.topicId !== topicId
            ) {
              return false;
            }

            return true;
          }
        );

      if (validQuestions.length === 0) {
        continue;
      }

      /*
       * ==========================================================
       * RANDOMIZE QUESTIONS
       * ==========================================================
       */

      const randomQuestions =
        [...validQuestions]
          .sort(() => Math.random() - 0.5)
          .slice(0, 10);

      /*
       * ==========================================================
       * NORMALIZE
       * ==========================================================
       */

      const normalizedQuestions =
        randomQuestions.map(
          (question) => ({
            id: question.id,

            text: question.text,

            options: question.options,

            quizId: question.quizId,

            topicId: question.quiz.topicId,
          })
        );

      allQuestions.push(
        ...normalizedQuestions
      );

      topicsWithQuestions.push({
        id: topicId,
        title: topicMap.get(topicId),
      });
    }

    /*
     * ============================================================
     * NO QUESTIONS
     * ============================================================
     */

    if (allQuestions.length === 0) {
      return res.status(200).json({
        success: true,

        message:
          "No valid questions are available for the selected topics.",

        topics: [],

        topicCount: 0,

        questions: [],

        questionCount: 0,
      });
    }

    /*
     * ============================================================
     * FINAL SHUFFLE
     * ============================================================
     */

    allQuestions.sort(
      () => Math.random() - 0.5
    );

    /*
     * ============================================================
     * RESPONSE
     * ============================================================
     *
     * SECURITY:
     *
     * correctAnswer     ❌
     * explanation       ❌
     *
     * are NOT present.
     */

    return res.status(200).json({
      success: true,

      topics: topicsWithQuestions,

      topicCount:
        topicsWithQuestions.length,

      questions: allQuestions,

      questionCount:
        allQuestions.length,
    });
  } catch (error) {
    console.error(
      "[getQuestionsByTopics] Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch questions.",
    });
  }
}


// export async function getQuestionsByTopics(req, res) {
//   try {
//     /*
//      * ============================================================
//      * CHECK SUBSCRIPTION ACCESS
//      * ============================================================
//      */

//     const access = await checkSubscriptionAccess({
//       userId: req.user.userId,
//       feature: SUBSCRIPTION_FEATURES.TAKE_TEST,
//     });

//     if (!access.success) {
//       return res.status(403).json(access);
//     }

//     /*
//      * ============================================================
//      * GET TOPIC IDS
//      * ============================================================
//      */

//     const { topicIds } = req.body;

//     if (!Array.isArray(topicIds) || topicIds.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Please provide at least one topic.",
//       });
//     }

//     /*
//      * Normalize and remove duplicate topic IDs.
//      */

//     const normalizedTopicIds = [
//       ...new Set(
//         topicIds
//           .filter(
//             (id) => typeof id === "string"
//           )
//           .map((id) => id.trim())
//           .filter(Boolean)
//       ),
//     ];

//     if (normalizedTopicIds.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No valid topic IDs were provided.",
//       });
//     }

//     /*
//      * ============================================================
//      * FETCH SELECTED TOPICS
//      * ============================================================
//      *
//      * The database remains the source of truth for topic
//      * information.
//      */

//     const topics = await db.topic.findMany({
//       where: {
//         id: {
//           in: normalizedTopicIds,
//         },
//       },

//       select: {
//         id: true,
//         title: true,
//       },
//     });

//     if (topics.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No selected topics were found.",
//       });
//     }

//     /*
//      * Make topic lookup easy.
//      */

//     const topicMap = new Map(
//       topics.map((topic) => [
//         topic.id,
//         topic.title,
//       ])
//     );

//     /*
//      * ============================================================
//      * FETCH QUESTIONS
//      * ============================================================
//      *
//      * We fetch questions topic by topic so that each selected
//      * topic can contribute up to 10 questions.
//      */

//     const allQuestions = [];
//     const topicsWithQuestions = [];

//     for (const topicId of normalizedTopicIds) {
//       /*
//        * Skip IDs that do not exist in the database.
//        */

//       if (!topicMap.has(topicId)) {
//         continue;
//       }

//       /*
//        * Fetch questions belonging to quizzes for this topic.
//        */

//       const topicQuestions =
//         await db.question.findMany({
//           where: {
//             quiz: {
//               topicId,
//             },
//           },

//           select: {
//             id: true,
//             text: true,
//             options: true,
//             correctAnswer: true,
//             quizId: true,

//             quiz: {
//               select: {
//                 id: true,
//                 title: true,
//                 topicId: true,
//               },
//             },
//           },
//         });

//       /*
//        * ==========================================================
//        * VALIDATE QUESTION
//        * ==========================================================
//        */

//       const validQuestions =
//         topicQuestions.filter(
//           (question) => {
//             /*
//              * Options must be an array.
//              */

//             if (
//               !Array.isArray(
//                 question.options
//               )
//             ) {
//               return false;
//             }

//             /*
//              * At least two options are required.
//              */

//             if (
//               question.options.length < 2
//             ) {
//               return false;
//             }

//             /*
//              * Remove questions containing duplicate options.
//              */

//             if (
//               new Set(
//                 question.options
//               ).size !==
//               question.options.length
//             ) {
//               return false;
//             }

//             /*
//              * Basic required field validation.
//              */

//             if (
//               !question.id ||
//               !question.quizId ||
//               !question.quiz?.topicId ||
//               !question.text
//             ) {
//               return false;
//             }

//             /*
//              * Make sure the quiz actually belongs
//              * to the requested topic.
//              */

//             if (
//               question.quiz.topicId !==
//               topicId
//             ) {
//               return false;
//             }

//             return true;
//           }
//         );

//       /*
//        * ==========================================================
//        * NO VALID QUESTIONS FOR THIS TOPIC
//        * ==========================================================
//        */

//       if (validQuestions.length === 0) {
//         continue;
//       }

//       /*
//        * ==========================================================
//        * RANDOMIZE QUESTIONS FOR THIS TOPIC
//        * ==========================================================
//        *
//        * Maximum of 10 questions per topic.
//        */

//       const randomQuestions =
//         [...validQuestions]
//           .sort(
//             () => Math.random() - 0.5
//           )
//           .slice(0, 10);

//       /*
//        * ==========================================================
//        * NORMALIZE QUESTION SHAPE
//        * ==========================================================
//        *
//        * This is the important part.
//        *
//        * The frontend expects:
//        *
//        * id
//        * text
//        * options
//        * correctAnswer
//        * quizId
//        * topicId
//        *
//        * topicId must therefore be placed at the top level.
//        */

//       const normalizedQuestions =
//         randomQuestions.map(
//           (question) => ({
//             id: question.id,

//             text: question.text,

//             options: question.options,

//             correctAnswer:
//               question.correctAnswer,

//             quizId:
//               question.quizId,

//             topicId:
//               question.quiz.topicId,
//           })
//         );

//       /*
//        * Add questions to the overall test.
//        */

//       allQuestions.push(
//         ...normalizedQuestions
//       );

//       /*
//        * Keep only topics that actually supplied
//        * valid questions.
//        */

//       topicsWithQuestions.push({
//         id: topicId,
//         title: topicMap.get(topicId),
//       });
//     }

//     /*
//      * ============================================================
//      * NO QUESTIONS
//      * ============================================================
//      */

//     if (allQuestions.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message:
//           "No valid questions are available for the selected topics.",
//         topics: [],
//         topicCount: 0,
//         questions: [],
//         questionCount: 0,
//       });
//     }

//     /*
//      * ============================================================
//      * SHUFFLE FINAL QUESTIONS
//      * ============================================================
//      *
//      * This mixes questions from different topics so the student
//      * does not receive all questions from one topic together.
//      */

//     allQuestions.sort(
//       () => Math.random() - 0.5
//     );

//     /*
//      * ============================================================
//      * RESPONSE
//      * ============================================================
//      */

//     return res.status(200).json({
//       success: true,

//       topics: topicsWithQuestions,

//       topicCount:
//         topicsWithQuestions.length,

//       questions: allQuestions,

//       questionCount:
//         allQuestions.length,
//     });
//   } catch (error) {
//     console.error(
//       "[getQuestionsByTopics] Error:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message:
//         "Failed to fetch questions.",
//     });
//   }
// }


export async function getQuestionsByTerms(
  req,
  res
) {
  try {
    /**
     * Check subscription access
     */
    const access =
      await checkSubscriptionAccess({
        userId: req.user.userId,
        feature:
          SUBSCRIPTION_FEATURES.PRACTICE_EXAM,
      });

    if (!access.success) {
      return res.status(403).json(access);
    }

    const { termIds } = req.body;

    if (
      !Array.isArray(termIds) ||
      termIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide at least one term",
      });
    }

    /**
     * Fetch all topics belonging
     * to the selected terms.
     */
    const topics =
      await db.topic.findMany({
        where: {
          termId: {
            in: termIds,
          },
        },

        select: {
          id: true,
          termId: true,
        },
      });

    if (topics.length === 0) {
      return res.status(200).json({
        success: true,
        message:
          "No topics found for the selected terms",
        questions: [],
      });
    }

    /**
     * Fetch selected terms.
     */
    const terms =
      await db.term.findMany({
        where: {
          id: {
            in: termIds,
          },
        },

        select: {
          id: true,
          name: true,
        },
      });

    const termMap = new Map(
      terms.map((term) => [
        term.id,
        term.name,
      ])
    );

    /**
     * Ensure quizzes exist.
     */
    const topicIds =
      topics.map(
        (topic) => topic.id
      );

    const quizzes =
      await db.quiz.findMany({
        where: {
          topicId: {
            in: topicIds,
          },
        },

        select: {
          id: true,
        },
      });

    if (quizzes.length === 0) {
      return res.status(200).json({
        success: true,
        message:
          "No quizzes found for the selected terms",
        questions: [],
      });
    }

     function isValidQuestion(question) {
      if (!Array.isArray(question.options)) {
        return false;
      }

      if (question.options.length < 2) {
        return false;
      }

      if (
        new Set(question.options).size !==
        question.options.length
      ) {
        return false;
      }

      return true;
    }

    /**
     * Fetch up to 15 random
     * questions from each topic.
     */
    const allQuestions = [];

    const termsWithQuestions = [];
    const addedTerms = new Set();

    for (const topic of topics) {
      const topicQuestions =
        await db.question.findMany({
          where: {
            quiz: {
              topicId: topic.id,
            },
          },

          select: {
            id: true,
            text: true,
            options: true,
            correctAnswer: true,
            quizId: true,

            quiz: {
              select: {
                id: true,
                title: true,
                topicId: true,
              },
            },
          },
        });

      if (
        topicQuestions.length > 0
      ) {
        /**
         * Add the term only once.
         */
        if (
          !addedTerms.has(
            topic.termId
          )
        ) {
          addedTerms.add(
            topic.termId
          );

          termsWithQuestions.push({
            id: topic.termId,
            name: termMap.get(
              topic.termId
            ),
          });
        }

        const validQuestions =
          topicQuestions.filter(isValidQuestion);

        const randomQuestions =
          validQuestions
            .sort(() => Math.random() - 0.5)
            .slice(0, 15);

        allQuestions.push(
          ...randomQuestions
        );
      }
    }

    if (
      allQuestions.length === 0
    ) {
      return res.status(200).json({
        success: true,
        message:
          "Quizzes exist but contain no questions",
        questions: [],
      });
    }

    /**
     * Shuffle the final
     * question collection.
     */
    allQuestions.sort(
      () => Math.random() - 0.5
    );

    return res.status(200).json({
      success: true,
      terms: termsWithQuestions,
      termCount: termsWithQuestions.length,
      questionCount: allQuestions.length,
      questions: allQuestions,
    });

  } catch (error) {
    console.error(
      "getQuestionsByTerms:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch questions",
    });
  }
}


export async function downloadVideo(
  req,
  res
) {
  try {
    const { topicId } = req.params;

    const topic =
      await db.topic.findUnique({
        where: {
          id: topicId,
        },

        select: {
          title: true,
          renderedVideoUrl: true,
        },
      });

    if (
      !topic ||
      !topic.renderedVideoUrl
    ) {
      return res.status(404).json({
        message:
          "Video not found",
      });
    }

    const bucket =
      process.env.REMOTION_AWS_BUCKET_NAME;

    const url = new URL(
      topic.renderedVideoUrl
    );

    const key = decodeURIComponent(
      url.pathname
        .replace(`/${bucket}/`, "")
    );

    console.log({
      bucket,
      key,
    });

    const command =
      new GetObjectCommand({
        Bucket: bucket,

        Key: key,

        ResponseContentDisposition: `attachment; filename="${topic.title}.mp4"`,

        ResponseContentType:
          "video/mp4",
      });

    const signedUrl =
      await getSignedUrl(
        s3,
        command,
        {
          expiresIn: 60 * 10,
        }
      );

    return res.json({
      url: signedUrl,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message:
        "Failed to generate download URL",
    });
  }
}