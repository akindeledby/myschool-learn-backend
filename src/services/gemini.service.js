import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAICacheManager } from "@google/generative-ai/server";

const GEMINI_MODEL = "gemini-2.5-flash";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

const cacheManager = new GoogleAICacheManager(
  process.env.GEMINI_API_KEY
);

const CACHE_TTL = process.env.GEMINI_SCHEME_CACHE_TTL || "3600s";

let extractionCache = null;
let extractionCachePromise = null;

const EXTRACTION_INSTRUCTIONS = `
You are an expert educational document extraction system.

Your task is to extract structured Scheme of Work data from the provided PDF.

The PDF may contain multiple subjects, classes and terms.

Return ONLY valid JSON matching the required structure.

==================================================
DATA HIERARCHY
==================================================

Subjects
  └── Classes
        └── Terms
              └── Topics
                    └── Lesson Contents

==================================================
GENERAL EXTRACTION RULES
==================================================

1. Extract every subject present in the document.

2. Under each subject, extract every class present.

3. Under each class, extract every term present.

4. Extract every actual teaching topic present in the document.

5. Every topic must contain lessonContents.

6. lessonContents must always be an array of strings.

7. Preserve wording from the document as closely as possible.

8. Correct only obvious OCR errors where the intended text is completely clear.

9. Ignore page numbers, headers, footers, watermarks and formatting artifacts.

10. Do not invent information.

11. Do not summarize.

12. Do not unnecessarily paraphrase.

13. Do not rewrite teaching content into generic descriptions.

14. Preserve the actual teaching content from the document.

15. Split lessonContents into separate strings when the document clearly separates them using bullets, numbering, semicolons, separate lines, subtopics, distinct concepts, skills, rules, examples or other meaningful curriculum divisions.

16. Do not discard a topic because its week number is missing.

17. Week numbers must represent the actual teaching week when available.

18. Week numbers start from 1.

19. Never return 0 as a week number.

20. If the week number is missing, blank or unreadable, use null.

21. Ignore completely empty rows.

22. Do not merge unrelated topics.

23. Do not omit actual teaching topics that are present.

==================================================
EXCLUDED CONTENT
==================================================

Exclude rows or sections titled:

Revision
Examination
Exams
Test
Tests
Continuous Assessment
Mid-Term Break
Mid Term Break
Holiday
Public Holiday
Vacation

unless they contain actual teaching content that clearly belongs to a teaching topic.

==================================================
STANDARD TABLE FORMAT
==================================================

For subjects that use conventional scheme of work columns such as:

Week
Topic
Content
Contents
Subtopic
Subtopics
Objectives
Learning Objectives
Breakdown
Breakdown of Content
Learning Activities

use the Topic column as the topic title.

Extract the actual teaching material associated with that topic into:

"lessonContents"

Do not use generic column names such as "Content", "Objectives" or "Learning Activities" themselves as lessonContents.

Instead, extract the actual information contained under those columns.

If several content fields belong to the same topic, combine their meaningful teaching information into the lessonContents array.

==================================================
SPECIAL ENGLISH SUBJECT REQUIREMENTS
==================================================

When the subject is English, English Language, English Studies or another clearly equivalent English curriculum subject, apply the following special rules.

English scheme of work documents may NOT use the conventional columns:

Content
Contents
Subtopic
Subtopics
Objectives
Learning Objectives
Breakdown
Breakdown of Content
Learning Activities

Instead, English documents may organize each topic under curriculum areas such as:

Speech Work
Grammar
Reading and Comprehension
Composition
Literature

These five curriculum areas are CATEGORY HEADINGS.

They are NOT lesson contents.

Never return any of the following as a lessonContents item merely because it appears as a curriculum heading:

"Speech Work"
"Grammar"
"Reading and Comprehension"
"Composition"
"Literature"

Treat these headings as organizational categories and extract the actual teaching content underneath them.

For example, if a topic contains:

Grammar:
Nouns
Common nouns
Proper nouns
Singular and plural nouns

Do NOT return:

[
  "Grammar"
]

Instead, return meaningful teaching contents such as:

[
  "Nouns",
  "Common nouns",
  "Proper nouns",
  "Singular and plural nouns"
]

Similarly, if Speech Work contains actual pronunciation, vowel, consonant, stress, intonation or sound content, extract that actual content rather than returning "Speech Work".

If Reading and Comprehension contains a passage, comprehension skill, reading skill, vocabulary focus, questions, interpretation or related teaching content, extract the actual teaching information rather than returning "Reading and Comprehension".

If Composition contains actual writing skills, formats, structures, exercises, writing topics or composition requirements, extract those actual contents rather than returning "Composition".

If Literature contains actual literary works, genres, themes, characters, literary devices, poetry, prose, drama or other literary teaching content, extract those actual contents rather than returning "Literature".

==================================================
ENGLISH MINIMUM LESSON CONTENT REQUIREMENT
==================================================

Every English topic should contain at least 5 meaningful lessonContents whenever the source document provides enough actual teaching information to support 5 or more items.

The objective is to capture the teaching breakdown represented by the English curriculum areas.

Therefore:

1. Look across all relevant English curriculum areas belonging to the topic.

2. Extract meaningful individual teaching concepts, skills, rules, subtopics, examples, texts, literary elements, pronunciation elements, writing elements or other actual curriculum information.

3. Split clearly distinct teaching information into separate lessonContents items.

4. Do not simply return the five curriculum area headings.

5. Do not create artificial or generic lessonContents just to reach five.

6. Do not invent information that is not supported by the document.

7. If the source genuinely contains fewer than five distinct teaching pieces, return only the genuine information available rather than fabricating additional content.

8. If the document contains enough information for more than five items, return all meaningful items rather than stopping at five.

9. The minimum of five applies specifically to English topics and does not apply to other subjects.

10. Curriculum area headings may be used internally to understand the document structure but must not themselves become lessonContents.

==================================================
ENGLISH TOPIC INTERPRETATION
==================================================

For English documents, the word "topic" may refer to a weekly or combined curriculum entry containing multiple English curriculum areas.

Do not incorrectly treat:

Speech Work
Grammar
Reading and Comprehension
Composition
Literature

as separate topics unless the document explicitly identifies them as separate topics.

When they appear as sections underneath one topic or week, preserve the parent topic and combine their actual teaching content into that topic's lessonContents array.

==================================================
TERM STRUCTURE
==================================================

Represent terms using:

FIRST
SECOND
THIRD

If a term is not present in the document, its topics array should be empty.

==================================================
WEEK NUMBER RULES
==================================================

Use the actual teaching week when clearly available.

Examples:

Week 1 → 1
Week 2 → 2
Week 3 → 3

Never convert a missing week into 0.

If the week is unavailable, unclear or unreadable:

"week": null

Do not invent week numbers based only on the order of topics unless the document clearly establishes that order as the teaching week sequence.

==================================================
TOPIC RULES
==================================================

Every topic must have:

week
title
lessonContents

The title must represent the actual teaching topic.

Do not use curriculum headings such as:

Speech Work
Grammar
Reading and Comprehension
Composition
Literature

as the topic title unless the document explicitly identifies one of them as the actual topic.

Do not invent topic titles.

==================================================
PRESERVATION RULES
==================================================

Preserve the original wording as much as reasonably possible.

Correct obvious OCR errors only when the intended wording is clear.

Do not summarize long source content into vague descriptions.

Do not replace actual curriculum content with generic statements such as:

"Students will learn grammar."

Instead extract the actual information such as:

"Nouns"
"Common nouns"
"Proper nouns"
"Singular and plural nouns"

where those are supported by the source.

==================================================
REQUIRED JSON STRUCTURE
==================================================

{
  "subjects": [
    {
      "name": "",
      "classes": [
        {
          "name": "",
          "terms": [
            {
              "name": "FIRST",
              "topics": [
                {
                  "week": 1,
                  "title": "",
                  "lessonContents": []
                }
              ]
            },
            {
              "name": "SECOND",
              "topics": []
            },
            {
              "name": "THIRD",
              "topics": []
            }
          ]
        }
      ]
    }
  ]
}

==================================================
STRUCTURAL REQUIREMENTS
==================================================

Return exactly this structure.

Do not add fields such as:

id
description
objectives
content
notes
source
category
subjectId
classId
termId

Only return the fields defined by the required structure.

lessonContents must always be an array of strings.

week must always be an integer or null.

==================================================
JSON VALIDITY REQUIREMENTS
==================================================

The final response must be directly parseable using JSON.parse().

Return ONLY valid JSON.

Do not return Markdown.

Do not use code fences.

Do not include explanations.

Do not include comments.

Do not include introductory text.

Do not include concluding text.

Do not truncate the response.

Every "[" must have a matching "]".

Every "{" must have a matching "}".

Every object property must be separated by a comma where required.

Never add a trailing comma.

Every string must have matching opening and closing quotation marks.

If source text contains quotation marks inside a string, escape them correctly according to JSON syntax.

For example:

Source:
My name is "John"

Correct JSON value:

"My name is \\"John\\""

Preserve source wording as much as possible while ensuring valid JSON.

Do not use smart quotation marks as a substitute for valid JSON escaping.

==================================================
FINAL VALIDATION
==================================================

Before returning the response, internally verify that:

1. The complete output is valid JSON.
2. The output can be successfully parsed by JSON.parse().
3. Every subject has classes.
4. Every class has FIRST, SECOND and THIRD terms.
5. Every topic has week, title and lessonContents.
6. Every lessonContents value is a string.
7. Every week value is an integer or null.
8. English curriculum headings have not been incorrectly returned as lessonContents.
9. English topics contain at least five meaningful lessonContents whenever the source provides sufficient information.
10. No information was invented merely to satisfy the English minimum.
11. The response is complete and not truncated.

Return ONLY valid JSON.
`;

