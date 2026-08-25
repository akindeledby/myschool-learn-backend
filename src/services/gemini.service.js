import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

export async function extractSchemeOfWork(pdfBuffer) {
  try {
    console.log("🧠 Gemini extraction started");

    console.log(
      `📦 PDF Buffer Size: ${pdfBuffer.length} bytes`
    );

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",

      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 65536,
        temperature: 0,
      },
    });

    const prompt = `
      You are an expert educational document extraction system.

      Your task is to extract structured Scheme of Work data from the
      provided PDF.

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

      4. Extract every teaching topic present.

      5. Every topic must contain lessonContents.

      6. lessonContents must always be an array of strings.

      7. Preserve wording from the document as closely as possible.

      8. Correct only obvious OCR errors where the intended text is clear.

      9. Ignore page numbers, headers, footers, watermarks and formatting artifacts.

      10. Do not invent information.

      11. Do not summarize.

      12. Do not paraphrase.

      13. Do not rewrite lesson contents.

      14. Preserve lesson contents as they appear in the document.

      15. Split lessonContents into separate strings when the document
      clearly separates them using bullets, numbering, semicolons or
      separate lines.

      16. Do not discard a topic because its week number is missing.

      17. Week numbers must represent the actual teaching week.

      18. Week numbers start from 1.

      19. Never return 0 as a week number.

      20. If the week number is missing, blank or unreadable, use null.

      21. Ignore empty rows.

      ==================================================
      EXCLUDED CONTENT
      ==================================================

      Exclude rows or sections titled:

      Revision
      Examination
      Exams
      Test
      Continuous Assessment
      Mid-Term Break
      Mid Term Break
      Holiday
      Public Holiday
      Vacation

      unless they contain actual teaching content.

      ==================================================
      STANDARD TABLE FORMAT
      ==================================================

      For tables containing columns such as:

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

      Combine the relevant teaching content into:

      "lessonContents"

      ==================================================
      TERM STRUCTURE
      ==================================================

      Represent terms using:

      FIRST
      SECOND
      THIRD

      If a term is not present in the document, its topics array should
      be empty.

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
      STRICT REQUIREMENTS
      ==================================================

      Return ONLY JSON.

      Do not return Markdown.

      Do not use code fences.

      Do not include explanations.

      Do not include comments.

      Do not include additional fields.

      The result must be directly parseable using JSON.parse().

      Do not invent missing topics.

      Do not invent missing lesson contents.

      Do not merge unrelated topics.

      Do not omit teaching topics that are actually present.

      Every lessonContents item must be a valid JSON string.

      If the original document contains quotation marks inside a
      lesson content item, preserve them but escape them correctly
      for JSON using \".

      Never place an unescaped double quotation mark inside a JSON
      string.

      Example of correct JSON:

      "Introduce self and others using simple sentences (\"My name is...\", \"This is my friend...\")"

      Do not output smart quotation marks or raw quotation marks
      inside JSON strings unless they are properly escaped.

      Every returned string must be a valid JSON string.
      • If the source text contains quotation marks, escape them correctly according to JSON syntax.
      • Never place an unescaped double quote character (") inside a JSON string.
      • Preserve the original source wording as much as possible, but valid JSON escaping always takes precedence.
      • For example, source text such as:
        My name is "John"
        must be returned as:
        "My name is \"John\""
      • Do not use smart quotation marks as a substitute for proper JSON escaping.
      • Ensure every string is properly opened and closed before returning the JSON.

      Return ONLY valid JSON.
      • Do NOT return Markdown.
      • Do NOT use code fences.
      • Do NOT include explanations.
      • The output must be directly parsable using JSON.parse().
      • Do not include any fields not defined by the schema.

      STRING REQUIREMENTS

      • Every returned string must be a valid JSON string.
      • If source text contains quotation marks, escape them correctly according to JSON syntax.
      • Never place an unescaped double quote character (") inside a JSON string.
      • Preserve source wording as much as possible, but valid JSON escaping takes precedence.
      • Do not truncate a string.
      • Every string must have a properly matching opening and closing quotation mark.

      STRUCTURAL REQUIREMENTS

      • Every "[" must have a matching "]".
      • Every "{" must have a matching "}".
      • Every object property must be separated by a comma where required.
      • Never add a trailing comma.
      • lessonContents must always be an array of strings.
      • week must be an integer or null.

      FINAL VALIDATION

      Before returning the response, internally verify that the complete output is valid JSON and can be successfully parsed by JSON.parse().
      Do not return incomplete JSON.
      If you cannot fit the complete extraction within the response limit, do not truncate the JSON.
      `;

    console.log("📝 Gemini prompt prepared");

    const startTime = Date.now();

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBuffer.toString("base64"),
        },
      },
      {
        text: prompt,
      },
    ]);

    const duration =
      ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(
      `✅ Gemini response received in ${duration}s`
    );

    const response = result.response;

    console.log("📥 Raw AI response received");

    // ========================================================
    // CHECK RESPONSE METADATA
    // ========================================================

    const candidate = response.candidates?.[0];

    console.log(
      "🔎 Gemini finish reason:",
      candidate?.finishReason
    );

    console.log(
      "🔎 Gemini response length:",
      response.text().length
    );

    // ========================================================
    // GET RESPONSE TEXT
    // ========================================================

    const text = response.text().trim();

    if (!text) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    console.log("🔎 Finish reason:", candidate?.finishReason);
    console.log("🔎 Gemini response length:", text.length);

    // ========================================================
    // PARSE JSON
    // ========================================================

    try {
      const parsed = JSON.parse(text);

      console.log("✅ JSON parsed successfully");

      return parsed;
    } catch (err) {
      console.error("❌ JSON.parse failed");
      console.error("❌ Error:", err.message);

      const positionMatch = err.message.match(
        /position (\d+)/
      );

      if (positionMatch) {
        const position = Number(positionMatch[1]);

        const start = Math.max(0, position - 500);
        const end = Math.min(text.length, position + 500);

        console.error(
          `\n🔍 JSON around error position ${position}:\n`
        );

        console.error(
          text.slice(start, end)
        );

        console.error(
          "\n🔍 Character at error position:",
          JSON.stringify(text[position])
        );
      }

      throw new Error(
        `Gemini returned invalid JSON: ${err.message}`
      );
    }

  } catch (error) {

    console.error(
      "❌ Gemini extraction failed:",
      error
    );

    throw error;
  }
}
