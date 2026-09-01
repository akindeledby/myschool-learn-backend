
import { db } from "../../../lib/db.js";


/**
 * Resolves a student's free-text message to an existing
 * curriculum Topic.
 *
 * This service ONLY resolves the topic.
 *
 * It does not:
 *
 * 1. Create TutorLessonProgress
 * 2. Create TutorLessonSession
 * 3. Create TutorObjectiveProgress
 * 4. Generate TopicObjective records
 * 5. Start Gemini
 *
 * Once a topic is successfully resolved, the caller can pass
 * the resolved topic into the existing curriculum lesson flow.
 *
 * Expected flow:
 *
 * Student message
 *        ↓
 * resolveTutorTopic()
 *        ↓
 * Topic found?
 *      /   \
 *    YES    NO
 *     ↓      ↓
 * Curriculum  Normal
 * Lesson      Tutor
 *
 * @param {Object} params
 * @param {Object} params.student
 * @param {string} params.message
 *
 * @returns {Promise<Object>}
 */
export async function resolveTutorTopic({
  student,
  message,
}) {
  /*
   * ============================================================
   * VALIDATE STUDENT
   * ============================================================
   */

  if (!student?.id) {
    const error = new Error(
      "A valid student is required to resolve a Tutor topic."
    );

    error.statusCode = 400;

    throw error;
  }

  /*
   * ============================================================
   * VALIDATE MESSAGE
   * ============================================================
   */

  if (
    typeof message !== "string" ||
    !message.trim()
  ) {
    const error = new Error(
      "A valid Tutor message is required to resolve a topic."
    );

    error.statusCode = 400;

    throw error;
  }

  /*
   * ============================================================
   * RESOLVE STUDENT CLASS
   * ============================================================
   *
   * Your Topic model uses classId rather than classLevel.
   *
   * Therefore the student's classId is the most important
   * curriculum boundary when searching for a topic.
   */

  const studentRecord =
    await db.student.findUnique({
      where: {
        id: student.id,
      },

      select: {
        id: true,
        classId: true,
      },
    });

  if (!studentRecord) {
    const error = new Error(
      "Student could not be found."
    );

    error.statusCode = 404;

    throw error;
  }

  if (!studentRecord.classId) {
    return {
      matched: false,

      topic: null,

      confidence: 0,

      reason:
        "The student is not assigned to a class.",
    };
  }

  /*
   * ============================================================
   * NORMALIZE MESSAGE
   * ============================================================
   */

  const normalizedMessage =
    normalizeText(message);

  if (!normalizedMessage) {
    return {
      matched: false,

      topic: null,

      confidence: 0,

      reason:
        "The message does not contain enough information to resolve a topic.",
    };
  }

  /*
   * ============================================================
   * LOAD CURRICULUM TOPICS
   * ============================================================
   *
   * Only topics belonging to the student's class are searched.
   *
   * We deliberately select only the fields required for
   * resolution.
   *
   * lessonContents, lessonPlan, lessonObjectives and other
   * potentially large fields are NOT loaded here.
   */

  const topics =
    await db.topic.findMany({
      where: {
        classId:
          studentRecord.classId,
      },

      select: {
        id: true,

        title: true,

        classId: true,

        subjectId: true,

        termId: true,

        schemeOfWorkId: true,

        subject: {
          select: {
            id: true,
            name: true,
          },
        },

        term: {
          select: {
            id: true,
            name: true,
          },
        },

        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      orderBy: [
        {
          subjectId: "asc",
        },
        {
          termId: "asc",
        },
        {
          title: "asc",
        },
      ],
    });

  /*
   * ============================================================
   * NO TOPICS
   * ============================================================
   */

  if (!topics.length) {
    return {
      matched: false,

      topic: null,

      confidence: 0,

      reason:
        "No curriculum topics are available for the student's class.",
    };
  }

  /*
   * ============================================================
   * TOKENIZE MESSAGE
   * ============================================================
   */

  const messageTokens =
    tokenize(normalizedMessage);

  if (!messageTokens.length) {
    return {
      matched: false,

      topic: null,

      confidence: 0,

      reason:
        "The message does not contain enough meaningful words to resolve a curriculum topic.",
    };
  }

  /*
   * ============================================================
   * SCORE TOPICS
   * ============================================================
   */

  const candidates =
    topics
      .map((topic) => {
        const title =
          normalizeText(
            topic.title
          );

        const subject =
          normalizeText(
            topic.subject?.name
          );

        const term =
          normalizeText(
            topic.term?.name
          );

        const className =
          normalizeText(
            topic.class?.name
          );

        const titleTokens =
          tokenize(title);

        const subjectTokens =
          tokenize(subject);

        let score = 0;

        /*
         * ------------------------------------------------------
         * EXACT TOPIC TITLE PHRASE
         * ------------------------------------------------------
         *
         * This is the strongest signal.
         *
         * Example:
         *
         * Topic:
         * "Photosynthesis"
         *
         * Message:
         * "Please explain photosynthesis to me."
         */

        if (
          title &&
          normalizedMessage.includes(
            title
          )
        ) {
          score += 70;
        }

        /*
         * ------------------------------------------------------
         * TOPIC TITLE TOKEN MATCH
         * ------------------------------------------------------
         */

        const titleMatches =
          countMatches(
            messageTokens,
            titleTokens
          );

        if (titleTokens.length > 0) {
          const titleCoverage =
            titleMatches /
            titleTokens.length;

          score +=
            titleCoverage * 40;
        }

        /*
         * ------------------------------------------------------
         * SUBJECT MATCH
         * ------------------------------------------------------
         *
         * Subject information provides supporting evidence.
         *
         * It should NEVER be enough by itself to select a topic.
         */

        const subjectMatches =
          countMatches(
            messageTokens,
            subjectTokens
          );

        if (
          subjectTokens.length > 0 &&
          subjectMatches > 0
        ) {
          score +=
            Math.min(
              subjectMatches * 5,
              10
            );
        }

        /*
         * ------------------------------------------------------
         * SUBJECT PHRASE MATCH
         * ------------------------------------------------------
         */

        if (
          subject &&
          normalizedMessage.includes(
            subject
          )
        ) {
          score += 5;
        }

        /*
         * ------------------------------------------------------
         * TERM MATCH
         * ------------------------------------------------------
         *
         * Term is useful supporting information but is not
         * strong enough to identify a topic on its own.
         */

        if (
          term &&
          normalizedMessage.includes(
            term
          )
        ) {
          score += 3;
        }

        /*
         * ------------------------------------------------------
         * CLASS MATCH
         * ------------------------------------------------------
         *
         * The topic has already been restricted to the
         * student's class, so class matching is only a minor
         * supporting signal.
         */

        if (
          className &&
          normalizedMessage.includes(
            className
          )
        ) {
          score += 2;
        }

        return {
          topic,

          score,

          titleMatches,

          subjectMatches,
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score
      );

  /*
   * ============================================================
   * BEST CANDIDATE
   * ============================================================
   */

  const bestCandidate =
    candidates[0];

  const secondCandidate =
    candidates[1] || null;

  if (!bestCandidate) {
    return {
      matched: false,

      topic: null,

      confidence: 0,

      reason:
        "No curriculum topic candidate was found.",
    };
  }

  /*
   * ============================================================
   * NORMALIZE CONFIDENCE
   * ============================================================
   */

  const confidence =
    Math.min(
      Math.round(
        bestCandidate.score
      ),
      100
    );

  /*
   * ============================================================
   * MINIMUM CONFIDENCE
   * ============================================================
   *
   * We do NOT want:
   *
   * "Can you help me with school?"
   *
   * to randomly become a specific lesson.
   */

  const MINIMUM_CONFIDENCE =
    35;

  if (
    confidence <
    MINIMUM_CONFIDENCE
  ) {
    return {
      matched: false,

      topic: null,

      confidence,

      reason:
        "No sufficiently strong curriculum topic match was found.",
    };
  }

  /*
   * ============================================================
   * AMBIGUOUS MATCH PROTECTION
   * ============================================================
   *
   * Example:
   *
   * "Algebraic expressions"
   * "Algebraic equations"
   *
   * If both topics receive almost identical scores, we should
   * not blindly choose one.
   */

  if (secondCandidate) {
    const scoreDifference =
      bestCandidate.score -
      secondCandidate.score;

    if (
      scoreDifference < 10 &&
      confidence < 60
    ) {
      return {
        matched: false,

        topic: null,

        confidence,

        ambiguous: true,

        candidates: [
          formatCandidate(
            bestCandidate
          ),

          formatCandidate(
            secondCandidate
          ),
        ],

        reason:
          "Multiple curriculum topics are similarly relevant.",
      };
    }
  }

  /*
   * ============================================================
   * RETURN RESOLVED TOPIC
   * ============================================================
   *
   * We return the complete lightweight topic object that was
   * deliberately selected above.
   *
   * The caller can now pass topic.id into the existing lesson
   * architecture.
   */

  return {
    matched: true,

    confidence,

    ambiguous: false,

    topic: bestCandidate.topic,

    subject:
      bestCandidate.topic.subject ||
      null,

    term:
      bestCandidate.topic.term ||
      null,

    class:
      bestCandidate.topic.class ||
      null,

    reason:
      "The student's message was successfully matched to a curriculum topic.",
  };
}


/*
 * ==============================================================
 * NORMALIZE TEXT
 * ==============================================================
 */

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}\s]/gu,
      " "
    )
    .replace(
      /\s+/g,
      " "
    );
}


