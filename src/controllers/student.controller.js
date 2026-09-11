import { db } from "../../lib/db.js";
import { resolveStudent } from "../services/elevenLabs/studentResolver.service.js";
import {
  getOrCreateStudentProfile,
} from "../services/gamification/studentProfile.service.js";



export async function fetchStudent(req, res) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const { studentId } = req.query;

    /*
     * ---------------------------------------------------------
     * 2. Fetch authenticated user
     * ---------------------------------------------------------
     */

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        role: true,
        email: true,
        profileImageUrl: true,
        accountId: true,

        parent: {
          select: {
            id: true,
          },
        },

        student: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 3. Find the student
     *
     * Parent:
     *   Can fetch a selected child using studentId.
     *
     * Student:
     *   Can only fetch their own profile.
     * ---------------------------------------------------------
     */

    let student = null;

    /*
     * ---------------------------------------------------------
     * Parent viewing a selected child
     * ---------------------------------------------------------
     */

    if (studentId && user.parent) {
      student = await db.student.findFirst({
        where: {
          id: studentId,
          accountId: user.accountId,
        },

        select: {
          id: true,
          firstName: true,
          lastName: true,
          age: true,
          gender: true,
          phone: true,
          schoolAttended: true,
          classLevel: true,
          category: true,
          studentImageUrl: true,
          accountId: true,
          classId: true,
          schoolId: true,

          school: {
            select: {
              name: true,
            },
          },

          /*
           * ---------------------------------------------------
           * Class assigned to the student
           *
           * We use this to determine which subjects are
           * available to the student.
           * ---------------------------------------------------
           */

          class: {
            select: {
              id: true,
              name: true,

              classSubjects: {
                select: {
                  subject: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },

                orderBy: {
                  subject: {
                    name: "asc",
                  },
                },
              },
            },
          },

          /*
           * ---------------------------------------------------
           * Subjects already selected by this student
           * ---------------------------------------------------
           */

          studentSubjects: {
            select: {
              subjectId: true,
            },
          },
        },
      });
    }

    /*
     * ---------------------------------------------------------
     * Logged in student
     * ---------------------------------------------------------
     */

    else if (user.student) {
      student = await db.student.findFirst({
        where: {
          userId,
        },

        select: {
          id: true,
          firstName: true,
          lastName: true,
          age: true,
          gender: true,
          phone: true,
          schoolAttended: true,
          classLevel: true,
          category: true,
          studentImageUrl: true,
          accountId: true,
          classId: true,
          schoolId: true,

          school: {
            select: {
              name: true,
            },
          },

          /*
           * ---------------------------------------------------
           * Class assigned to the student
           * ---------------------------------------------------
           */

          class: {
            select: {
              id: true,
              name: true,

              classSubjects: {
                select: {
                  subject: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },

                orderBy: {
                  subject: {
                    name: "asc",
                  },
                },
              },
            },
          },

          /*
           * ---------------------------------------------------
           * Subjects already selected by this student
           * ---------------------------------------------------
           */

          studentSubjects: {
            select: {
              subjectId: true,
            },
          },
        },
      });
    }

    /*
     * ---------------------------------------------------------
     * 4. Student not found
     * ---------------------------------------------------------
     */

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 5. Format available subjects
     *
     * These are determined entirely by the student's class.
     *
     * Example:
     *
     * Student
     *    ↓
     * classId
     *    ↓
     * Class
     *    ↓
     * ClassSubject
     *    ↓
     * Subject
     * ---------------------------------------------------------
     */

    const availableSubjects =
      student.class?.classSubjects?.map(
        (classSubject) => ({
          id: classSubject.subject.id,
          name: classSubject.subject.name,
        })
      ) || [];

    /*
     * ---------------------------------------------------------
     * 6. Format student's selected subjects
     * ---------------------------------------------------------
     */

    const selectedSubjectIds =
      student.studentSubjects?.map(
        (studentSubject) =>
          studentSubject.subjectId
      ) || [];

    /*
     * ---------------------------------------------------------
     * 7. Active subscription
     * ---------------------------------------------------------
     */

    let subscription = null;

    if (user.accountId) {
      subscription =
        await db.subscription.findFirst({
          where: {
            accountId: user.accountId,

            status: "ACTIVE",

            OR: [
              {
                endsAt: null,
              },
              {
                endsAt: {
                  gt: new Date(),
                },
              },
            ],
          },

          include: {
            subscriptionPlan: true,
          },

          orderBy: {
            createdAt: "desc",
          },
        });
    }

    /*
     * ---------------------------------------------------------
     * 8. Return response
     * ---------------------------------------------------------
     */

    return res.status(200).json({
      success: true,

      student: {
        id: student.id,

        firstName:
          student.firstName,

        lastName:
          student.lastName,

        age:
          student.age,

        gender:
          student.gender,

        phone:
          student.phone,

        schoolAttended:
          student.schoolAttended ||
          student.school?.name ||
          null,

        classLevel:
          student.classLevel,

        classId:
          student.classId,

        category:
          student.category,

        studentImageUrl:
          student.studentImageUrl,

        /*
         * These are the subjects this particular
         * student has selected.
         */

        subjects:
          selectedSubjectIds,
      },

      /*
       * -------------------------------------------------------
       * Subjects available for the student's class
       *
       * The frontend will use this to generate the
       * checkbox list dynamically.
       * -------------------------------------------------------
       */

      availableSubjects,

      /*
       * -------------------------------------------------------
       * Authenticated user information
       * -------------------------------------------------------
       */

      user: {
        id:
          user.id,

        role:
          user.role,

        email:
          user.email,

        profileImageUrl:
          user.profileImageUrl,
      },

      schoolAttended:
        student.schoolAttended ||
        null,

      /*
       * -------------------------------------------------------
       * Active subscription
       * -------------------------------------------------------
       */

      subscription:
        subscription
          ?.subscriptionPlan
          ?.subscriptionPlanName ?? null,
    });
  } catch (error) {
    console.error(
      "Fetch student profile error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch student profile.",
    });
  }
}