async function getExtractionCache() {
  if (extractionCache) {
    return extractionCache;
  }

  if (extractionCachePromise) {
    return extractionCachePromise;
  }

  extractionCachePromise = (async () => {
    try {
      console.log("🧠 Creating Gemini scheme extraction cache...");

      const cache = await cacheManager.create({
        model: `models/${GEMINI_MODEL}`,
        systemInstruction: EXTRACTION_INSTRUCTIONS,
        ttl: CACHE_TTL,
      });

      extractionCache = cache;

      console.log(
        "✅ Gemini extraction cache created:",
        cache.name
      );

      console.log(
        "⏳ Cache TTL:",
        CACHE_TTL
      );

      return cache;
    } catch (error) {
      console.error(
        "❌ Failed to create Gemini extraction cache:",
        error
      );

      throw error;
    } finally {
      extractionCachePromise = null;
    }
  })();

  return extractionCachePromise;
}

function isCacheExpired(cache) {
  if (!cache?.expireTime) {
    return false;
  }

  return new Date(cache.expireTime).getTime() <= Date.now();
}

async function getValidExtractionCache() {
  if (extractionCache && !isCacheExpired(extractionCache)) {
    return extractionCache;
  }

  extractionCache = null;

  return getExtractionCache();
}

function extractJsonFromResponse(text) {
  const cleaned = text.trim();

  if (!cleaned) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error(
      "❌ Direct JSON.parse failed:",
      error.message
    );

    const positionMatch = error.message.match(
      /position (\d+)/
    );

    if (positionMatch) {
      const position = Number(
        positionMatch[1]
      );

      const start = Math.max(
        0,
        position - 500
      );

      const end = Math.min(
        cleaned.length,
        position + 500
      );

      console.error(
        `\n🔍 JSON around error position ${position}:\n`
      );

      console.error(
        cleaned.slice(start, end)
      );

      console.error(
        "\n🔍 Character at error position:",
        JSON.stringify(cleaned[position])
      );
    }

    const fencedMatch = cleaned.match(
      /^```(?:json)?\s*([\s\S]*?)\s*```$/i
    );

    if (fencedMatch) {
      try {
        return JSON.parse(
          fencedMatch[1].trim()
        );
      } catch (fencedError) {
        console.error(
          "❌ JSON.parse failed after removing code fence:",
          fencedError.message
        );
      }
    }

    throw new Error(
      `Gemini returned invalid JSON: ${error.message}`
    );
  }
}

