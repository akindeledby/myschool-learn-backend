
import { db } from "../../../lib/db.js";
import { ai } from "../../../lib/gemini.js";
import { MemorySchema } from "./schemas/memory.schema.js";
import { parseGeminiJson } from "../../utils/parseGeminiJson.js";

/*
 * Categories allowed by the application.
 *
 * Keep this synchronized with MemorySchema.
 */
const MEMORY_CATEGORIES = new Set([
  "learning_style",
  "strength",
  "weakness",
  "interest",
  "goal",
  "subject_preference",
  "behavior",
  "general",
]);

export async function updateTutorMemory({
  conversationId,
  studentId,
}) {
  // console.log("\n============================================================");
  // console.log("[TutorMemory] updateTutorMemory() STARTED");
  // console.log("[TutorMemory] conversationId:", conversationId);
  // console.log("[TutorMemory] studentId:", studentId);
  // console.log("============================================================\n");

  /*
  ============================================================
  VALIDATION
  ============================================================
  */

  if (!conversationId || !studentId) {
    console.warn(
      "[TutorMemory] Missing conversationId or studentId."
    );

    console.warn(
      "[TutorMemory] Memory update skipped."
    );

    return;
  }

  // console.log(
  //   "[TutorMemory] Validation passed."
  // );

  /*
  ============================================================
  LOAD CONVERSATION
  ============================================================
  */

  // console.log(
  //   "[TutorMemory] Loading tutor messages..."
  // );

  let messages;

  try {
    messages =
      await db.tutorMessage.findMany({
        where: {
          conversationId,
        },

        select: {
          role: true,
          content: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      });
  } catch (error) {
    console.error(
      "[TutorMemory] Failed to load tutor messages:",
      error
    );

    throw error;
  }

  // console.log(
  //   "[TutorMemory] Messages loaded:",
  //   messages.length
  // );

  if (!messages.length) {
    // console.log(
    //   "[TutorMemory] No messages found."
    // );

    // console.log(
    //   "[TutorMemory] Memory update finished."
    // );

    return;
  }

  /*
  ============================================================
  BUILD TRANSCRIPT
  ============================================================
  */

  // console.log(
  //   "[TutorMemory] Building conversation transcript..."
  // );

  const transcript =
    messages
      .filter(
        (message) =>
          message.content?.trim()
      )
      .map(
        (message) =>
          `${message.role}: ${message.content}`
      )
      .join("\n");

  // console.log(
  //   "[TutorMemory] Transcript length:",
  //   transcript.length
  // );

  if (!transcript.trim()) {
    // console.log(
    //   "[TutorMemory] Transcript is empty."
    // );

    // console.log(
    //   "[TutorMemory] Memory update finished."
    // );

    return;
  }

  // console.log(
  //   "[TutorMemory] Transcript successfully built."
  // );

  /*
  ============================================================
  DEBUG TRANSCRIPT
  ============================================================
  *
  * Temporarily useful while debugging memory extraction.
  *
  * Remove or reduce this log in production if conversations
  * contain information that should not appear in server logs.
  */

  // console.log(
  //   "\n[TutorMemory] Conversation transcript:"
  // );

  // console.log(
  //   transcript
  // );

  // console.log(
  //   "\n[TutorMemory] End conversation transcript.\n"
  // );

  /*
  ============================================================
  GENERATE MEMORY
  ============================================================
  */

  // console.log(
  //   "[TutorMemory] Sending conversation to Gemini..."
  // );

  let response;

  try {
    response =
      await ai.models.generateContent({
        model: "gemini-2.5-flash",

        contents: `
          You are the long-term memory system for an AI Tutor.

          Your job is to identify useful, durable information about the
          student from the conversation.

          Extract information that can help the Tutor provide better
          personalized teaching in future conversations.

          IMPORTANT:

          The student does NOT need to explicitly ask you to remember
          something.

          If the conversation clearly reveals a useful learning fact,
          store it.

          ============================================================
          WHAT SHOULD BE REMEMBERED
          ============================================================

          1. LEARNING PREFERENCES

          Examples:

          The student prefers examples.

          The student learns better with visual explanations.

          The student prefers step-by-step explanations.

          The student prefers simple explanations before advanced ones.

          The student prefers practical examples.

          Category:

          learning_style


          2. STRENGTHS

          Examples:

          The student understands multiplication well.

          The student is strong in basic algebra.

          The student quickly understands scientific concepts.

          The student demonstrates good understanding of fractions.

          Category:

          strength


          3. WEAKNESSES

          Examples:

          The student struggles with fractions.

          The student has difficulty understanding algebraic equations.

          The student repeatedly makes mistakes with negative numbers.

          The student has difficulty identifying grammatical errors.

          Category:

          weakness


          4. INTERESTS

          Examples:

          The student is interested in space.

          The student enjoys learning about animals.

          The student is interested in computer programming.

          The student enjoys science experiments.

          Category:

          interest


          5. GOALS

          Examples:

          The student wants to improve in mathematics.

          The student wants to prepare for an examination.

          The student wants to become better at solving algebra problems.

          The student wants to improve their understanding of physics.

          Category:

          goal


          6. SUBJECT PREFERENCES

          Examples:

          The student enjoys mathematics.

          The student prefers science topics.

          The student particularly enjoys biology.

          The student prefers practical science questions.

          Category:

          subject_preference


          7. LEARNING BEHAVIOR

          Examples:

          The student frequently asks for examples.

          The student often asks the Tutor to explain concepts again.

          The student tends to answer quickly without checking their work.

          The student frequently asks follow-up questions.

          Category:

          behavior


          8. GENERAL USEFUL TUTORING INFORMATION

          Use this only for useful information that does not fit the
          other categories.

          Category:

          general


          ============================================================
          IMPORTANT MEMORY RULES
          ============================================================

          Only extract information that is useful for future tutoring.

          Do not store temporary conversational information.

          Do not store greetings, thanks, acknowledgements, or ordinary
          conversation.

          Do not store facts that are only about the current question
          unless they reveal something useful about the student's
          knowledge, preference, weakness, strength, goal, or behavior.

          Do not invent information.

          Do not make unsupported assumptions.

          Do not infer sensitive personal information.

          A single clear statement from the student can be enough to
          create a memory.

          Repeated evidence can increase the importance of a memory.

          If the same learning characteristic appears repeatedly,
          treat it as stronger evidence.

          Prefer information that is likely to remain useful across
          future tutoring sessions.

          Do not create a memory simply because a fact appears once
          unless it is clearly useful for future tutoring.

          Do not store the Tutor's own statements as student memories.

          Only store information about the student.

          ============================================================
          MEMORY KEY RULES
          ============================================================

          The key must be:

          Short.

          Stable.

          Descriptive.

          Reusable for future updates.

          Do not include random IDs.

          Do not create unnecessarily different keys for the same
          underlying memory.

          For example:

          "prefers_examples"

          "weakness_fractions"

          "strength_algebra"

          "goal_math_improvement"

          ============================================================
          IMPORTANCE RULES
          ============================================================

          importance must be an INTEGER from 1 to 10.

          Use:

          1 to 3 for minor information.

          4 to 6 for moderately useful information.

          7 to 8 for important tutoring information.

          9 to 10 for highly important information that should strongly
          influence future tutoring.

          ============================================================
          CATEGORY RULES
          ============================================================

          The category MUST be exactly one of:

          learning_style
          strength
          weakness
          interest
          goal
          subject_preference
          behavior
          general

          Do not use any other category.

          Do not capitalize category names.

          Do not use spaces in category names.

          ============================================================
          OUTPUT RULES
          ============================================================

          Return ONLY valid JSON.

          Do not return Markdown.

          Do not return code fences.

          Do not return explanations.

          Do not return comments.

          Use exactly this structure:

          {
            "memories": [
              {
                "key": "short_unique_key",
                "value": "useful information about the student",
                "category": "learning_style",
                "importance": 7
              }
            ]
          }

          If there is genuinely no useful long-term tutoring information,
          return:

          {
            "memories": []
          }

          Prefer a small number of high-quality memories over many weak
          memories.

          Conversation:

          ${transcript}
        `,
      });
  } catch (error) {
    console.error(
      "[TutorMemory] Gemini request failed:",
      error
    );

    throw error;
  }

  // console.log(
  //   "[TutorMemory] Gemini request completed."
  // );

  /*
  ============================================================
  LOG RAW GEMINI RESPONSE
  ============================================================
  */

  const rawResponse =
    response?.text || "";

  // console.log(
  //   "\n[TutorMemory] Gemini response text:"
  // );

  console.log(
    rawResponse
  );

  // console.log(
  //   "\n[TutorMemory] End Gemini response.\n"
  // );

  /*
  ============================================================
  PARSE GEMINI JSON
  ============================================================
  */

  // console.log(
  //   "[TutorMemory] Parsing Gemini JSON..."
  // );

  let rawData;

  try {
    rawData =
      parseGeminiJson(
        rawResponse
      );

    // console.log(
    //   "[TutorMemory] Gemini JSON parsed successfully."
    // );

    console.log(
      "[TutorMemory] Parsed Gemini data:",
      JSON.stringify(
        rawData,
        null,
        2
      )
    );
  } catch (error) {
    console.error(
      "[TutorMemory] Failed to parse Gemini response:",
      error
    );

    console.error(
      "[TutorMemory] Raw Gemini response:",
      rawResponse
    );

    return;
  }

  /*
  ============================================================
  EXTRACT RAW MEMORIES
  ============================================================
  */

  const rawMemories =
    Array.isArray(
      rawData?.memories
    )
      ? rawData.memories
      : [];

  // console.log(
  //   "[TutorMemory] Raw memories returned by Gemini:",
  //   rawMemories.length
  // );

  if (!rawMemories.length) {
    // console.log(
    //   "[TutorMemory] Gemini returned ZERO memories."
    // );

    // console.log(
    //   "[TutorMemory] Nothing will be inserted into TutorMemory."
    // );

    // console.log(
    //   "[TutorMemory] updateTutorMemory() FINISHED."
    // );

    return;
  }

  /*
  ============================================================
  LOG RAW MEMORIES
  ============================================================
  */

  // console.log(
  //   "[TutorMemory] Raw memories:"
  // );

  console.log(
    JSON.stringify(
      rawMemories,
      null,
      2
    )
  );

  /*
  ============================================================
  FILTER INVALID MEMORIES
  ============================================================
  *
  * Gemini can occasionally return an unexpected category or
  * malformed memory.
  *
  * Filter those memories before Zod validation so that one bad
  * memory does not prevent valid memories from being saved.
  */

  const validMemories =
    rawMemories.filter(
      (memory) => {
        const valid =
          memory &&
          typeof memory.key === "string" &&
          memory.key.trim() &&
          typeof memory.value === "string" &&
          memory.value.trim() &&
          MEMORY_CATEGORIES.has(
            memory.category
          );

        if (!valid) {
          console.warn(
            "[TutorMemory] Invalid memory filtered out:",
            memory
          );
        }

        return valid;
      }
    );

  // console.log(
  //   "[TutorMemory] Valid memories after filtering:",
  //   validMemories.length
  // );

  if (!validMemories.length) {
    console.warn(
      "[TutorMemory] All Gemini memories were invalid."
    );

    // console.log(
    //   "[TutorMemory] Nothing will be inserted into TutorMemory."
    // );

    // console.log(
    //   "[TutorMemory] updateTutorMemory() FINISHED."
    // );

    return;
  }

  /*
  ============================================================
  ZOD VALIDATION
  ============================================================
  */

  // console.log(
  //   "[TutorMemory] Validating memories with MemorySchema..."
  // );

  const parsed =
    MemorySchema.safeParse({
      memories:
        validMemories,
    });

  if (!parsed.success) {
    console.error(
      "[TutorMemory] Memory validation failed:"
    );

    console.error(
      parsed.error
    );

    console.error(
      "[TutorMemory] Memories that failed validation:",
      JSON.stringify(
        validMemories,
        null,
        2
      )
    );

    return;
  }

  // console.log(
  //   "[TutorMemory] MemorySchema validation successful."
  // );

  // console.log(
  //   "[TutorMemory] Memories ready for database:",
  //   parsed.data.memories.length
  // );

  /*
  ============================================================
  UPSERT MEMORIES
  ============================================================
  */

  let savedCount = 0;
  let failedCount = 0;

  for (
    const memory of
    parsed.data.memories
  ) {
    const key =
      memory.key.trim();

    const value =
      memory.value.trim();

    // console.log(
    //   "\n[TutorMemory] Preparing to save memory:"
    // );

    // console.log(
    //   "[TutorMemory] key:",
    //   key
    // );

    // console.log(
    //   "[TutorMemory] value:",
    //   value
    // );

    // console.log(
    //   "[TutorMemory] category:",
    //   memory.category
    // );

    // console.log(
    //   "[TutorMemory] importance:",
    //   memory.importance
    // );

    try {
      const savedMemory =
        await db.tutorMemory.upsert({
          where: {
            studentId_key: {
              studentId,

              key,
            },
          },

          update: {
            value,

            category:
              memory.category,

            importance:
              memory.importance,
          },

          create: {
            studentId,

            key,

            value,

            category:
              memory.category,

            importance:
              memory.importance,
          },
        });

      savedCount++;

      // console.log(
      //   "[TutorMemory] Memory saved successfully."
      // );

      // console.log(
      //   "[TutorMemory] Database memory ID:",
      //   savedMemory.id
      // );
    } catch (error) {
      failedCount++;

      console.error(
        `[TutorMemory] Failed to save memory "${key}":`,
        error
      );
    }
  }

  /*
  ============================================================
  FINAL RESULT
  ============================================================
  */

  // console.log("\n============================================================");

  // console.log(
  //   "[TutorMemory] updateTutorMemory() FINISHED"
  // );

  // console.log(
  //   "[TutorMemory] Memories detected:",
  //   rawMemories.length
  // );

  // console.log(
  //   "[TutorMemory] Memories accepted:",
  //   parsed.data.memories.length
  // );

  // console.log(
  //   "[TutorMemory] Memories saved:",
  //   savedCount
  // );

  // console.log(
  //   "[TutorMemory] Memories failed:",
  //   failedCount
  // );

  // console.log("============================================================\n");
}