export async function updateStudentSubjects(req, res) {
  try {

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 2. Get optional studentId from query
     *
     * Example:
     *
     * /api/student/update-subjects?studentId=xxxxx
     *
     * studentId is NOT required because a logged in student
     * can be identified through req.user.userId.
     * ---------------------------------------------------------
     */

    const { studentId } = req.query;

    /*
     * ---------------------------------------------------------
     * 3. Get authenticated user
     * ---------------------------------------------------------
     */

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        accountId: true,

        parent: {
          select: {
            id: true,
          },
        },

        student: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 4. Validate subjectIds
     * ---------------------------------------------------------
     */

    const { subjectIds } = req.body;

    if (!Array.isArray(subjectIds)) {
      return res.status(400).json({
        success: false,
        message: "Subject IDs must be an array.",
      });
    }

    if (subjectIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one subject.",
      });
    }

    if (subjectIds.length > 10) {
      return res.status(400).json({
        success: false,
        message:
          "A student can select a maximum of 10 subjects.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 5. Clean and remove duplicate subject IDs
     * ---------------------------------------------------------
     */

    const uniqueSubjectIds = [
      ...new Set(
        subjectIds
          .filter(
            (id) =>
              typeof id === "string" &&
              id.trim()
          )
          .map((id) => id.trim())
      ),
    ];

    if (uniqueSubjectIds.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No valid subjects were provided.",
      });
    }

    if (uniqueSubjectIds.length > 10) {
      return res.status(400).json({
        success: false,
        message:
          "A student can select a maximum of 10 subjects.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 6. Determine which student is being updated
     * ---------------------------------------------------------
     */

    let student = null;

    /*
     * ---------------------------------------------------------
     * Parent updating a selected child
     *
     * If studentId is supplied, verify that the child belongs
     * to the same account as the authenticated parent.
     * ---------------------------------------------------------
     */

    if (studentId && user.parent) {
      student = await db.student.findFirst({
        where: {
          id: studentId,
          accountId: user.accountId,
        },

        select: {
          id: true,
          classId: true,
        },
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message:
            "Student not found or you do not have permission to update this student.",
        });
      }
    }

    /*
     * ---------------------------------------------------------
     * Logged in student updating themselves
     *
     * No studentId is required.
     * ---------------------------------------------------------
     */

    else if (user.student) {
      student = await db.student.findFirst({
        where: {
          userId,
        },

        select: {
          id: true,
          classId: true,
        },
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student profile not found.",
        });
      }
    }

    /*
     * ---------------------------------------------------------
     * Parent did not provide a studentId
     *
     * A parent may have multiple children, so we cannot
     * safely guess which child should receive the subjects.
     * ---------------------------------------------------------
     */

    else if (user.parent && !studentId) {
      return res.status(400).json({
        success: false,
        message:
          "Student ID is required when a parent is updating a student's subjects.",
      });
    }

    /*
     * ---------------------------------------------------------
     * No valid student context
     * ---------------------------------------------------------
     */

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student profile could not be determined.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 7. Make sure the student belongs to a class
     * ---------------------------------------------------------
     */

    if (!student.classId) {
      return res.status(400).json({
        success: false,
        message:
          "The student is not assigned to a class.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 8. Get subjects assigned to the student's class
     * ---------------------------------------------------------
     *
     * This is extremely important.
     *
     * We do not simply trust the subject IDs submitted by
     * the frontend.
     *
     * We verify that every subject belongs to the class
     * assigned to this student.
     * ---------------------------------------------------------
     */

    const classSubjects =
      await db.classSubject.findMany({
        where: {
          classId: student.classId,

          subjectId: {
            in: uniqueSubjectIds,
          },
        },

        select: {
          subjectId: true,
        },
      });

    const allowedSubjectIds =
      classSubjects.map(
        (classSubject) =>
          classSubject.subjectId
      );

    /*
     * ---------------------------------------------------------
     * 9. Find subjects that are NOT available for the class
     * ---------------------------------------------------------
     */

    const invalidSubjectIds =
      uniqueSubjectIds.filter(
        (subjectId) =>
          !allowedSubjectIds.includes(
            subjectId
          )
      );

    if (invalidSubjectIds.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected subjects are not available for the student's class.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 10. Save student's subjects
     *
     * We replace the previous selection with the new
     * selection.
     *
     * Transaction ensures that the delete and create
     * operations succeed together.
     * ---------------------------------------------------------
     */

    await db.$transaction(async (tx) => {
      /*
       * Remove previous selections
       */

      await tx.studentSubject.deleteMany({
        where: {
          studentId: student.id,
        },
      });

      /*
       * Save new selections
       */

      await tx.studentSubject.createMany({
        data: uniqueSubjectIds.map(
          (subjectId) => ({
            studentId: student.id,
            subjectId,
          })
        ),
      });
    });

    /*
     * ---------------------------------------------------------
     * 11. Success response
     * ---------------------------------------------------------
     */

    return res.status(200).json({
      success: true,

      message:
        "Student subjects updated successfully.",

      studentId: student.id,

      subjectIds: uniqueSubjectIds,
    });
  } catch (error) {
    console.error(
      "Update student subjects error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update student subjects.",
    });
  }
}


export async function getStudentProfile(
  req,
  res
) {
  try {
    const userId = req.user.userId;
    const { studentId } = req.query;

    const student =
      await resolveStudent({
        userId,
        studentId,
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found.",
      });
    }

    const profile =
      await getOrCreateStudentProfile({
        studentId:
          student.id,
      });

    return res.status(200).json({
      success: true,

      profile: {
        accountXp:
          profile.accountXp,

        accountLevel:
          profile.accountLevel,

        totalGames:
          profile.totalGames,

        totalWins:
          profile.totalWins,

        streak:
          profile.streak,

        createdAt:
          profile.createdAt,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to load student profile.",
    });
  }
}


export async function saveTestScore(req, res) {
  try {
    /*
     * ========================================================
     * 1. AUTHENTICATION AND STUDENT
     * ========================================================
     */

    const userId = req.user?.userId;

    const { studentId } = req.query;

    const normalizedStudentId =
      typeof studentId === "string"
        ? studentId.trim()
        : "";

    if (
      !normalizedStudentId ||
      normalizedStudentId === "null" ||
      normalizedStudentId === "undefined"
    ) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required.",
      });
    }

    /*
     * ========================================================
     * 2. REQUEST BODY
     * ========================================================
     */

    const {
      subjectId,
      termId,
      noOfQuestions,
      answers,
    } = req.body;

    /*
     * ========================================================
     * 3. BASIC VALIDATION
     * ========================================================
     */

    if (
      !subjectId ||
      typeof subjectId !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "subjectId is required.",
      });
    }

    if (
      !termId ||
      typeof termId !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "termId is required.",
      });
    }

    if (
      typeof noOfQuestions !== "number" ||
      !Number.isInteger(noOfQuestions) ||
      noOfQuestions <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "noOfQuestions must be a positive integer.",
      });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: "Answers must be an array.",
      });
    }

    if (answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No answers were submitted.",
      });
    }

    /*
     * ========================================================
     * 4. VALIDATE ANSWER OBJECTS
     * ========================================================
     */

    const invalidAnswer = answers.find(
      (item) => {
        if (!item) {
          return true;
        }

        if (
          typeof item.questionId !==
            "string" ||
          !item.questionId.trim()
        ) {
          return true;
        }

        if (
          typeof item.topicId !==
            "string" ||
          !item.topicId.trim()
        ) {
          return true;
        }

        if (
          item.answer !== null &&
          typeof item.answer !== "string"
        ) {
          return true;
        }

        return false;
      }
    );

    if (invalidAnswer) {
      return res.status(400).json({
        success: false,
        message:
          "One or more submitted answers are invalid.",
      });
    }

    /*
     * ========================================================
     * 5. NORMALIZE QUESTION IDS
     * ========================================================
     */

    const uniqueQuestionIds = [
      ...new Set(
        answers.map((item) =>
          item.questionId.trim()
        )
      ),
    ];

    if (
      noOfQuestions !==
      uniqueQuestionIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "noOfQuestions does not match the number of submitted questions.",
        submittedQuestions:
          noOfQuestions,
        actualQuestions:
          uniqueQuestionIds.length,
      });
    }

    /*
     * ========================================================
     * 6. FETCH STUDENT, SUBJECT AND TERM
     *
     * These queries are deliberately outside the
     * transaction.
     * ========================================================
     */

    const [
      student,
      subject,
      term,
    ] = await Promise.all([
      db.student.findUnique({
        where: {
          id: normalizedStudentId,
        },

        select: {
          id: true,
          classId: true,
        },
      }),

      db.subject.findUnique({
        where: {
          id: subjectId,
        },

        select: {
          id: true,
          name: true,
        },
      }),

      db.term.findUnique({
        where: {
          id: termId,
        },

        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found.",
      });
    }

    if (!term) {
      return res.status(404).json({
        success: false,
        message: "Term not found.",
      });
    }

    /*
     * ========================================================
     * 7. FETCH QUESTIONS
     *
     * Question does not have topicId directly.
     *
     * Question → Quiz → Topic
     * ========================================================
     */

    const questions =
      await db.question.findMany({
        where: {
          id: {
            in: uniqueQuestionIds,
          },
        },

        select: {
          id: true,
          text: true,
          options: true,
          correctAnswer: true,
          explanation: true,
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

    /*
     * ========================================================
     * 8. VERIFY ALL QUESTIONS EXIST
     * ========================================================
     */

    if (
      questions.length !==
      uniqueQuestionIds.length
    ) {
      const foundIds = new Set(
        questions.map(
          (question) => question.id
        )
      );

      const missingQuestionIds =
        uniqueQuestionIds.filter(
          (id) => !foundIds.has(id)
        );

      return res.status(400).json({
        success: false,
        message:
          "One or more submitted questions could not be found.",
        missingQuestionIds,
      });
    }

    /*
     * ========================================================
     * 9. QUESTION LOOKUP MAP
     * ========================================================
     */

    const questionMap =
      new Map(
        questions.map(
          (question) => [
            question.id,
            question,
          ]
        )
      );

    /*
     * ========================================================
     * 10. VERIFY QUESTIONS AND THEIR TOPICS
     * ========================================================
     */

    for (const question of questions) {
      const topic =
        question.quiz?.topic;

      if (!topic) {
        return res.status(400).json({
          success: false,
          message:
            "One or more questions are not associated with a valid topic.",
          questionId: question.id,
        });
      }

      /*
       * Subject verification
       */

      if (
        topic.subjectId !== subjectId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "One or more questions do not belong to the selected subject.",
          questionId: question.id,
        });
      }

      /*
       * Class verification
       */

      if (
        topic.classId !== student.classId
      ) {
        return res.status(403).json({
          success: false,
          message:
            "One or more questions do not belong to the student's class.",
          questionId: question.id,
        });
      }

      /*
       * Term verification
       */

      if (
        topic.termId !== termId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "One or more questions do not belong to the selected term.",
          questionId: question.id,
        });
      }

      /*
       * Verify submitted topicId against
       * authoritative database topicId.
       */

      const submittedAnswer =
        answers.find(
          (item) =>
            item.questionId ===
            question.id
        );

      if (
        !submittedAnswer ||
        submittedAnswer.topicId !==
          topic.id
      ) {
        return res.status(400).json({
          success: false,
          message:
            "One or more submitted topic IDs do not match the questions.",
          questionId: question.id,
        });
      }
    }

    /*
     * ========================================================
     * 11. VERIFY ONE TERM
     * ========================================================
     */

    const questionTermIds = [
      ...new Set(
        questions.map(
          (question) =>
            question.quiz.topic.termId
        )
      ),
    ];

    if (
      questionTermIds.length !== 1 ||
      questionTermIds[0] !== termId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "All questions in one test must belong to the same term.",
      });
    }

    /*
     * ========================================================
     * 12. VERIFY ONE SUBJECT
     * ========================================================
     */

    const questionSubjectIds = [
      ...new Set(
        questions.map(
          (question) =>
            question.quiz.topic
              .subjectId
        )
      ),
    ];

    if (
      questionSubjectIds.length !== 1 ||
      questionSubjectIds[0] !== subjectId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "All questions must belong to the selected subject.",
      });
    }

    /*
     * ========================================================
     * 13. NORMALIZE ANSWERS
     * ========================================================
     */

    const normalizeAnswer = (
      value
    ) => {
      if (
        typeof value !== "string"
      ) {
        return "";
      }

      return value
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
    };

    /*
     * ========================================================
     * 14. GRADE TEST
     *
     * IMPORTANT:
     *
     * score is now the RAW TEST SCORE.
     *
     * Example:
     *
     * 15 correct out of 20
     *
     * score = 15
     *
     * NOT 75.
     * ========================================================
     */

    let correctCount = 0;

    const gradedResults =
      answers.map((submitted) => {
        const question =
          questionMap.get(
            submitted.questionId
          );

        if (!question) {
          return {
            questionId:
              submitted.questionId,

            selectedAnswer:
              submitted.answer,

            isCorrect: false,
          };
        }

        const selectedAnswer =
          normalizeAnswer(
            submitted.answer
          );

        const correctAnswer =
          normalizeAnswer(
            question.correctAnswer
          );

        const isCorrect =
          selectedAnswer !== "" &&
          correctAnswer !== "" &&
          selectedAnswer ===
            correctAnswer;

        if (isCorrect) {
          correctCount++;
        }

        return {
          questionId:
            question.id,

          selectedAnswer:
            submitted.answer,

          isCorrect,

          correctAnswer:
            question.correctAnswer,

          explanation:
            question.explanation ||
            undefined,
        };
      });

    /*
     * ========================================================
     * 15. RAW TEST SCORE
     * ========================================================
     *
     * The student's score is the number of
     * correct answers.
     *
     * Example:
     *
     * 17/20 = score of 17
     * 8/10  = score of 8
     *
     * No percentage conversion.
     * ========================================================
     */

    const totalQuestions =
      uniqueQuestionIds.length;

    const score = correctCount;

    /*
     * ========================================================
     * 16. BUILD TOPIC STATISTICS
     * ========================================================
     */

    const topicStats =
      new Map();

    for (const submitted of answers) {
      const question =
        questionMap.get(
          submitted.questionId
        );

      if (!question) {
        continue;
      }

      const topic =
        question.quiz.topic;

      const topicId =
        topic.id;

      if (
        !topicStats.has(topicId)
      ) {
        topicStats.set(
          topicId,
          {
            id: topicId,
            title: topic.title,

            questions: 0,
            answered: 0,
            correct: 0,

            attemptedQuestionIds: [],
          }
        );
      }

      const stats =
        topicStats.get(topicId);

      stats.questions++;

      const hasAnswer =
        typeof submitted.answer ===
          "string" &&
        submitted.answer.trim()
          .length > 0;

      if (hasAnswer) {
        stats.answered++;

        stats.attemptedQuestionIds.push(
          question.id
        );
      }

      const selectedAnswer =
        normalizeAnswer(
          submitted.answer
        );

      const correctAnswer =
        normalizeAnswer(
          question.correctAnswer
        );

      const isCorrect =
        selectedAnswer !== "" &&
        correctAnswer !== "" &&
        selectedAnswer ===
          correctAnswer;

      if (isCorrect) {
        stats.correct++;
      }
    }

    /*
     * ========================================================
     * 17. BUILD NORMALIZED TOPIC RESULTS
     *
     * Topic score remains a percentage because
     * this is topic performance analytics.
     *
     * The StudentScore test fields remain raw scores.
     * ========================================================
     */

    const normalizedTopicResults =
      Array.from(
        topicStats.values()
      ).map((topic) => {
        const topicScore =
          topic.questions > 0
            ? Number(
                (
                  (topic.correct /
                    topic.questions) *
                  100
                ).toFixed(2)
              )
            : 0;

        const completionRate =
          topic.questions > 0
            ? Number(
                (
                  (topic.answered /
                    topic.questions) *
                  100
                ).toFixed(2)
              )
            : 0;

        return {
          id: topic.id,

          title: topic.title,

          questions:
            topic.questions,

          answered:
            topic.answered,

          correct:
            topic.correct,

          score:
            topicScore,

          completionRate,

          attemptedQuestionIds:
            topic.attemptedQuestionIds,
        };
      });

    /*
     * ========================================================
     * 18. TOPIC IDS
     * ========================================================
     */

    const topicIds =
      normalizedTopicResults.map(
        (topic) => topic.id
      );

    /*
     * ========================================================
     * 19. DATABASE TRANSACTION
     *
     * Only persistence happens inside the
     * transaction.
     * ========================================================
     */

    const result =
      await db.$transaction(
        async (tx) => {
          /*
           * ==================================================
           * GET EXISTING STUDENT SCORE
           * ==================================================
           */

          const existingScore =
            await tx.studentScore.findUnique(
              {
                where: {
                  studentId_subjectId_termId:
                    {
                      studentId:
                        normalizedStudentId,

                      subjectId,

                      termId,
                    },
                },
              }
            );

          /*
           * ==================================================
           * PREVIOUS TEST STATISTICS
           * ==================================================
           */

          const previousTestTotalCorrect =
            existingScore
              ?.testTotalCorrect ?? 0;

          const previousTestTotalQuestions =
            existingScore
              ?.testTotalQuestions ?? 0;

          const previousTestTotalScore =
            existingScore
              ?.testTotalScore ?? 0;

          const previousTestCount =
            existingScore
              ?.testCount ?? 0;

          const previousTestLowestScore =
            existingScore
              ?.testLowestScore ?? null;

          const previousTestHighestScore =
            existingScore
              ?.testHighestScore ?? null;

          /*
           * ==================================================
           * NEW TEST STATISTICS
           * ==================================================
           */

          const newTestCount =
            previousTestCount + 1;

          const newTestTotalCorrect =
            previousTestTotalCorrect +
            correctCount;

          const newTestTotalQuestions =
            previousTestTotalQuestions +
            totalQuestions;

          /*
           * ==================================================
           * CUMULATIVE RAW TEST SCORE
           *
           * Example:
           *
           * Previous = 30
           * Current  = 15
           *
           * New total = 45
           * ==================================================
           */

          const newTestTotalScore =
            previousTestTotalScore +
            score;

          /*
           * ==================================================
           * RAW AVERAGE TEST SCORE
           *
           * IMPORTANT:
           *
           * This is NOT a percentage.
           *
           * It is:
           *
           * total raw score / number of tests
           *
           * Example:
           *
           * 15 + 18 + 12 = 45
           * 45 / 3 = 15
           * ==================================================
           */

          const newTestAverageScore =
            newTestCount > 0
              ? Number(
                  (
                    newTestTotalScore /
                    newTestCount
                  ).toFixed(2)
                )
              : 0;

          /*
           * ==================================================
           * LOWEST RAW TEST SCORE
           * ==================================================
           */

          const newTestLowestScore =
            previousTestLowestScore ===
              null ||
            previousTestLowestScore ===
              undefined
              ? score
              : Math.min(
                  previousTestLowestScore,
                  score
                );

          /*
           * ==================================================
           * HIGHEST RAW TEST SCORE
           * ==================================================
           */

          const newTestHighestScore =
            previousTestHighestScore ===
              null ||
            previousTestHighestScore ===
              undefined
              ? score
              : Math.max(
                  previousTestHighestScore,
                  score
                );

          /*
           * ==================================================
           * STUDENT SCORE UPSERT
           * ==================================================
           */

          const studentScore =
            await tx.studentScore.upsert(
              {
                where: {
                  studentId_subjectId_termId:
                    {
                      studentId:
                        normalizedStudentId,

                      subjectId,

                      termId,
                    },
                },

                create: {
                  studentId:
                    normalizedStudentId,

                  subjectId,

                  termId,

                  /*
                   * RAW TEST STATISTICS
                   */

                  testTotalCorrect:
                    correctCount,

                  testTotalQuestions:
                    totalQuestions,

                  testTotalScore:
                    score,

                  testAverageScore:
                    score,

                  testLowestScore:
                    score,

                  testHighestScore:
                    score,

                  testCount: 1,

                  /*
                   * TOPIC INFORMATION
                   */

                  testTopics:
                    normalizedTopicResults,

                  noOfTopics:
                    normalizedTopicResults.length,
                },

                update: {
                  /*
                   * CUMULATIVE RAW VALUES
                   */

                  testTotalCorrect:
                    newTestTotalCorrect,

                  testTotalQuestions:
                    newTestTotalQuestions,

                  testTotalScore:
                    newTestTotalScore,

                  /*
                   * RAW AVERAGE
                   */

                  testAverageScore:
                    newTestAverageScore,

                  /*
                   * RAW LOWEST/HIGHEST
                   */

                  testLowestScore:
                    newTestLowestScore,

                  testHighestScore:
                    newTestHighestScore,

                  /*
                   * NUMBER OF TESTS
                   */

                  testCount:
                    newTestCount,

                  /*
                   * LATEST TOPIC RESULTS
                   */

                  testTopics:
                    normalizedTopicResults,

                  noOfTopics:
                    normalizedTopicResults.length,
                },
              }
            );

          /*
           * ==================================================
           * FETCH EXISTING TOPIC ANALYTICS
           * ==================================================
           */

          const existingAnalytics =
            await tx.topicAnalytics.findMany(
              {
                where: {
                  studentId:
                    normalizedStudentId,

                  topicId: {
                    in: topicIds,
                  },
                },
              }
            );

          /*
           * ==================================================
           * TOPIC ANALYTICS LOOKUP
           * ==================================================
           */

          const analyticsMap =
            new Map(
              existingAnalytics.map(
                (analytics) => [
                  analytics.topicId,
                  analytics,
                ]
              )
            );

          /*
           * ==================================================
           * BUILD TOPIC ANALYTICS OPERATIONS
           * ==================================================
           */

          const analyticsOperations =
            normalizedTopicResults.map(
              (topic) => {
                const existing =
                  analyticsMap.get(
                    topic.id
                  );

                const previousQuestions =
                  existing
                    ?.totalQuestions ?? 0;

                const previousCorrect =
                  existing
                    ?.totalCorrect ?? 0;

                const previousTests =
                  existing
                    ?.testCount ?? 0;

                /*
                 * Reconstruct previous answered
                 * questions from completion rate.
                 */

                const previousAnswered =
                  existing &&
                  previousQuestions > 0
                    ? (
                        existing.completionRate /
                        100
                      ) *
                      previousQuestions
                    : 0;

                const newQuestions =
                  previousQuestions +
                  topic.questions;

                const newCorrect =
                  previousCorrect +
                  topic.correct;

                const newAnswered =
                  previousAnswered +
                  topic.answered;

                const newTestCount =
                  previousTests + 1;

                const completionRate =
                  newQuestions > 0
                    ? Number(
                        (
                          (newAnswered /
                            newQuestions) *
                          100
                        ).toFixed(2)
                      )
                    : 0;

                const averageScore =
                  newQuestions > 0
                    ? Number(
                        (
                          (newCorrect /
                            newQuestions) *
                          100
                        ).toFixed(2)
                      )
                    : 0;

                /*
                 * Topic score is still a percentage.
                 */

                const currentTopicScore =
                  topic.questions > 0
                    ? Number(
                        (
                          (topic.correct /
                            topic.questions) *
                          100
                        ).toFixed(2)
                      )
                    : 0;

                const lowestScore =
                  existing?.lowestScore !==
                    null &&
                  existing?.lowestScore !==
                    undefined
                    ? Math.min(
                        existing.lowestScore,
                        currentTopicScore
                      )
                    : currentTopicScore;

                const highestScore =
                  existing?.highestScore !==
                    null &&
                  existing?.highestScore !==
                    undefined
                    ? Math.max(
                        existing.highestScore,
                        currentTopicScore
                      )
                    : currentTopicScore;

                const attemptedQuestionIds =
                  Array.from(
                    new Set([
                      ...(existing
                        ?.attemptedQuestionIds ??
                        []),

                      ...(topic
                        .attemptedQuestionIds ??
                        []),
                    ])
                  );

                return {
                  topic,
                  existing,

                  completionRate,

                  averageScore,

                  currentTopicScore,

                  newQuestions,

                  newCorrect,

                  newTestCount,

                  attemptedQuestionIds,

                  lowestScore,

                  highestScore,
                };
              }
            );

          /*
           * ==================================================
           * TOPIC ANALYTICS WRITES
           * ==================================================
           */

          const topicAnalyticsResults =
            [];

          for (
            const item of
              analyticsOperations
          ) {
            const {
              topic,
              completionRate,
              averageScore,
              currentTopicScore,

              newQuestions,
              newCorrect,
              newTestCount,

              attemptedQuestionIds,

              lowestScore,
              highestScore,
            } = item;

            const analytics =
              await tx.topicAnalytics.upsert(
                {
                  where: {
                    studentId_topicId:
                      {
                        studentId:
                          normalizedStudentId,

                        topicId:
                          topic.id,
                      },
                  },

                  create: {
                    studentId:
                      normalizedStudentId,

                    topicId:
                      topic.id,

                    completionRate:
                      topic.completionRate,

                    averageScore:
                      currentTopicScore,

                    testCount: 1,

                    totalQuestions:
                      topic.questions,

                    totalCorrect:
                      topic.correct,

                    attemptedQuestionIds:
                      topic.attemptedQuestionIds,

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

                    attemptedQuestionIds,

                    lastScore:
                      currentTopicScore,

                    highestScore,

                    lowestScore,

                    lastAccessed:
                      new Date(),
                  },
                }
              );

            topicAnalyticsResults.push(
              analytics
            );
          }

          /*
           * ==================================================
           * RETURN TRANSACTION RESULT
           * ==================================================
           */

          return {
            studentScore,

            topicAnalytics:
              topicAnalyticsResults,

            testStatistics: {
              testTotalCorrect:
                newTestTotalCorrect,

              testTotalQuestions:
                newTestTotalQuestions,

              testTotalScore:
                newTestTotalScore,

              testAverageScore:
                newTestAverageScore,

              testLowestScore:
                newTestLowestScore,

              testHighestScore:
                newTestHighestScore,

              testCount:
                newTestCount,
            },
          };
        },

        {
          /*
           * Maximum time Prisma waits to
           * obtain a transaction connection.
           */

          maxWait: 5000,

          /*
           * Maximum transaction execution time.
           */

          timeout: 10000,
        }
      );

    /*
     * ========================================================
     * 20. RESPONSE
     * ========================================================
     */

    return res.status(200).json({
      success: true,

      message:
        "Test graded and saved successfully.",

      data: {
        studentScore:
          result.studentScore,

        topicAnalytics:
          result.topicAnalytics,

        /*
         * RAW TEST STATISTICS
         */

        testStatistics:
          result.testStatistics,

        test: {
          /*
           * CURRENT TEST RAW SCORE
           */

          score,

          correct:
            correctCount,

          totalQuestions,

          /*
           * Keep percentage out of the
           * StudentScore test statistics.
           *
           * The topic analytics still contain
           * their own percentage values.
           */

          termId,

          subjectId,

          noOfTopics:
            normalizedTopicResults.length,

          studentId:
            normalizedStudentId,

          results:
            gradedResults,

          topicResults:
            normalizedTopicResults,
        },
      },
    });
  } catch (error) {
    console.error(
      "[saveTestScore] Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to grade and save test.",
    });
  }
}

