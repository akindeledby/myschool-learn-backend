import { ai } from "../../../lib/gemini.js";

export async function classifyQuestion(question) {
  try {
    const response =
      await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `
          You are an educational content classifier.

          Determine whether the student's question is educational or academic.

          Academic examples:
          - mathematics and numeracy
          - english
          - Phonics and pronunciation
          - literature-in-english
          - Basic Science
          - Basic Technology
          - Physical and Health Education
          - Home Economics
          - Music
          - Fine and Creative Art
          - Business Studies
          - Social Studies
          - Security Education
          - Yoruba/Igbo/Hausa/French Language
          - History
          - physics
          - chemistry
          - biology
          - economics
          - history
          - geography
          - agricultural science
          - commerce
          - government
          - literature
          - computer science
          - civic education
          - social studies
          - further mathematics
          - accounting
          - Study skills
          - Career guidance
          - Homework help
          - Exam preparation

          Non-academic examples:
          - Violence
          - Crime
          - Hacking
          - Pornography
          - Vulgar content
          - Gambling
          - Illegal activities
          - Relationship advice
          - Politics
          - Entertainment gossip

          Return ONLY one word:

          ACADEMIC

          or

          NON_ACADEMIC

          Question:
          ${question}
          `,
      });

    return response.text.trim();
  } catch (error) {
    console.error(
      "Question classification error:",
      error
    );

    return "NON_ACADEMIC";
  }
}