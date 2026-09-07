import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../../lib/aws-s3.js";
import { callTTSProvider } from "./audio.service.js";
import { getAudioDurationFromBuffer } from "./get-audio-duration.service.js";

function normalizeLatexForSpeech(text) {
  if (!text) {
    return "";
  }

  let result = text;

  /*
  ================================================
  FRACTIONS
  ================================================
  */

  result = result.replace(
    /\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
    "$1 divided by $2"
  );

  /*
  ================================================
  SQUARE ROOTS
  ================================================
  */

  result = result.replace(
    /\\sqrt\s*\{([^{}]*)\}/g,
    "square root of $1"
  );

  /*
  ================================================
  SUPERSCRIPTS
  ================================================
  */

  result = result.replace(
    /\^\{([^{}]*)\}/g,
    " to the power of $1"
  );

  result = result.replace(
    /\^([a-zA-Z0-9])/g,
    " to the power of $1"
  );

  /*
  ================================================
  SUBSCRIPTS
  ================================================
  */

  result = result.replace(
    /_\{([^{}]*)\}/g,
    " subscript $1"
  );

  result = result.replace(
    /_([a-zA-Z0-9])/g,
    " subscript $1"
  );

  /*
  ================================================
  COMMON LATEX OPERATORS
  ================================================
  */

  result = result
    .replace(/\\times/g, " times ")
    .replace(/\\cdot/g, " times ")
    .replace(/\\div/g, " divided by ")
    .replace(/\\pm/g, " plus or minus ")
    .replace(/\\leq/g, " less than or equal to ")
    .replace(/\\geq/g, " greater than or equal to ")
    .replace(/\\neq/g, " not equal to ")
    .replace(/\\approx/g, " approximately ")
    .replace(/\\lt/g, " less than ")
    .replace(/\\gt/g, " greater than ")
    .replace(/\\infty/g, " infinity ");

  /*
  ================================================
  COMMON LATEX SYMBOLS
  ================================================
  */

  result = result
    .replace(/\\%/g, " percent ")
    .replace(/\\=/g, " equals ")
    .replace(/\\+/g, " plus ")
    .replace(/\\-/g, " minus ");

  /*
  ================================================
  TEXT INSIDE LATEX
  ================================================
  */

  result = result.replace(
    /\\text\s*\{([^{}]*)\}/g,
    "$1"
  );

  result = result.replace(
    /\\mathrm\s*\{([^{}]*)\}/g,
    "$1"
  );

  result = result.replace(
    /\\mathbf\s*\{([^{}]*)\}/g,
    "$1"
  );

  /*
  ================================================
  REMOVE LATEX MATH DELIMITERS
  ================================================
  */

  result = result
    .replace(/\$\$/g, "")
    .replace(/\$/g, "")
    .replace(/\\\(/g, "")
    .replace(/\\\)/g, "")
    .replace(/\\\[/g, "")
    .replace(/\\\]/g, "");

  /*
  ================================================
  REMAINING COMMON LATEX COMMANDS
  ================================================
  */

  result = result.replace(
    /\\([a-zA-Z]+)\s*/g,
    "$1 "
  );

  /*
  ================================================
  CLEAN MARKDOWN
  ================================================
  */

  result = result
    .replace(
      /\*\*(.*?)\*\*/gs,
      "$1"
    )

    .replace(
      /\*(.*?)\*/gs,
      "$1"
    )

    .replace(
      /`([^`]+)`/g,
      "$1"
    )

    .replace(
      /^#{1,6}\s*/gm,
      ""
    )

    .replace(
      /\[([^\]]+)\]\([^)]+\)/g,
      "$1"
    )

    .replace(
      /~~(.*?)~~/gs,
      "$1"
    )

    .replace(
      /^\s*[-*+]\s+/gm,
      ""
    )

    .replace(
      /^\s*\d+\.\s+/gm,
      ""
    )

    .replace(
      /^\s*>\s?/gm,
      ""
    )

    .replace(/\*/g, "")
    .replace(/_/g, "")
    .replace(/~/g, "");

  /*
  ================================================
  MATHEMATICAL SYMBOLS
  ================================================
  */

  result = result
    .replace(/×/g, " times ")
    .replace(/÷/g, " divided by ")
    .replace(/≤/g, " less than or equal to ")
    .replace(/≥/g, " greater than or equal to ")
    .replace(/≠/g, " not equal to ")
    .replace(/≈/g, " approximately ")
    .replace(/±/g, " plus or minus ")
    .replace(/∞/g, " infinity ");

  /*
  ================================================
  NORMALIZE WHITESPACE
  ================================================
  */

  result = result
    .replace(/\s+/g, " ")
    .trim();

  return result;
}


export function cleanTextForTTS(text) {
  return normalizeLatexForSpeech(text);
}

/*
==========================================
LESSON VIDEO TTS
==========================================
*/

export async function generateTTS({
  topicId,
  sceneId,
  text,
  voice = "en-GB-Wavenet-B",
  speed = 1,
}) {
  if (!text?.trim()) {
    throw new Error(
      "Text is required for TTS"
    );
  }

  const bucketName =
    process.env.REMOTION_AWS_BUCKET_NAME;

  const region =
    process.env.AWS_REGION;

  if (!bucketName) {
    throw new Error(
      "REMOTION_AWS_BUCKET_NAME missing"
    );
  }

  if (!region) {
    throw new Error(
      "AWS_REGION missing"
    );
  }

  const ttsText =
    cleanTextForTTS(text);

  if (!ttsText) {
    throw new Error(
      `TTS text became empty after cleaning for scene ${sceneId}`
    );
  }

  const fileName =
    `scene-${sceneId}.mp3`;

  const s3Key =
    `audio/${topicId}/${fileName}`;

  try {
    console.log(
      `🎤 Generating audio for scene ${sceneId}`
    );

    const audioBuffer =
      await callTTSProvider({
        text: ttsText,
        voice,
        speed,
      });

    if (
      !audioBuffer ||
      !audioBuffer.length
    ) {
      throw new Error(
        `TTS provider returned empty audio for scene ${sceneId}`
      );
    }

    const durationInSeconds =
      await getAudioDurationFromBuffer(
        audioBuffer
      );

    if (
      !durationInSeconds ||
      durationInSeconds <= 0
    ) {
      throw new Error(
        `Unable to determine audio duration for scene ${sceneId}`
      );
    }

    const fps = 30;

    const durationInFrames =
      Math.ceil(
        durationInSeconds * fps
      );

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: audioBuffer,
        ContentType: "audio/mpeg",
      })
    );

    const audioUrl =
      `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;

    return {
      sceneId,
      fileName,
      s3Key,
      audioUrl,
      durationInSeconds,
      durationInFrames,
    };

  } catch (error) {
    console.error(
      `❌ TTS generation failed for scene ${sceneId}`,
      error
    );

    throw error;
  }
}