export async function saveExamScore(req, res) {
  try {
    /*
     * ============================================================
     * AUTHENTICATED USER / STUDENT
     * ============================================================
     */

    const userId = req.user.userId;
    const { studentId } = req.query;

    /*
     * ============================================================
     * REQUEST BODY
     * ============================================================
     */

    const {
      subjectId,
      examTerms,
      answers,
      noOfQuestions,
    } = req.body;

    /*
     * ============================================================
     * BASIC VALIDATION
     * ============================================================
     */

    if (
      !subjectId ||
      typeof subjectId !== "string" ||
      !subjectId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "subjectId is required.",
      });
    }

    /*
     * ============================================================
     * VALIDATE NO OF QUESTIONS
     * ============================================================
     */

    if (
      typeof noOfQuestions !== "number" ||
      !Number.isInteger(noOfQuestions) ||
      noOfQuestions <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "noOfQuestions must be a positive integer.",
      });
    }

    /*
     * ============================================================
     * VALIDATE EXAM TERMS
     * ============================================================
     */

    if (
      !Array.isArray(examTerms) ||
      examTerms.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one exam term is required.",
      });
    }

    /*
     * ============================================================
     * VALIDATE ANSWERS
     * ============================================================
     */

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message:
          "Exam answers must be provided.",
      });
    }

    /*
     * ============================================================
     * NORMALIZE ANSWERS
     * ============================================================
     */

    const normalizedAnswers = answers
      .filter(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof item.questionId === "string"
      )
      .map((item) => ({
        questionId:
          item.questionId.trim(),

        selectedAnswer:
          typeof item.selectedAnswer ===
          "string"
            ? item.selectedAnswer.trim()
            : null,
      }));

    /*
     * ============================================================
     * REMOVE DUPLICATE QUESTION IDS
     * ============================================================
     *
     * Only one submitted answer is allowed per question.
     */

    const uniqueAnswers =
      Array.from(
        new Map(
          normalizedAnswers.map(
            (item) => [
              item.questionId,
              item,
            ]
          )
        ).values()
      );

    /*
     * ============================================================
     * VALIDATE SUBMITTED QUESTIONS
     * ============================================================
     */

    if (uniqueAnswers.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No valid exam answers were provided.",
      });
    }

    /*
     * ============================================================
     * VALIDATE NO OF QUESTIONS AGAINST SUBMITTED QUESTIONS
     * ============================================================
     */

    if (
      noOfQuestions !==
      uniqueAnswers.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "noOfQuestions does not match the number of submitted questions.",

        submittedQuestions:
          noOfQuestions,

        actualQuestions:
          uniqueAnswers.length,
      });
    }

    /*
     * ============================================================
     * RESOLVE STUDENT
     * ============================================================
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
     * ============================================================
     * FIND SUBJECT
     * ============================================================
     */

    const subject =
      await db.subject.findUnique({
        where: {
          id: subjectId.trim(),
        },

        select: {
          id: true,
          name: true,
        },
      });

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found.",
      });
    }

    /*
     * ============================================================
     * GET TERM ID
     * ============================================================
     */

    const termId =
      typeof examTerms[0]?.id === "string"
        ? examTerms[0].id.trim()
        : null;

    if (!termId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid term ID is required.",
      });
    }

    /*
     * ============================================================
     * FIND TERM
     * ============================================================
     */

    const term =
      await db.term.findUnique({
        where: {
          id: termId,
        },

        select: {
          id: true,
          name: true,
        },
      });

    if (!term) {
      return res.status(404).json({
        success: false,
        message: "Term not found.",
      });
    }

    /*
     * ============================================================
     * QUESTION IDS
     * ============================================================
     */

    const questionIds =
      uniqueAnswers.map(
        (answer) =>
          answer.questionId
      );

    /*
     * ============================================================
     * FETCH ACTUAL QUESTIONS
     * ============================================================
     *
     * IMPORTANT:
     *
     * correctAnswer and explanation are retrieved ONLY on
     * the backend.
     *
     * They were never exposed to the frontend before submission.
     */

    const questions =
      await db.question.findMany({
        where: {
          id: {
            in: questionIds,
          },
        },

        select: {
          id: true,
          text: true,
          options: true,
          correctAnswer: true,
          explanation: true,

          quiz: {
            select: {
              topicId: true,
            },
          },
        },
      });

    /*
     * ============================================================
     * VERIFY ALL QUESTIONS EXIST
     * ============================================================
     *
     * We should not silently grade only a subset of the submitted
     * questions.
     */

    if (
      questions.length !==
      questionIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "One or more submitted questions could not be found.",
        submittedQuestions:
          questionIds.length,
        foundQuestions:
          questions.length,
      });
    }

    /*
     * ============================================================
     * QUESTION MAP
     * ============================================================
     */

    const questionMap =
      new Map(
        questions.map(
          (question) => [
            question.id,
            question,
          ]
        )
      );

    /*
     * ============================================================
     * GRADE EXAM
     * ============================================================
     */

    let correctCount = 0;

    const gradedResults =
      uniqueAnswers.map(
        (studentAnswer) => {
          const question =
            questionMap.get(
              studentAnswer.questionId
            );

          /*
           * This should not normally happen because we already
           * verified that all questions exist.
           */

          if (!question) {
            return {
              questionId:
                studentAnswer.questionId,

              selectedAnswer:
                studentAnswer.selectedAnswer,

              isCorrect: false,

              correctAnswer: null,

              explanation: null,
            };
          }

          /*
           * ======================================================
           * CHECK ANSWER
           * ======================================================
           */

          const isCorrect =
            typeof studentAnswer.selectedAnswer ===
              "string" &&
            typeof question.correctAnswer ===
              "string" &&
            studentAnswer.selectedAnswer
              .trim() ===
              question.correctAnswer
                .trim();

          if (isCorrect) {
            correctCount++;
          }

          /*
           * ======================================================
           * BUILD REVIEW RESULT
           * ======================================================
           */

          return {
            questionId:
              question.id,

            question:
              question.text,

            options:
              question.options,

            selectedAnswer:
              studentAnswer.selectedAnswer,

            isCorrect,

            correctAnswer:
              question.correctAnswer,

            explanation:
              question.explanation ??
              null,
          };
        }
      );

    /*
     * ============================================================
     * TOTAL QUESTIONS
     * ============================================================
     *
     * Use the validated noOfQuestions value.
     */

    const totalQuestions =
      noOfQuestions;

    /*
     * ============================================================
     * EXAM PERCENTAGE
     * ============================================================
     */

    const examPercentage =
      totalQuestions > 0
        ? Number(
            (
              (correctCount /
                totalQuestions) *
              100
            ).toFixed(2)
          )
        : 0;

    /*
     * ============================================================
     * TRANSACTION
     * ============================================================
     */

    const result =
      await db.$transaction(
        async (tx) => {
          /*
           * ======================================================
           * FIND EXISTING STUDENT SCORE
           * ======================================================
           */

          let studentScore =
            await tx.studentScore.findUnique({
              where: {
                studentId_subjectId_termId: {
                  studentId:
                    student.id,

                  subjectId:
                    subject.id,

                  termId:
                    term.id,
                },
              },
            });

          /*
           * ======================================================
           * PREVIOUS EXAM STATISTICS
           * ======================================================
           */

          const previousExamTotalCorrect =
            studentScore
              ?.examTotalCorrect ?? 0;

          const previousExamTotalQuestions =
            studentScore
              ?.examTotalQuestions ?? 0;

          const previousExamTotalScore =
            studentScore
              ?.examTotalScore ?? 0;

          const previousExamCount =
            studentScore
              ?.examCount ?? 0;

          const previousExamLowest =
            studentScore
              ?.examLowestScore ?? null;

          const previousExamHighest =
            studentScore
              ?.examHighestScore ?? null;

          /*
           * ======================================================
           * ACCUMULATE EXAM RESULTS
           * ======================================================
           */

          const newExamTotalCorrect =
            previousExamTotalCorrect +
            correctCount;

          const newExamTotalQuestions =
            previousExamTotalQuestions +
            totalQuestions;

          const newExamCount =
            previousExamCount + 1;

          const newExamTotalScore =
            Number(
              (
                previousExamTotalScore +
                examPercentage
              ).toFixed(2)
            );

          const newExamAverage =
            newExamCount > 0
              ? Number(
                  (
                    newExamTotalScore /
                    newExamCount
                  ).toFixed(2)
                )
              : examPercentage;

          const newExamLowest =
            previousExamLowest === null
              ? examPercentage
              : Math.min(
                  previousExamLowest,
                  examPercentage
                );

          const newExamHighest =
            previousExamHighest === null
              ? examPercentage
              : Math.max(
                  previousExamHighest,
                  examPercentage
                );

          /*
           * ======================================================
           * MERGE EXAM TERMS
           * ======================================================
           */

          const existingTerms =
            Array.isArray(
              studentScore?.examTerms
            )
              ? studentScore.examTerms
              : [];

          const validIncomingTerms =
            examTerms.filter(
              (termItem) =>
                termItem &&
                typeof termItem ===
                  "object" &&
                typeof termItem.id ===
                  "string" &&
                termItem.id.trim()
            );

          const mergedTerms =
            Array.from(
              new Map(
                [
                  ...existingTerms,
                  ...validIncomingTerms,
                ]
                  .filter(
                    (termItem) =>
                      termItem &&
                      typeof termItem ===
                        "object" &&
                      typeof termItem.id ===
                        "string" &&
                      termItem.id.trim()
                  )
                  .map(
                    (termItem) => [
                      termItem.id,
                      termItem,
                    ]
                  )
              ).values()
            );

          /*
           * ======================================================
           * CREATE / UPDATE STUDENT SCORE
           * ======================================================
           */

          if (!studentScore) {
            studentScore =
              await tx.studentScore.create({
                data: {
                  studentId:
                    student.id,

                  subjectId:
                    subject.id,

                  termId:
                    term.id,

                  examTotalCorrect:
                    correctCount,

                  examTotalQuestions:
                    totalQuestions,

                  examTotalScore:
                    examPercentage,

                  examCount: 1,

                  examLowestScore:
                    examPercentage,

                  examHighestScore:
                    examPercentage,

                  examAverageScore:
                    examPercentage,

                  examTerms:
                    mergedTerms,
                },
              });
          } else {
            studentScore =
              await tx.studentScore.update({
                where: {
                  id: studentScore.id,
                },

                data: {
                  examTotalCorrect:
                    newExamTotalCorrect,

                  examTotalQuestions:
                    newExamTotalQuestions,

                  examTotalScore:
                    newExamTotalScore,

                  examCount:
                    newExamCount,

                  examLowestScore:
                    newExamLowest,

                  examHighestScore:
                    newExamHighest,

                  examAverageScore:
                    newExamAverage,

                  examTerms:
                    mergedTerms,
                },
              });
          }

          /*
           * ======================================================
           * EXAM CONTRIBUTION
           * ======================================================
           *
           * Examination contributes 60%.
           */

          const examContribution =
            Number(
              (
                (examPercentage /
                  100) *
                60
              ).toFixed(2)
            );

          /*
           * ======================================================
           * CONTINUOUS ASSESSMENT
           * ======================================================
           *
           * Tests contribute 40%.
           */

          const totalTestCorrect =
            studentScore
              .testTotalCorrect ?? 0;

          const totalTestQuestions =
            studentScore
              .testTotalQuestions ?? 0;

          const continuousAssessment =
            totalTestQuestions > 0
              ? Number(
                  (
                    (
                      totalTestCorrect /
                      totalTestQuestions
                    ) *
                    40
                  ).toFixed(2)
                )
              : 0;

          /*
           * ======================================================
           * FINAL SCORE
           * ======================================================
           */

          const finalScore =
            Number(
              (
                continuousAssessment +
                examContribution
              ).toFixed(2)
            );

          return {
            studentScore,

            assessment: {
              continuousAssessment,

              continuousAssessmentMaximum:
                40,

              examContribution,

              examMaximum:
                60,

              finalScore,

              finalMaximum:
                100,
            },

            exam: {
              correctAnswers:
                correctCount,

              totalQuestions,

              percentage:
                examPercentage,

              contribution:
                examContribution,

              contributionMaximum:
                60,
            },
          };
        }
      );

    /*
     * ============================================================
     * RESPONSE
     * ============================================================
     *
     * The exam has now been:
     *
     * 1. Validated
     * 2. Graded
     * 3. Saved
     *
     * It is therefore safe to return the review information.
     */

    return res.status(200).json({
      success: true,

      message:
        "Exam graded and saved successfully.",

      data: {

        assessment:
          result.assessment,

        exam: {
          correctAnswers:
            result.exam.correctAnswers,

          totalQuestions:
            result.exam.totalQuestions,

          percentage:
            result.exam.percentage,

          contribution:
            result.exam.contribution,

          contributionMaximum:
            result.exam
              .contributionMaximum,

          subjectId:
            subject.id,

          subjectName:
            subject.name,

          termId:
            term.id,

          termName:
            term.name,
        },

        review:
          gradedResults,
      },
    });
  } catch (error) {
    console.error(
      "[saveExamScore] Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to grade and save exam.",
    });
  }
}



