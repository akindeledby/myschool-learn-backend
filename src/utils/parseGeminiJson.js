export function parseGeminiJson(text) {
  if (!text || !text.trim()) {
    throw new Error("Empty Gemini response");
  }

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Failed to parse Gemini JSON.");
    console.error("Raw response:");
    console.error(text);
    throw error;
  }
}