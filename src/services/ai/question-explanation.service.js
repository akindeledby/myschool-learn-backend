import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

// ============================================================
// RESPONSE SCHEMA
// ============================================================

const explanationResponseSchema = {
  type: "object",

  properties: {
    explanation: {
      type: "string",
    },
  },

  required: [
    "explanation",
  ],
};

// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

// ============================================================
// GENERATE QUESTION EXPLANATION
// ============================================================

export async function generateQuestionExplanation({
  text,
  options,
  correctAnswer,
  subjectName,
  topicTitle,
  className,
}) {
  if (!text) {
    throw new Error(
      "Question text is required."
    );
  }

  if (!Array.isArray(options)) {
    throw new Error(
      "Question options are required."
    );
  }

  if (!correctAnswer) {
    throw new Error(
      "Correct answer is required."
    );
  }

  const model =
    genAI.getGenerativeModel({
      model: "gemini-2.5-flash",

      generationConfig: {
        responseMimeType:
          "application/json",

        responseSchema:
          explanationResponseSchema,

        temperature: 0.3,
      },
    });

  const prompt = `
You are an expert teacher creating educational
feedback for a student.

Subject:
${subjectName || "Not specified"}

Topic:
${topicTitle || "Not specified"}

Class Level:
${className || "Not specified"}

Question:
${text}

Options:

${options
  .map(
    (option, index) =>
      `${index + 1}. ${option}`
  )
  .join("\n")}

Correct Answer:
${correctAnswer}

Generate a clear explanation for why the supplied
correct answer is correct.

IMPORTANT:

1. Explain the underlying concept clearly.

2. The explanation must directly answer the question.

3. The explanation must agree with the supplied
   correct answer.

4. Do not change the correct answer.

5. Do not introduce unrelated information.

6. Do not invent unsupported facts.

7. Keep the explanation appropriate for the
   specified class level.

8. Keep the explanation concise but educational.

9. Do not merely say:
   "The correct answer is ..."

10. Do not explain the incorrect options.

11. Do not use markdown.

12. Return only JSON matching the supplied schema.
`;

  console.log(
    `🧠 Generating explanation for question: ${text}`
  );

  const result =
    await model.generateContent(prompt);

  const rawResponse =
    result.response.text();

  let data;

  try {
    data =
      JSON.parse(rawResponse);
  } catch (error) {
    console.error(
      "❌ Failed to parse explanation response."
    );

    console.error(
      rawResponse
    );

    throw new Error(
      "Invalid explanation response from Gemini."
    );
  }

  const explanation =
    normalizeText(
      data?.explanation
    );

  if (!explanation) {
    throw new Error(
      "Gemini generated an empty explanation."
    );
  }

  return explanation;
}