export async function fetchStudentScores(
  req,
  res
) {
  try {
    const userId = req.user.userId;

    const { studentId } = req.query;

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

    const scores =
      await db.studentScore.findMany({
        where: {
          studentId: student.id,
        },
        include: {
          subject: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          subject: {
            name: "asc",
          },
        },
      });

    if (!scores.length) {
      return res.status(200).json({
        success: true,
        summary: null,
        subjects: [],
      });
    }

    const getEffectiveAverage = (subject) => {
      if (subject.exam.count > 0) {
        return subject.exam.average;
      }

      if (subject.test.count > 0) {
        return subject.test.average;
      }

      return 0;
    };

    const getPerformance =
      (score) => {
        if (score >= 75)
          return "Excellent";

        if (score >= 60)
          return "Good";

        if (score >= 50)
          return "Fair";

        return "Needs Improvement";
      };

    const calculateRating =
      (average) => {
        if (average >= 75)
          return 5;

        if (average >= 70)
          return 4;

        if (average >= 60)
          return 3;

        if (average >= 50)
          return 2;

        return 1;
      };

    const formatted =
      scores.map((score) => {
        const examAverage =
          Number(
            score.examAverageScore || 0
          );

        const testAverage =
          Number(
            score.testAverageScore || 0
          );

        return {
          subjectId:
            score.subject.id,

          subjectName:
            score.subject.name,

          test: {
            total:
              score.testTotalScore || 0,

            count:
              score.testCount || 0,

            lowest:
              score.testLowestScore || 0,

            highest:
              score.testHighestScore || 0,

            average:
              testAverage,

            questions: score.noOfTestQuestions,

            topics: Array.isArray(score.testTopics)
              ? score.testTopics
              : [],

            performance:
              getPerformance(
                testAverage
              ),
          },

          exam: {
            total:
              score.examTotalScore || 0,

            count:
              score.examCount || 0,

            lowest:
              score.examLowestScore || 0,

            highest:
              score.examHighestScore || 0,

            average:
              examAverage,

            performance:
              getPerformance(
                examAverage
              ),

            terms: Array.isArray(score.examTerms)
              ? score.examTerms
              : [],

            status:
              examAverage >= 50
                ? "Passed"
                : "Failed",
          },
        };
      });

    const overallTestAverage =
      formatted.reduce(
        (sum, subject) =>
          sum +
          subject.test.average,
        0
      ) / formatted.length;

    const overallExamAverage =
      formatted.reduce(
        (sum, subject) =>
          sum +
          subject.exam.average,
        0
      ) / formatted.length;

    const bestSubject =
      formatted.reduce((best, current) =>
        getEffectiveAverage(current) >
        getEffectiveAverage(best)
          ? current
          : best
      );

    const weakestSubject =
      formatted.reduce((worst, current) =>
        getEffectiveAverage(current) <
        getEffectiveAverage(worst)
          ? current
          : worst
      );

    const passedSubjects =
      formatted.filter(
        (subject) =>
          getEffectiveAverage(subject) >= 50
      ).length;

    const failedSubjects =
      formatted.filter(
        (subject) =>
          getEffectiveAverage(subject) < 50
      ).length;

    const overallAverage =
      overallExamAverage > 0
        ? overallExamAverage
        : overallTestAverage;

    const academicRating =
      calculateRating(overallAverage);

    const insights = [];

    if (bestSubject) {
      insights.push(
        `${bestSubject.subjectName} is your strongest subject with an average score of ${getEffectiveAverage(bestSubject).toFixed(1)}%`
      );
    }

    if (weakestSubject) {
      insights.push(
        `${weakestSubject.subjectName} requires more attention with an average score of ${getEffectiveAverage(weakestSubject).toFixed(1)}%`
      );
    }

    if (
      overallExamAverage >
      overallTestAverage
    ) {
      insights.push(
        "Your exam performance is higher than your test performance."
      );
    }

    if (
      overallTestAverage >
      overallExamAverage
    ) {
      insights.push(
        "Your continuous assessment performance is stronger than your exam performance."
      );
    }

    if (
      passedSubjects ===
      formatted.length
    ) {
      insights.push(
        "Excellent work. You passed all subjects."
      );
    }

    if (failedSubjects > 0) {
      insights.push(
        `You need improvement in ${failedSubjects} subject(s).`
      );
    }

    return res.status(200).json({
      success: true,

      summary: {
        totalSubjects:
          formatted.length,

        overallTestAverage:
          Number(
            overallTestAverage.toFixed(
              2
            )
          ),

        overallExamAverage:
          Number(
            overallExamAverage.toFixed(
              2
            )
          ),

        overallPerformance:
          getPerformance(
            overallAverage
          ),

        academicRating,

        passedSubjects,

        failedSubjects,

        bestSubject: {
          subjectId:
            bestSubject.subjectId,

          subjectName:
            bestSubject.subjectName,

          average:
            getEffectiveAverage(
              bestSubject
            ),
        },

        weakestSubject: {
          subjectId:
            weakestSubject.subjectId,

          subjectName:
            weakestSubject.subjectName,

          average:
            getEffectiveAverage(
              weakestSubject
            ),
        },
      },

      insights,

      subjects: formatted,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch scores",
    });
  }
}