/*
 * ==============================================================
 * TOKENIZE
 * ==============================================================
 */

function tokenize(value) {
  const normalized =
    normalizeText(value);

  if (!normalized) {
    return [];
  }

  return [
    ...new Set(
      normalized
        .split(" ")
        .filter(
          (token) =>
            token.length >= 3 &&
            !STOP_WORDS.has(
              token
            )
        )
    ),
  ];
}


/*
 * ==============================================================
 * COUNT TOKEN MATCHES
 * ==============================================================
 */

function countMatches(
  sourceTokens,
  targetTokens
) {
  if (
    !sourceTokens.length ||
    !targetTokens.length
  ) {
    return 0;
  }

  const sourceSet =
    new Set(sourceTokens);

  return targetTokens.filter(
    (token) =>
      sourceSet.has(token)
  ).length;
}


/*
 * ==============================================================
 * FORMAT AMBIGUOUS CANDIDATE
 * ==============================================================
 */

function formatCandidate(
  candidate
) {
  return {
    topicId:
      candidate.topic.id,

    title:
      candidate.topic.title,

    subject:
      candidate.topic.subject?.name ||
      null,

    term:
      candidate.topic.term?.name ||
      null,

    confidence:
      Math.min(
        Math.round(
          candidate.score
        ),
        100
      ),
  };
}


/*
 * ==============================================================
 * STOP WORDS
 * ==============================================================
 */

const STOP_WORDS =
  new Set([
    "the",
    "and",
    "for",
    "are",
    "you",
    "can",
    "please",
    "help",
    "with",
    "about",
    "what",
    "how",
    "why",
    "explain",
    "tell",
    "teach",
    "understand",
    "want",
    "need",
    "this",
    "that",
    "from",
    "into",
    "does",
    "make",
    "give",
    "show",
    "learn",
    "lesson",
    "topic",
    "me",
    "my",
    "is",
    "of",
    "to",
    "in",
    "on",
    "a",
    "an",
  ]);
