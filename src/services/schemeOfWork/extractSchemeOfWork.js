import { GoogleGenAI } from "@google/genai";
import {
  createSchemeOfWorkCache,
} from "./schemeOfWorkCache.service.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-2.5-flash";

function logGeminiUsage(response) {
  const usage = response.usageMetadata;

  if (!usage) {
    console.log(
      "⚠️ Gemini usage metadata was not returned."
    );

    return;
  }

  const promptTokens =
    usage.promptTokenCount || 0;

  const cachedTokens =
    usage.cachedContentTokenCount || 0;

  const outputTokens =
    usage.candidatesTokenCount || 0;

  const uncachedInputTokens =
    Math.max(
      promptTokens - cachedTokens,
      0
    );

  console.log(
    "\n📊 Gemini Token Usage"
  );

  console.log(
    `   Prompt tokens:        ${promptTokens}`
  );

  console.log(
    `   Cached tokens:        ${cachedTokens}`
  );

  console.log(
    `   New input tokens:     ${uncachedInputTokens}`
  );

  console.log(
    `   Output tokens:        ${outputTokens}`
  );

  console.log(
    `   Total tokens:         ${
      usage.totalTokenCount || 0
    }`
  );

  if (cachedTokens > 0) {
    const cachePercentage =
      promptTokens > 0
        ? (
            (cachedTokens /
              promptTokens) *
            100
          ).toFixed(2)
        : "0.00";

    console.log(
      `💰 Cache hit: ${cachePercentage}% of input tokens`
    );

    console.log(
      `💰 Tokens served from cache: ${cachedTokens}`
    );
  } else {
    console.log(
      "⚠️ No cached tokens were used."
    );
  }

  console.log("");
}

export async function extractSchemeOfWork(pdfBuffer) {
  try {
    console.log(
      "🧠 Gemini Scheme of Work extraction started"
    );

    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new Error(
        "extractSchemeOfWork expected a PDF Buffer."
      );
    }

    if (pdfBuffer.length === 0) {
      throw new Error(
        "The supplied PDF buffer is empty."
      );
    }

    const cache =
      await createSchemeOfWorkCache({
        ttl: "3600s",
      });

    const response =
      await ai.models.generateContent({
        model: MODEL,

        config: {
          cachedContent: cache.name,

          responseMimeType:
            "application/json",

          maxOutputTokens: 65536,

          temperature: 0,
        },

        contents: [
          {
            role: "user",

            parts: [
              {
                inlineData: {
                  mimeType:
                    "application/pdf",

                  data:
                    pdfBuffer.toString(
                      "base64"
                    ),
                },
              },
              {
                text:
                  "Extract the complete Scheme of Work from this PDF according to the cached instructions. Return only the required JSON.",
              },
            ],
          },
        ],
      });

    logGeminiUsage(response);

    const text = response.text.trim();

    if (!text) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    const parsed =
      JSON.parse(text);

    console.log(
      "✅ Scheme of Work JSON parsed successfully"
    );

    return parsed;
  } catch (error) {
    console.error(
      "❌ Scheme of Work extraction failed:",
      error
    );

    throw error;
  }
}