export async function getMyAchievements(
  req,
  res
) {
  try {
    const userId = req.user.userId;
    const { studentId } = req.query;

    // 1. Resolve student
    const student = await resolveStudent({
      userId,
      studentId,
    });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }      

    const achievements =
      await db.achievement.findMany({
        where: {
          studentId: student.id,
        },

        orderBy: {
          earnedAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      achievements,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to load achievements",
    });
  }
}

export async function updateName(req, res) {
  try {
    const userId = req.user.userId;
    const { studentId } = req.query;

    const {
      firstName,
      lastName,
    } = req.body;

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

    let updated;

    //--------------------------------------------------
    // Parent updating a selected child
    //--------------------------------------------------

    if (studentId) {
      updated =
        await db.student.update({
          where: {
            id: student.id,
          },
          data: {
            firstName,
            lastName,
          },
        });
    }

    //--------------------------------------------------
    // Logged-in student updating own profile
    //--------------------------------------------------

    else {
      const [, updatedStudent] =
        await db.$transaction([
          db.user.update({
            where: {
              id: userId,
            },
            data: {
              firstName,
              lastName,
            },
          }),

          db.student.update({
            where: {
              id: student.id,
            },
            data: {
              firstName,
              lastName,
            },
          }),
        ]);

      updated = updatedStudent;
    }

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error(
      "Save name error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update name",
    });
  }
}

