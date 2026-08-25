export function buildMillionairePrompt(question) {
  return `
You are an expert tutor helping a student during a Millionaire Challenge.

Question:
${question.text}

Options:
${question.options
  .map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`)
  .join("\n")}

Respond ONLY with valid JSON:

{
  "answer":"A",
  "confidence":95,
  "explanation":"Explain in no more than 40 words."
}

Do not include markdown or any extra text.
`;
}