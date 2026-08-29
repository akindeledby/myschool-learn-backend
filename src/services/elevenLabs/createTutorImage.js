
import {
  determineTutorVisual,
} from "./tutorVisualDecision.js";

import {
  generateTutorImage,
} from "./tutorImageGenerator.service.js";

import {
  uploadTutorImage,
} from "./tutorImageStorage.js";

/*
==========================================
CREATE TUTOR IMAGE
==========================================
*/

export async function createTutorImage({
  studentMessage,
  tutorResponse,
  studentId,
  conversationId,
  afterSequence = null,
}) {
  /*
  ========================================
  DETERMINE WHETHER IMAGE IS NEEDED
  ========================================
  */

  const visual =
    await determineTutorVisual({
      studentMessage,
      tutorResponse,
    });

  if (!visual.shouldGenerate) {
    return null;
  }

  /*
  ========================================
  GENERATE IMAGE
  ========================================
  */

  const generated =
    await generateTutorImage({
      prompt: visual.prompt,
    });

  /*
  ========================================
  UPLOAD IMAGE
  ========================================
  */

  const uploaded =
    await uploadTutorImage({
      buffer:
        generated.buffer,

      mimeType:
        generated.mimeType,

      studentId,

      conversationId,
    });

  if (!uploaded?.url) {
    throw new Error(
      "Tutor image upload did not return a URL."
    );
  }

  /*
  ========================================
  RETURN MESSAGE IMAGE
  ========================================
  */

  return {
    url:
      uploaded.url,

    alt:
      visual.alt ||
      "Educational illustration",

    caption:
      visual.caption,

    source:
      "generated",

    /*
    ======================================
    IMPORTANT

    This tells the frontend and database
    exactly where the image belongs.
    ======================================
    */

    afterSequence,
  };
}



// import {
//   determineTutorVisual,
// } from "./tutorVisualDecision.js";

// import {
//   generateTutorImage,
// } from "./tutorImageGenerator.service.js";

// import { uploadTutorImage } from "./tutorImageStorage.js";

// /*
// ==========================================
// CREATE TUTOR IMAGE
// ==========================================
// */

// export async function createTutorImage({
//   studentMessage,
//   tutorResponse,
//   studentId,
//   conversationId,
// }) {
//   /*
//   ========================================
//   DETERMINE WHETHER IMAGE IS NEEDED
//   ========================================
//   */

//   const visual =
//     await determineTutorVisual({
//       studentMessage,
//       tutorResponse,
//     });

//   if (!visual.shouldGenerate) {
//     return null;
//   }

//   /*
//   ========================================
//   GENERATE IMAGE
//   ========================================
//   */

//   const generated =
//     await generateTutorImage({
//       prompt: visual.prompt,
//     });

//   /*
//   ========================================
//   UPLOAD IMAGE
//   ========================================
//   */

//   const uploaded =
//     await uploadTutorImage({
//       buffer: generated.buffer,

//       mimeType:
//         generated.mimeType,

//       studentId,

//       conversationId,
//     });

//   if (!uploaded?.url) {
//     throw new Error(
//       "Tutor image upload did not return a URL."
//     );
//   }

//   /*
//   ========================================
//   RETURN MESSAGE IMAGE
//   ========================================
//   */

//   return {
//     url: uploaded.url,

//     alt:
//       visual.alt ||
//       "Educational illustration",

//     caption:
//       visual.caption,

//     source: "generated",
//   };
// }