export async function extractSchemeOfWork(pdfBuffer) {
  try {
    console.log(
      "🧠 Gemini scheme of work extraction started"
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

    console.log(
      `📦 PDF Buffer Size: ${pdfBuffer.length} bytes`
    );

    const cache = await getValidExtractionCache();

    console.log(
      "💾 Using Gemini cached extraction instructions"
    );

    console.log(
      "💾 Cache:",
      cache.name
    );

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      cachedContent: cache.name,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 65536,
        temperature: 0,
      },
    });

    console.log(
      "📝 Sending PDF to Gemini..."
    );

    const startTime = Date.now();

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBuffer.toString("base64"),
        },
      },
      {
        text: `
Extract the complete Scheme of Work from this PDF.

Follow all cached extraction instructions exactly.

Pay particular attention to the special English subject requirements.

Return ONLY the required JSON structure.
        `.trim(),
      },
    ]);

    const duration = (
      (Date.now() - startTime) /
      1000
    ).toFixed(2);

    console.log(
      `✅ Gemini response received in ${duration}s`
    );

    const response = result.response;

    const candidate =
      response.candidates?.[0];

    console.log(
      "🔎 Gemini finish reason:",
      candidate?.finishReason
    );

    const text = response.text().trim();

    console.log(
      "🔎 Gemini response length:",
      text.length
    );

    if (!text) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    const usageMetadata =
      response.usageMetadata;

    if (usageMetadata) {
      console.log(
        "📊 Gemini usage metadata:",
        {
          promptTokenCount:
            usageMetadata.promptTokenCount,
          candidatesTokenCount:
            usageMetadata.candidatesTokenCount,
          totalTokenCount:
            usageMetadata.totalTokenCount,
          cachedContentTokenCount:
            usageMetadata.cachedContentTokenCount,
        }
      );
    }

    const parsed = extractJsonFromResponse(
      text
    );

    console.log(
      "✅ Scheme of Work JSON parsed successfully"
    );

    return parsed;
  } catch (error) {
    console.error(
      "❌ Gemini scheme of work extraction failed:",
      error
    );

    throw error;
  }
}


