import { ai } from "../../../lib/gemini.js";

import {
  determineAssignmentVisual,
} from "./assignmentImageDecision.service.js";

import {
  generateAssignmentImage,
} from "./assignmentImageGeneration.service.js";


/*
==================================================
GENERATE ASSIGNMENT RESPONSE
==================================================
*/

export async function generateAssignmentResponse({
  prompt,
  fileBuffer,
  mimeType,
  studentId,
  studentQuestion,
  classLevel,
}) {
  const answer =
    await generateAssignmentExplanation({
      prompt,
      fileBuffer,
      mimeType,
    });

  if (!answer) {
    return {
      answer: null,
      image: null,
    };
  }

  /*
  ================================================
  DETERMINE WHETHER IMAGE IS USEFUL
  ================================================
  */

  const visual =
    await determineAssignmentVisual({
      studentQuestion,
      assignmentAnswer: answer,
      classLevel,
    });

  /*
  ================================================
  NO IMAGE
  ================================================
  */

  if (!visual?.shouldGenerate) {
    return {
      answer,
      image: null,
    };
  }

  /*
  ================================================
  GENERATE + UPLOAD IMAGE
  ================================================
  */

  try {
    const generated =
      await generateAssignmentImage({
        prompt: visual.prompt,
        studentId,
      });

    if (!generated?.url) {
      return {
        answer,
        image: null,
      };
    }

    return {
      answer,

      image: {
        generated: true,

        url:
          generated.url,

        alt:
          visual.alt ||
          "Educational illustration",

        caption:
          visual.caption ||
          null,

        source: "generated",
      },
    };
  } catch (error) {
    /*
    ================================================
    IMPORTANT

    Never destroy a valid homework answer
    simply because the optional image failed.
    ================================================
    */

    console.error(
      "[AssignmentImage] Failed:",
      error
    );

    return {
      answer,
      image: null,
    };
  }
}


/*
==================================================
GENERATE ASSIGNMENT EXPLANATION
==================================================
*/

export async function generateAssignmentExplanation({
  prompt,
  fileBuffer,
  mimeType,
}) {
  try {
    let response;

    /*
    ================================================
    TEXT ONLY
    ================================================
    */

    if (!fileBuffer || !mimeType) {
      response =
        await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

      return (
        response.text ??
        "No explanation generated."
      );
    }

    /*
    ================================================
    IMAGE OR PDF
    ================================================
    */

    const base64 =
      fileBuffer.toString("base64");

    response =
      await ai.models.generateContent({
        model: "gemini-2.5-flash",

        contents: [
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
          {
            text: prompt,
          },
        ],
      });

    return (
      response.text ??
      "No explanation generated."
    );
  } catch (error) {
    console.error(
      "Gemini Error:",
      error
    );

    throw new Error(
      "Failed to generate explanation"
    );
  }
}