export async function updatePhone(req, res) {
  try {
    const userId = req.user.userId;
    const { studentId } = req.query;

    const { phone } = req.body;

    const student = await resolveStudent({
      userId,
      studentId,
    });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    let updated;

    //--------------------------------------------------
    // Parent updating a selected child
    //--------------------------------------------------

    if (studentId) {
      updated =
        await db.student.update({
          where: {
            id: student.id,
          },
          data: {
            phone,
          },
        });
    }

    else {
      updated = await db.student.update({
        where: {
          userId,
          },
          data: {
            phone,
          },
        })
    }

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error(
      "Update phone error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update phone",
    });
  }
}

export async function updateSchool(req, res) {
  try {
    const userId = req.user.userId;
    const { studentId } = req.query;

    const { school } = req.body;

    const student = await resolveStudent({
      userId,
      studentId,
    });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    let updated;

    if (studentId) {
      updated =
        await db.student.update({
          where: {
            id: student.id,
          },
          data: {
            schoolAttended: school,
          },
        });
    }

    //--------------------------------------------------
    // Logged-in student updating own profile
    //--------------------------------------------------

    else {
      updated = await db.student.update({
        where: {
          userId,
          },
          data: {
            schoolAttended: school,
          },
        })
    }

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error(
      "Update school error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update school",
    });
  }
}