// import { GoogleGenerativeAI } from "@google/generative-ai";

// const genAI = new GoogleGenerativeAI(
//   process.env.GEMINI_API_KEY
// );

// export async function extractSchemeOfWork(pdfBuffer) {
//   try {
//     console.log("🧠 Gemini extraction started");

//     console.log(
//       `📦 PDF Buffer Size: ${pdfBuffer.length} bytes`
//     );

//     const model = genAI.getGenerativeModel({
//       model: "gemini-2.5-flash",

//       generationConfig: {
//         responseMimeType: "application/json",
//         maxOutputTokens: 65536,
//         temperature: 0,
//       },
//     });

//     const prompt = `
//       You are an expert educational document extraction system.

//       Your task is to extract structured Scheme of Work data from the
//       provided PDF.

//       The PDF may contain multiple subjects, classes and terms.

//       Return ONLY valid JSON matching the required structure.

//       ==================================================
//       DATA HIERARCHY
//       ==================================================

//       Subjects
//         └── Classes
//               └── Terms
//                     └── Topics
//                           └── Lesson Contents

//       ==================================================
//       GENERAL EXTRACTION RULES
//       ==================================================

//       1. Extract every subject present in the document.

//       2. Under each subject, extract every class present.

//       3. Under each class, extract every term present.

