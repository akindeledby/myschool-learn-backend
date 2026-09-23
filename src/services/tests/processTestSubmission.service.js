import { db } from "../../../lib/db.js";

/**
 * Process and grade a test submission.
 *
 * This service can operate in two modes:
 *
 * 1. Normal/online mode:
 *    - No `tx` supplied.
 *    - The service creates and manages its own transaction.
 *
 * 2. Offline sync mode:
 *    - A Prisma transaction client (`tx`) is supplied.
 *    - All database operations use that transaction client.
 *    - The caller is responsible for creating/committing/rolling back
 *      the outer transaction.
 *
 * This allows OfflineTestSubmission + StudentScore + TopicAnalytics
 * to be committed atomically during offline synchronization.
 */
export async function processTestSubmission({
  studentId,
  subjectId,
  termId,
  noOfQuestions,
  answers,
  quizId = null,
  tx = null,
}) {
  try {
    // ---------------------------------------------------------
    // 1. Basic validation
    // ---------------------------------------------------------

    if (!studentId) {
      return {
        success: false,
        statusCode: 400,
        message: "studentId is required.",
      };
    }

    if (!subjectId) {
      return {
        success: false,
        statusCode: 400,
        message: "subjectId is required.",
      };
    }

    if (!termId) {
      return {
        success: false,
        statusCode: 400,
        message: "termId is required.",
      };
    }

    if (
      !Number.isInteger(noOfQuestions) ||
      noOfQuestions <= 0
    ) {
      return {
        success: false,
        statusCode: 400,
        message: "noOfQuestions must be a positive integer.",
      };
    }

    if (!Array.isArray(answers)) {
      return {
        success: false,
        statusCode: 400,
        message: "answers must be an array.",
      };
    }

    if (answers.length !== noOfQuestions) {
      return {
        success: false,
        statusCode: 400,
        message:
          "The number of submitted answers must match noOfQuestions.",
      };
    }

    // ---------------------------------------------------------
    // 2. Validate individual answers
    // ---------------------------------------------------------

    for (const answer of answers) {
      if (!answer || typeof answer !== "object") {
        return {
          success: false,
          statusCode: 400,
          message: "Invalid answer format.",
        };
      }

      if (!answer.questionId) {
        return {
          success: false,
          statusCode: 400,
          message: "Each answer must contain questionId.",
        };
      }

      if (!answer.topicId) {
        return {
          success: false,
          statusCode: 400,
          message: "Each answer must contain topicId.",
        };
      }

      if (
        answer.answer !== null &&
        typeof answer.answer !== "string"
      ) {
        return {
          success: false,
          statusCode: 400,
          message:
            "Each answer must contain either a string answer or null.",
        };
      }
    }

    // ---------------------------------------------------------
    // 3. Prevent duplicate question IDs
    // ---------------------------------------------------------

    const submittedQuestionIds = answers.map(
      (answer) => answer.questionId
    );

    const uniqueQuestionIds = new Set(submittedQuestionIds);

    if (uniqueQuestionIds.size !== noOfQuestions) {
      return {
        success: false,
        statusCode: 400,
        message:
          "Each question must appear only once in the submission.",
      };
    }

    // ---------------------------------------------------------
    // 4. Use supplied transaction client when available.
    //
    // Otherwise use the normal Prisma client for reads.
    // ---------------------------------------------------------

    const client = tx || db;

    // ---------------------------------------------------------
    // 5. Verify student, subject and term
    // ---------------------------------------------------------

    const [
      studentRecord,
      subject,
      term,
    ] = await Promise.all([
      client.student.findUnique({
        where: {
          id: studentId,
        },
        select: {
          id: true,
          classId: true,
        },
      }),

      client.subject.findUnique({
        where: {
          id: subjectId,
        },
        select: {
          id: true,
          name: true,
        },
      }),

      client.term.findUnique({
        where: {
          id: termId,
        },
        select: {
          id: true,
          name: true,
          subjectId: true,
          classId: true,
        },
      }),
    ]);

    if (!studentRecord) {
      return {
        success: false,
        statusCode: 404,
        message: "Student not found.",
      };
    }

    if (!subject) {
      return {
        success: false,
        statusCode: 404,
        message: "Subject not found.",
      };
    }

    if (!term) {
      return {
        success: false,
        statusCode: 404,
        message: "Term not found.",
      };
    }

    // ---------------------------------------------------------
    // 6. Verify term belongs to subject
    // ---------------------------------------------------------

    if (term.subjectId !== subjectId) {
      return {
        success: false,
        statusCode: 400,
        message:
          "The selected term does not belong to the selected subject.",
      };
    }

    // ---------------------------------------------------------
    // 7. Verify term belongs to student's class
    // ---------------------------------------------------------

    if (
      studentRecord.classId &&
      term.classId !== studentRecord.classId
    ) {
      return {
        success: false,
        statusCode: 403,
        message:
          "The selected term does not belong to the student's class.",
      };
    }

    // ---------------------------------------------------------
    // 8. Fetch authoritative questions
    //
    // IMPORTANT:
    // correctAnswer comes from the database.
    // We never trust the client's correct answer.
    // ---------------------------------------------------------

    const questions = await client.question.findMany({
      where: {
        id: {
          in: submittedQuestionIds,
        },
      },
      select: {
        id: true,
        text: true,
        correctAnswer: true,
        options: true,
        quizId: true,
        quiz: {
          select: {
            id: true,
            topicId: true,
            topic: {
              select: {
                id: true,
                title: true,
                subjectId: true,
                termId: true,
                classId: true,
              },
            },
          },
        },
      },
    });

    // ---------------------------------------------------------
    // 9. Verify every submitted question exists
    // ---------------------------------------------------------

    if (questions.length !== uniqueQuestionIds.size) {
      return {
        success: false,
        statusCode: 400,
        message:
          "One or more submitted questions could not be found.",
      };
    }

    // ---------------------------------------------------------
    // 10. Build authoritative question map
    // ---------------------------------------------------------

    const questionMap = new Map(
      questions.map((question) => [
        question.id,
        question,
      ])
    );

    // ---------------------------------------------------------
    // 11. If quizId was supplied, verify every question belongs
    //     to that quiz.
    // ---------------------------------------------------------

    if (quizId) {
      const invalidQuizQuestion = questions.some(
        (question) => question.quizId !== quizId
      );

      if (invalidQuizQuestion) {
        return {
          success: false,
          statusCode: 400,
          message:
            "One or more submitted questions do not belong to the selected quiz.",
        };
      }
    }

    // ---------------------------------------------------------
    // 12. Validate question hierarchy
    //
    // question
    //    ↓
    // quiz
    //    ↓
    // topic
    //    ↓
    // subject + term + class
    // ---------------------------------------------------------

    for (const answer of answers) {
      const question = questionMap.get(answer.questionId);

      if (!question) {
        return {
          success: false,
          statusCode: 400,
          message:
            `Question ${answer.questionId} could not be found.`,
        };
      }

      const topic = question.quiz?.topic;

      if (!topic) {
        return {
          success: false,
          statusCode: 500,
          message:
            "One or more questions have invalid learning content relationships.",
        };
      }

      if (topic.subjectId !== subjectId) {
        return {
          success: false,
          statusCode: 400,
          message:
            "A submitted question does not belong to the selected subject.",
        };
      }

      if (topic.termId !== termId) {
        return {
          success: false,
          statusCode: 400,
          message:
            "A submitted question does not belong to the selected term.",
        };
      }

      if (
        studentRecord.classId &&
        topic.classId !== studentRecord.classId
      ) {
        return {
          success: false,
          statusCode: 403,
          message:
            "A submitted question does not belong to the student's class.",
        };
      }

      if (answer.topicId !== topic.id) {
        return {
          success: false,
          statusCode: 400,
          message:
            "The submitted topic does not match the question's actual topic.",
        };
      }
    }

    // ---------------------------------------------------------
    // 13. Verify all submitted questions belong to one subject
    //    and one term.
    // ---------------------------------------------------------

    const questionSubjectIds = new Set();
    const questionTermIds = new Set();

    for (const question of questions) {
      questionSubjectIds.add(
        question.quiz.topic.subjectId
      );

      questionTermIds.add(
        question.quiz.topic.termId
      );
    }

    if (questionSubjectIds.size !== 1) {
      return {
        success: false,
        statusCode: 400,
        message:
          "Submitted questions must belong to the same subject.",
      };
    }

    if (questionTermIds.size !== 1) {
      return {
        success: false,
        statusCode: 400,
        message:
          "Submitted questions must belong to the same term.",
      };
    }

    // ---------------------------------------------------------
    // 14. Normalize answers
    // ---------------------------------------------------------

    const normalizeAnswer = (value) => {
      if (typeof value !== "string") {
        return "";
      }

      return value
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
    };

    // ---------------------------------------------------------
    // 15. Grade submission
    // ---------------------------------------------------------

    let correctCount = 0;

    const topicStats = new Map();

    for (const answer of answers) {
      const question = questionMap.get(
        answer.questionId
      );

      const topic = question.quiz.topic;

      const submittedAnswer = normalizeAnswer(
        answer.answer
      );

      const correctAnswer = normalizeAnswer(
        question.correctAnswer
      );

      const isCorrect =
        submittedAnswer !== "" &&
        submittedAnswer === correctAnswer;

      if (isCorrect) {
        correctCount++;
      }

      if (!topicStats.has(topic.id)) {
        topicStats.set(topic.id, {
          id: topic.id,
          title: topic.title,
          questions: 0,
          answered: 0,
          correct: 0,
          attemptedQuestionIds: [],
        });
      }

      const stats = topicStats.get(topic.id);

      stats.questions += 1;

      if (submittedAnswer !== "") {
        stats.answered += 1;
      }

      if (isCorrect) {
        stats.correct += 1;
      }

      stats.attemptedQuestionIds.push(
        question.id
      );
    }

    // ---------------------------------------------------------
    // 16. Build topic results
    // ---------------------------------------------------------

    const normalizedTopicResults = Array.from(
      topicStats.values()
    ).map((topic) => ({
      id: topic.id,
      title: topic.title,
      questions: topic.questions,
      answered: topic.answered,
      correct: topic.correct,

      score:
        topic.questions > 0
          ? (topic.correct / topic.questions) * 100
          : 0,

      completionRate:
        topic.questions > 0
          ? (topic.answered / topic.questions) * 100
          : 0,

      attemptedQuestionIds:
        topic.attemptedQuestionIds,
    }));

    // ---------------------------------------------------------
    // 17. Persist analytics
    //
    // IMPORTANT:
    // If `tx` was supplied, these writes happen inside the
    // caller's transaction.
    // ---------------------------------------------------------

    const transactionWork = async (transactionClient) => {
      // -------------------------------------------------------
      // StudentScore
      // -------------------------------------------------------

      const existingStudentScore =
        await transactionClient.studentScore.findUnique({
          where: {
            studentId_subjectId_termId: {
              studentId,
              subjectId,
              termId,
            },
          },
        });

      const previousTestCount =
        existingStudentScore?.testCount || 0;

      const previousTestTotalCorrect =
        existingStudentScore?.testTotalCorrect || 0;

      const previousTestTotalQuestions =
        existingStudentScore?.testTotalQuestions || 0;

      const previousTestTotalScore =
        existingStudentScore?.testTotalScore || 0;

      const newTestCount =
        previousTestCount + 1;

      const newTestTotalCorrect =
        previousTestTotalCorrect + correctCount;

      const newTestTotalQuestions =
        previousTestTotalQuestions +
        noOfQuestions;

      const newTestTotalScore =
        previousTestTotalScore + correctCount;

      const newAverageScore =
        newTestCount > 0
          ? newTestTotalScore / newTestCount
          : 0;

      const currentRawScore = correctCount;

      const previousLowest =
        existingStudentScore?.testLowestScore;

      const previousHighest =
        existingStudentScore?.testHighestScore;

      const newLowest =
        previousLowest === undefined ||
        previousLowest === null ||
        previousTestCount === 0
          ? currentRawScore
          : Math.min(
              previousLowest,
              currentRawScore
            );

      const newHighest =
        previousHighest === undefined ||
        previousHighest === null ||
        previousTestCount === 0
          ? currentRawScore
          : Math.max(
              previousHighest,
              currentRawScore
            );

      const updatedStudentScore =
        await transactionClient.studentScore.upsert({
          where: {
            studentId_subjectId_termId: {
              studentId,
              subjectId,
              termId,
            },
          },

          create: {
            studentId,
            subjectId,
            termId,

            testTotalCorrect:
              correctCount,

            testTotalQuestions:
              noOfQuestions,

            testTotalScore:
              correctCount,

            testCount: 1,

            testLowestScore:
              currentRawScore,

            testHighestScore:
              currentRawScore,

            testAverageScore:
              currentRawScore,

            testTopics:
              normalizedTopicResults,

            noOfTopics:
              normalizedTopicResults.length,
          },

          update: {
            testTotalCorrect:
              newTestTotalCorrect,

            testTotalQuestions:
              newTestTotalQuestions,

            testTotalScore:
              newTestTotalScore,

            testCount:
              newTestCount,

            testLowestScore:
              newLowest,

            testHighestScore:
              newHighest,

            testAverageScore:
              newAverageScore,

            // Preserve existing behavior:
            // latest test's topic results.
            testTopics:
              normalizedTopicResults,

            noOfTopics:
              normalizedTopicResults.length,
          },
        });

      // -------------------------------------------------------
      // TopicAnalytics
      // -------------------------------------------------------

      const topicAnalyticsResults = [];

      for (const topic of normalizedTopicResults) {
        const existingAnalytics =
          await transactionClient.topicAnalytics.findUnique({
            where: {
              studentId_topicId: {
                studentId,
                topicId: topic.id,
              },
            },
          });

        const previousTotalQuestions =
          existingAnalytics?.totalQuestions || 0;

        const previousTotalCorrect =
          existingAnalytics?.totalCorrect || 0;

        const previousTestCount =
          existingAnalytics?.testCount || 0;

        // Preserve the existing application's method of
        // reconstructing previously answered questions.
        const previousAnswered =
          existingAnalytics &&
          existingAnalytics.totalQuestions > 0
            ? (
                existingAnalytics.completionRate /
                100
              ) *
              existingAnalytics.totalQuestions
            : 0;

        const newQuestions =
          previousTotalQuestions +
          topic.questions;

        const newCorrect =
          previousTotalCorrect +
          topic.correct;

        const newAnswered =
          previousAnswered +
          topic.answered;

        const newTestCount =
          previousTestCount + 1;

        const completionRate =
          newQuestions > 0
            ? (newAnswered / newQuestions) * 100
            : 0;

        const averageScore =
          newQuestions > 0
            ? (newCorrect / newQuestions) * 100
            : 0;

        const currentTopicScore =
          topic.questions > 0
            ? (topic.correct / topic.questions) * 100
            : 0;

        const previousHighest =
          existingAnalytics?.highestScore;

        const previousLowest =
          existingAnalytics?.lowestScore;

        const highestScore =
          previousHighest === null ||
          previousHighest === undefined
            ? currentTopicScore
            : Math.max(
                previousHighest,
                currentTopicScore
              );

        const lowestScore =
          previousLowest === null ||
          previousLowest === undefined
            ? currentTopicScore
            : Math.min(
                previousLowest,
                currentTopicScore
              );

        const previousAttemptedIds =
          Array.isArray(
            existingAnalytics?.attemptedQuestionIds
          )
            ? existingAnalytics.attemptedQuestionIds
            : [];

        const mergedAttemptedIds = [
          ...new Set([
            ...previousAttemptedIds,
            ...topic.attemptedQuestionIds,
          ]),
        ];

        const updatedAnalytics =
          await transactionClient.topicAnalytics.upsert({
            where: {
              studentId_topicId: {
                studentId,
                topicId: topic.id,
              },
            },

            create: {
              studentId,
              topicId: topic.id,

              completionRate,

              averageScore,

              testCount:
                newTestCount,

              totalQuestions:
                topic.questions,

              totalCorrect:
                topic.correct,

              attemptedQuestionIds:
                mergedAttemptedIds,

              lastScore:
                currentTopicScore,

              highestScore:
                currentTopicScore,

              lowestScore:
                currentTopicScore,

              lastAccessed:
                new Date(),
            },

            update: {
              completionRate,
              averageScore,

              testCount:
                newTestCount,

              totalQuestions:
                newQuestions,

              totalCorrect:
                newCorrect,

              attemptedQuestionIds:
                mergedAttemptedIds,

              lastScore:
                currentTopicScore,

              highestScore,

              lowestScore,

              lastAccessed:
                new Date(),
            },
          });

        topicAnalyticsResults.push(
          updatedAnalytics
        );
      }

      return {
        studentScore: updatedStudentScore,
        topicAnalytics: topicAnalyticsResults,
      };
    };

    // ---------------------------------------------------------
    // 18. Transaction handling
    //
    // If caller supplied `tx`, do NOT create another transaction.
    //
    // Otherwise create the normal online transaction.
    // ---------------------------------------------------------

    let analyticsResult;

    if (tx) {
      analyticsResult =
        await transactionWork(tx);
    } else {
      analyticsResult =
        await db.$transaction(
          async (transactionClient) => {
            return transactionWork(
              transactionClient
            );
          },
          {
            maxWait: 5000,
            timeout: 10000,
          }
        );
    }

    // ---------------------------------------------------------
    // 19. Build final statistics
    // ---------------------------------------------------------

    const testScore =
      correctCount;

    const testPercentage =
      noOfQuestions > 0
        ? (correctCount / noOfQuestions) * 100
        : 0;

    const testStatistics = {
      score: testScore,
      correct: correctCount,
      totalQuestions: noOfQuestions,
      percentage: testPercentage,
      answered: answers.filter(
        (answer) =>
          normalizeAnswer(answer.answer) !== ""
      ).length,
      unanswered: answers.filter(
        (answer) =>
          normalizeAnswer(answer.answer) === ""
      ).length,
    };

    // ---------------------------------------------------------
    // 20. Final response data
    // ---------------------------------------------------------

    return {
      success: true,
      statusCode: 200,
      message: "Test submitted successfully.",

      data: {
        studentScore:
          analyticsResult.studentScore,

        topicAnalytics:
          analyticsResult.topicAnalytics,

        testStatistics,

        test: {
          score: testScore,
          correct: correctCount,
          totalQuestions: noOfQuestions,

          percentage:
            testPercentage,

          termId,
          subjectId,
          studentId,

          noOfTopics:
            normalizedTopicResults.length,

          results: answers.map((answer) => {
            const question =
              questionMap.get(
                answer.questionId
              );

            const submittedAnswer =
              normalizeAnswer(
                answer.answer
              );

            const correctAnswer =
              normalizeAnswer(
                question.correctAnswer
              );

            return {
              questionId:
                question.id,

              topicId:
                question.quiz.topic.id,

              answer:
                answer.answer,

              correctAnswer:
                question.correctAnswer,

              isCorrect:
                submittedAnswer !== "" &&
                submittedAnswer ===
                  correctAnswer,
            };
          }),

          topicResults:
            normalizedTopicResults,
        },
      },
    };
  } catch (error) {
    console.error(
      "PROCESS TEST SUBMISSION ERROR:",
      error
    );

    return {
      success: false,
      statusCode: 500,
      message:
        "Unable to process test submission.",
    };
  }
}