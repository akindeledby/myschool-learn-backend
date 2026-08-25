import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../../lib/db.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateQuizForTopic(topicId) {
  const topic = await db.topic.findUnique({
    where: { id: topicId },
    include: {
      subTopics: {
        include: {
          contents: true,
        },
      },
    },
  });

  if (!topic) throw new Error("Topic not found");

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
  });

  const prompt = `
You are an expert teacher.

Generate a quiz based on this topic:

TITLE: ${topic.title}

OBJECTIVES:
${topic.objectives?.join("\n")}

CONTENT:
${topic.subTopics
  .map((s) =>
    s.contents.map((c) => c.body).join("\n")
  )
  .join("\n")}

Return STRICT JSON:

{
  "title": "Quiz Title",
  "questions": [
    {
      "text": "",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": ""
    }
  ]
}

Rules:
- 5 to 10 questions
- 4 options each
- correctAnswer must match one option exactly
- no explanations
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let quizData;

  try {
    quizData = JSON.parse(text);
  } catch (err) {
    console.error("Quiz parse error:", text);
    throw new Error("Invalid quiz JSON");
  }

  // ✅ Save to DB
  const createdQuiz = await db.quiz.create({
    data: {
      title: quizData.title,
      topicId: topic.id,
      questions: {
        create: quizData.questions.map((q) => ({
          text: q.text,
          correctAnswer: q.correctAnswer,
          options: {
            create: q.options.map((opt) => ({
              text: opt,
            })),
          },
        })),
      },
    },
  });

  return createdQuiz;
}