//       4. Extract every teaching topic present.

//       5. Every topic must contain lessonContents.

//       6. lessonContents must always be an array of strings.

//       7. Preserve wording from the document as closely as possible.

//       8. Correct only obvious OCR errors where the intended text is clear.

//       9. Ignore page numbers, headers, footers, watermarks and formatting artifacts.

//       10. Do not invent information.

//       11. Do not summarize.

//       12. Do not paraphrase.

//       13. Do not rewrite lesson contents.

//       14. Preserve lesson contents as they appear in the document.

//       15. Split lessonContents into separate strings when the document
//       clearly separates them using bullets, numbering, semicolons or
//       separate lines.

//       16. Do not discard a topic because its week number is missing.

//       17. Week numbers must represent the actual teaching week.

//       18. Week numbers start from 1.

//       19. Never return 0 as a week number.

//       20. If the week number is missing, blank or unreadable, use null.

//       21. Ignore empty rows.

//       ==================================================
//       EXCLUDED CONTENT
//       ==================================================

//       Exclude rows or sections titled:

//       Revision
//       Examination
//       Exams
//       Test
//       Continuous Assessment
//       Mid-Term Break
//       Mid Term Break
//       Holiday
//       Public Holiday
//       Vacation

//       unless they contain actual teaching content.

//       ==================================================
//       STANDARD TABLE FORMAT
//       ==================================================

//       For tables containing columns such as:

//       Week
//       Topic
//       Content
//       Contents
//       Subtopic
//       Subtopics
//       Objectives
//       Learning Objectives
//       Breakdown
//       Breakdown of Content
//       Learning Activities

//       use the Topic column as the topic title.

//       Combine the relevant teaching content into:

//       "lessonContents"

//       ==================================================
//       TERM STRUCTURE
//       ==================================================

//       Represent terms using:

//       FIRST
//       SECOND
//       THIRD

//       If a term is not present in the document, its topics array should
//       be empty.

//       ==================================================
//       REQUIRED JSON STRUCTURE
//       ==================================================

//       {
//         "subjects": [
//           {
//             "name": "",
//             "classes": [
//               {
//                 "name": "",
//                 "terms": [
//                   {
//                     "name": "FIRST",
//                     "topics": [
//                       {
//                         "week": 1,
//                         "title": "",
//                         "lessonContents": []
//                       }
//                     ]
//                   },
//                   {
//                     "name": "SECOND",
//                     "topics": []
//                   },
//                   {
//                     "name": "THIRD",
//                     "topics": []
//                   }
//                 ]
//               }
//             ]
//           }
//         ]
//       }

//       ==================================================
//       STRICT REQUIREMENTS
//       ==================================================

//       Return ONLY JSON.

//       Do not return Markdown.

//       Do not use code fences.

//       Do not include explanations.

//       Do not include comments.

//       Do not include additional fields.

//       The result must be directly parseable using JSON.parse().

//       Do not invent missing topics.

//       Do not invent missing lesson contents.

//       Do not merge unrelated topics.

//       Do not omit teaching topics that are actually present.

//       Every lessonContents item must be a valid JSON string.

//       If the original document contains quotation marks inside a
//       lesson content item, preserve them but escape them correctly
//       for JSON using \".

//       Never place an unescaped double quotation mark inside a JSON
//       string.

//       Example of correct JSON:

//       "Introduce self and others using simple sentences (\"My name is...\", \"This is my friend...\")"

//       Do not output smart quotation marks or raw quotation marks
//       inside JSON strings unless they are properly escaped.