export async function uploadStudentImageUrl(req, res) {
  try {
    const userId = req.user.userId;
    const { studentId } = req.query;
    const { studentImageUrl } = req.body;

    const student = await resolveStudent({
      userId,
      studentId,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    let updated;

    //--------------------------------------------------
    // Parent updating selected child
    //--------------------------------------------------
    if (studentId) {
      updated = await db.student.update({
        where: {
          id: student.id,
        },
        data: {
          studentImageUrl,
        },
      });
    }

    //--------------------------------------------------
    // Logged-in student updating own profile image
    //--------------------------------------------------
    else {
      updated = await db.$transaction(async (tx) => {
        // Update the User profile image
        await tx.user.update({
          where: {
            id: userId,
          },
          data: {
            profileImageUrl: studentImageUrl,
          },
        });

        // Update the Student profile image
        return await tx.student.update({
          where: {
            id: student.id,
          },
          data: {
            studentImageUrl,
          },
        });
      });
    }

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update student image error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload student image",
    });
  }
}


export async function promoteChild(
  req,
  res
) {
  try {
    const userId = req.user.userId;

    const {
      studentId,
      age,
      category,
      classId,
    } = req.body;

    //----------------------------------------------------
    // Validate input
    //----------------------------------------------------

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student is required.",
      });
    }

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: "Class is required.",
      });
    }

    const currentUser =
      await db.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (
      age === undefined ||
      age === null ||
      age === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Student age is required.",
      });
    }

    const numericAge = Number(age);

    if (
      !Number.isInteger(numericAge) ||
      numericAge < 1 ||
      numericAge > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid age.",
      });
    }

    //----------------------------------------------------
    // Find student
    //----------------------------------------------------

    const student = await db.student.findFirst({
      where: {
        id: studentId,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student to promote not found.",
      });
    }

    //----------------------------------------------------
    // Find selected class
    //----------------------------------------------------

    const selectedClass =
      await db.class.findUnique({
        where: {
          id: classId,
        },
      });

    if (!selectedClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found.",
      });
    }

    //----------------------------------------------------
    // Update student
    //----------------------------------------------------

    const updatedStudent =
      await db.student.update({
        where: {
          id: student.id,
        },
        data: {
          age,
          category,
          classId,
          classLevel:
            selectedClass.name,
        },
      });

    //----------------------------------------------------
    // Success
    //----------------------------------------------------

    return res.status(200).json({
      success: true,
      message:
        "Student promoted successfully.",
      student: updatedStudent,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to promote student.",
    });
  }
}


// =====================================================
// SAVE LESSON NOTE
// =====================================================

