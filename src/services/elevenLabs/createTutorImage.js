
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
TUTOR IMAGE POLICY
==========================================

Image generation is intentionally conservative.

none:
  No visual value.
  Never generate.

low:
  A visual may be helpful, but is not
  important enough to justify generation.
  Never generate automatically.

high:
  A visual would significantly improve
  the student's understanding.
  Generate one image.

extremely_high:
  The concept is strongly visual and a
  visual is exceptionally valuable to the
  explanation.
  Generate one image, with the possibility
  of a second image when appropriate.

IMPORTANT:
Maximum images for one tutor response = 2.
==========================================
*/

const MAX_IMAGES_PER_RESPONSE = 2;

const GENERATION_PRIORITIES = new Set([
  "high",
  "extremely_high",
]);

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
  existingImageCount = 0,
}) {
  /*
  ========================================
  HARD IMAGE LIMIT
  ========================================

  Never generate more than the permitted
  number of images for one tutor response.
  ========================================
  */

  if (existingImageCount >= MAX_IMAGES_PER_RESPONSE) {
    return null;
  }

  /*
  ========================================
  DETERMINE WHETHER IMAGE IS NEEDED
  ========================================
  */

  const visual = await determineTutorVisual({
    studentMessage,
    tutorResponse,
  });


  if (
    !visual?.shouldGenerate ||
    !GENERATION_PRIORITIES.has(visual?.priority)
  ) {
    return null;
  }

  /*
  ========================================
  GENERATE IMAGE
  ========================================
  */

  const generated = await generateTutorImage({
    prompt: visual.prompt,
  });

  if (!generated?.buffer) {
    throw new Error(
      "Tutor image generation did not return an image buffer."
    );
  }

  /*
  ========================================
  UPLOAD IMAGE
  ========================================
  */

  const uploaded = await uploadTutorImage({
    buffer: generated.buffer,
    mimeType: generated.mimeType,
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

  afterSequence tells the frontend exactly
  where this image belongs in relation to
  the streamed tutor sentences.
  ========================================
  */

  return {
    url: uploaded.url,

    alt:
      visual.alt ||
      "Educational illustration",

    caption:
      visual.caption || null,

    source: "generated",

    afterSequence,
  };
}