//       Every returned string must be a valid JSON string.
//       • If the source text contains quotation marks, escape them correctly according to JSON syntax.
//       • Never place an unescaped double quote character (") inside a JSON string.
//       • Preserve the original source wording as much as possible, but valid JSON escaping always takes precedence.
//       • For example, source text such as:
//         My name is "John"
//         must be returned as:
//         "My name is \"John\""
//       • Do not use smart quotation marks as a substitute for proper JSON escaping.
//       • Ensure every string is properly opened and closed before returning the JSON.

//       Return ONLY valid JSON.
//       • Do NOT return Markdown.
//       • Do NOT use code fences.
//       • Do NOT include explanations.
//       • The output must be directly parsable using JSON.parse().
//       • Do not include any fields not defined by the schema.

//       STRING REQUIREMENTS

//       • Every returned string must be a valid JSON string.
//       • If source text contains quotation marks, escape them correctly according to JSON syntax.
//       • Never place an unescaped double quote character (") inside a JSON string.
//       • Preserve source wording as much as possible, but valid JSON escaping takes precedence.
//       • Do not truncate a string.
//       • Every string must have a properly matching opening and closing quotation mark.

//       STRUCTURAL REQUIREMENTS

//       • Every "[" must have a matching "]".
//       • Every "{" must have a matching "}".
//       • Every object property must be separated by a comma where required.
//       • Never add a trailing comma.
//       • lessonContents must always be an array of strings.
//       • week must be an integer or null.

//       FINAL VALIDATION

//       Before returning the response, internally verify that the complete output is valid JSON and can be successfully parsed by JSON.parse().
//       Do not return incomplete JSON.
//       If you cannot fit the complete extraction within the response limit, do not truncate the JSON.
//       `;

//     console.log("📝 Gemini prompt prepared");

//     const startTime = Date.now();

//     const result = await model.generateContent([
//       {
//         inlineData: {
//           mimeType: "application/pdf",
//           data: pdfBuffer.toString("base64"),
//         },
//       },
//       {
//         text: prompt,
//       },
//     ]);

//     const duration =
//       ((Date.now() - startTime) / 1000).toFixed(2);

//     console.log(
//       `✅ Gemini response received in ${duration}s`
//     );

//     const response = result.response;

//     console.log("📥 Raw AI response received");

//     // ========================================================
//     // CHECK RESPONSE METADATA
//     // ========================================================

//     const candidate = response.candidates?.[0];

//     console.log(
//       "🔎 Gemini finish reason:",
//       candidate?.finishReason
//     );

//     console.log(
//       "🔎 Gemini response length:",
//       response.text().length
//     );

//     // ========================================================
//     // GET RESPONSE TEXT
//     // ========================================================

//     const text = response.text().trim();

//     if (!text) {
//       throw new Error(
//         "Gemini returned an empty response."
//       );
//     }

//     console.log("🔎 Finish reason:", candidate?.finishReason);
//     console.log("🔎 Gemini response length:", text.length);

//     // ========================================================
//     // PARSE JSON
//     // ========================================================

//     try {
//       const parsed = JSON.parse(text);

//       console.log("✅ JSON parsed successfully");

//       return parsed;
//     } catch (err) {
//       console.error("❌ JSON.parse failed");
//       console.error("❌ Error:", err.message);

//       const positionMatch = err.message.match(
//         /position (\d+)/
//       );

//       if (positionMatch) {
//         const position = Number(positionMatch[1]);

//         const start = Math.max(0, position - 500);
//         const end = Math.min(text.length, position + 500);

//         console.error(
//           `\n🔍 JSON around error position ${position}:\n`
//         );

//         console.error(
//           text.slice(start, end)
//         );

//         console.error(
//           "\n🔍 Character at error position:",
//           JSON.stringify(text[position])
//         );
//       }

//       throw new Error(
//         `Gemini returned invalid JSON: ${err.message}`
//       );
//     }

//   } catch (error) {

//     console.error(
//       "❌ Gemini extraction failed:",
//       error
//     );

//     throw error;
//   }
// }