export async function saveLessonNote(req, res) {
  try {
    const { topicId } = req.params;

    const userId = req.user?.userId;

    const requestedStudentId =
      req.body?.studentId || null;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!topicId) {
      return res.status(400).json({
        success: false,
        message: "topicId is required.",
      });
    }

    const student = await resolveStudent({
      userId,
      studentId: requestedStudentId,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const content =
      typeof req.body?.content === "string"
        ? req.body.content
        : "";

    const note = await db.lessonNote.upsert({
      where: {
        studentId_topicId: {
          studentId: student.id,
          topicId,
        },
      },

      create: {
        studentId: student.id,
        topicId,
        content,
      },

      update: {
        content,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Lesson note saved successfully.",
      note: note.content,
    });
  } catch (error) {
    console.error(
      "Save lesson note error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to save lesson note.",
    });
  }
}


export async function getLessonNote(req, res) {
  try {
    const { topicId } = req.params;

    const userId = req.user?.userId;

    let requestedStudentId =
      req.query?.studentId || null;

    if (
      requestedStudentId === "null" ||
      requestedStudentId === "undefined"
    ) {
      requestedStudentId = null;
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!topicId) {
      return res.status(400).json({
        success: false,
        message: "topicId is required.",
      });
    }

    const student = await resolveStudent({
      userId,
      studentId: requestedStudentId,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const note = await db.lessonNote.findUnique({
      where: {
        studentId_topicId: {
          studentId: student.id,
          topicId,
        },
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      note: note?.content ?? "",
    });
  } catch (error) {
    console.error(
      "Get lesson note error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load lesson notes.",
    });
  }
}


export async function deleteAccount(req, res) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
        email: true,
        student: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    /*
     * This endpoint is specifically for a student's
     * own account.
     *
     * A parent must never be able to accidentally
     * delete the parent account simply because the
     * parent is currently viewing a child profile.
     */

    if (!user.student) {
      return res.status(403).json({
        success: false,
        message:
          "Only a student can delete a student account from this endpoint.",
      });
    }

    /*
     * Make sure the Student record actually belongs
     * to the authenticated User.
     */

    if (user.student.userId !== userId) {
      return res.status(403).json({
        success: false,
        message:
          "Student account ownership could not be verified.",
      });
    }

    /*
     * Delete the authenticated User.
     *
     * Based on your Prisma schema:
     *
     * Student.user -> User
     * onDelete: Cascade
     *
     * Therefore the student's Student record will
     * also be deleted automatically.
     *
     * Other related Student records that have proper
     * cascade relationships will also be handled by
     * the database.
     */

    await db.$transaction(async (tx) => {
      await tx.user.delete({
        where: {
          id: userId,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message:
        "Student account deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Delete student account error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete account.",
    });
  }
}


export async function getStudentAcademicReport(req, res) {
  try {
    // ==========================================
    // AUTHENTICATION
    // ==========================================

    const userId = req.user?.userId;
    const { studentId } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // ==========================================
    // RESOLVE AND AUTHORIZE STUDENT
    // ==========================================

    const student = await resolveStudent({
      userId,
      studentId,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    // ==========================================
    // FETCH ACADEMIC REPORT DATA
    // ==========================================

    const reportStudent = await db.student.findFirst({
      where: {
        id: student.id,
      },

      select: {
        // ======================================
        // STUDENT IDENTITY
        // ======================================

        id: true,
        firstName: true,
        lastName: true,
        classLevel: true,

        // ======================================
        // STUDENT PROFILE
        // ======================================

        studentProfile: {
          select: {
            xp: true,
            level: true,
            totalGames: true,
            totalWins: true,
            streak: true,
            highestScore: true,
            totalCorrect: true,
            totalWrong: true,
          },
        },

        // ======================================
        // SUBJECT SCORES
        // ======================================

        studentScores: {
          orderBy: [
            {
              subject: {
                name: "asc",
              },
            },
            {
              term: {
                name: "asc",
              },
            },
          ],

          select: {
            id: true,

            studentId: true,
            subjectId: true,
            termId: true,

            // ==================================
            // TEST
            // ==================================

            testTotalCorrect: true,
            testTotalQuestions: true,
            testCount: true,

            testLowestScore: true,
            testHighestScore: true,
            testAverageScore: true,

            testTopics: true,
            noOfTopics: true,

            // ==================================
            // EXAM
            // ==================================

            examTotalCorrect: true,
            examTotalQuestions: true,
            examTotalScore: true,
            examCount: true,

            examLowestScore: true,
            examHighestScore: true,
            examAverageScore: true,

            examTerms: true,

            // ==================================
            // SUBJECT
            // ==================================

            subject: {
              select: {
                id: true,
                name: true,
              },
            },

            // ==================================
            // TERM
            // ==================================

            term: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },

        // ======================================
        // ACHIEVEMENTS
        // ======================================

        studentAchievements: {
          orderBy: {
            earnedAt: "desc",
          },

          select: {
            id: true,
            achievementId: true,
            earnedAt: true,

            achievement: {
              select: {
                id: true,
                title: true,
                icon: true,
                code: true,
                description: true,
              },
            },
          },
        },

        // ======================================
        // TOPIC ANALYTICS
        // ======================================

        topicAnalytics: {
          orderBy: {
            lastAccessed: "desc",
          },

          select: {
            id: true,
            topicId: true,

            completionRate: true,
            averageScore: true,

            testCount: true,
            totalQuestions: true,
            totalCorrect: true,

            attemptedQuestionIds: true,

            lastScore: true,
            highestScore: true,
            lowestScore: true,

            lastAccessed: true,

            topic: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    // ==========================================
    // VERIFY STUDENT
    // ==========================================

    if (!reportStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    // ==========================================
    // STUDENT PROFILE
    // ==========================================

    const profile = reportStudent.studentProfile;

    const totalGames =
      profile?.totalGames ?? 0;

    const totalWins =
      profile?.totalWins ?? 0;

    const totalCorrect =
      profile?.totalCorrect ?? 0;

    const totalWrong =
      profile?.totalWrong ?? 0;

    const totalAnswered =
      totalCorrect + totalWrong;

    // ==========================================
    // WIN RATE
    // ==========================================

    const winRate =
      totalGames > 0
        ? Number(
            (
              (totalWins / totalGames) *
              100
            ).toFixed(2)
          )
        : 0;

    // ==========================================
    // ACCURACY
    // ==========================================

    const accuracy =
      totalAnswered > 0
        ? Number(
            (
              (totalCorrect / totalAnswered) *
              100
            ).toFixed(2)
          )
        : 0;

    // ==========================================
    // SUBJECT REPORTS
    //
    // StudentScore is grouped by subject.
    // Each subject contains its term reports.
    // ==========================================

    const subjectMap = new Map();

    for (const score of reportStudent.studentScores) {
      const subjectId = score.subjectId;

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          id: subjectId,

          name:
            score.subject?.name ??
            "Unknown Subject",

          terms: [],
        });
      }

      const subject =
        subjectMap.get(subjectId);

      // ======================================
      // NORMALIZE TEST TOPICS
      // ======================================

      let testTopics = [];

      if (Array.isArray(score.testTopics)) {
        testTopics = score.testTopics;
      } else if (score.testTopics) {
        testTopics = score.testTopics;
      }

      // ======================================
      // NORMALIZE EXAM TERMS
      // ======================================

      let examTerms = [];

      if (Array.isArray(score.examTerms)) {
        examTerms = score.examTerms;
      } else if (score.examTerms) {
        examTerms = score.examTerms;
      }

      // ======================================
      // TERM REPORT
      // ======================================

      subject.terms.push({
        id: score.termId,

        term: {
          id:
            score.term?.id ??
            score.termId,

          name:
            score.term?.name ??
            "Unknown Term",
        },

        // ====================================
        // TEST
        // ====================================

        test: {
          totalCorrect:
            score.testTotalCorrect ?? 0,

          totalQuestions:
            score.testTotalQuestions ?? 0,

          count:
            score.testCount ?? 0,

          lowestScore:
            score.testLowestScore ?? 0,

          highestScore:
            score.testHighestScore ?? 0,

          averageScore:
            score.testAverageScore ?? 0,

          noOfTopics:
            score.noOfTopics ?? 0,

          topics: testTopics,
        },

        // ====================================
        // EXAM
        // ====================================

        exam: {
          totalCorrect:
            score.examTotalCorrect ?? 0,

          totalQuestions:
            score.examTotalQuestions ?? 0,

          totalScore:
            score.examTotalScore ?? 0,

          count:
            score.examCount ?? 0,

          lowestScore:
            score.examLowestScore ?? 0,

          highestScore:
            score.examHighestScore ?? 0,

          averageScore:
            score.examAverageScore ?? 0,

          terms: examTerms,
        },
      });
    }

    const subjects =
      Array.from(subjectMap.values());

    // ==========================================
    // ACHIEVEMENT REPORT
    // ==========================================

    const achievements =
      reportStudent.studentAchievements.map(
        (studentAchievement) => ({
          id: studentAchievement.id,

          achievementId:
            studentAchievement.achievementId,

          code:
            studentAchievement.achievement?.code ??
            null,

          title:
            studentAchievement.achievement?.title ??
            "Achievement",

          icon:
            studentAchievement.achievement?.icon ??
            "🏆",

          description:
            studentAchievement.achievement
              ?.description ?? null,

          earnedAt:
            studentAchievement.earnedAt,
        })
      );

    // ==========================================
    // TOPIC PROGRESS
    // ==========================================

    const topicProgress =
      reportStudent.topicAnalytics.map(
        (analytics) => ({
          id: analytics.id,

          topicId:
            analytics.topicId,

          title:
            analytics.topic?.title ??
            "Unknown Topic",

          completionRate:
            analytics.completionRate ?? 0,

          averageScore:
            analytics.averageScore ?? 0,

          testCount:
            analytics.testCount ?? 0,

          totalQuestions:
            analytics.totalQuestions ?? 0,

          totalCorrect:
            analytics.totalCorrect ?? 0,

          attemptedQuestionIds:
            analytics.attemptedQuestionIds ??
            [],

          lastScore:
            analytics.lastScore ?? null,

          highestScore:
            analytics.highestScore ?? null,

          lowestScore:
            analytics.lowestScore ?? null,

          lastAccessed:
            analytics.lastAccessed ?? null,
        })
      );

    // ==========================================
    // TOPIC SUMMARY
    // ==========================================

    const totalTopics =
      topicProgress.length;

    const completedTopics =
      topicProgress.filter(
        (topic) =>
          Number(topic.completionRate) >= 100
      ).length;

    const overallCompletionRate =
      totalTopics > 0
        ? topicProgress.reduce(
            (total, topic) =>
              total +
              Number(
                topic.completionRate ?? 0
              ),
            0
          ) / totalTopics
        : 0;

    // ==========================================
    // OVERALL TOPIC AVERAGE SCORE
    // ==========================================

    const topicsWithScores =
      topicProgress.filter(
        (topic) =>
          typeof topic.averageScore ===
            "number" &&
          topic.averageScore > 0
      );

    const overallAverageScore =
      topicsWithScores.length > 0
        ? topicsWithScores.reduce(
            (total, topic) =>
              total +
              topic.averageScore,
            0
          ) /
          topicsWithScores.length
        : 0;

    // ==========================================
    // SUBJECT SUMMARY
    // ==========================================

    const totalSubjects =
      subjects.length;

    const totalSubjectTerms =
      subjects.reduce(
        (total, subject) =>
          total +
          subject.terms.length,
        0
      );

    // ==========================================
    // FINAL RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,

      data: {

        student: {
          id: reportStudent.id,

          firstName:
            reportStudent.firstName,

          lastName:
            reportStudent.lastName,

          classLevel:
            reportStudent.classLevel,
        },

        profile: {
          xp:
            profile?.xp ?? 0,

          level:
            profile?.level ?? 1,

          totalGames,

          totalWins,

          winRate,

          streak:
            profile?.streak ?? 0,

          highestScore:
            profile?.highestScore ?? 0,

          totalCorrect,

          totalWrong,

          totalAnswered,

          accuracy,
        },

        subjects,

        subjectSummary: {
          totalSubjects,

          totalSubjectTerms,
        },

        achievements,

        topicProgress,

        topicSummary: {
          totalTopics,

          completedTopics,

          overallCompletionRate:
            Number(
              overallCompletionRate.toFixed(2)
            ),

          overallAverageScore:
            Number(
              overallAverageScore.toFixed(2)
            ),
        },
      },
    });
  } catch (error) {
    console.error(
      "getStudentAcademicReport error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch academic report.",
    });
  }
}