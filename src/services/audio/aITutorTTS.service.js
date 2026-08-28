
import {
  callTTSProvider,
} from "./aITutorTTSProvider.js";

/*
==================================================
CLEAN TEXT FOR TTS
==================================================
*/

function cleanTextForTTS(text) {
  if (!text) {
    return "";
  }

  return text

    /*
    Bold
    */

    .replace(
      /\*\*(.*?)\*\*/gs,
      "$1"
    )

    /*
    Italic
    */

    .replace(
      /\*(.*?)\*/gs,
      "$1"
    )

    /*
    Inline code
    */

    .replace(
      /`([^`]+)`/g,
      "$1"
    )

    /*
    Markdown headings
    */

    .replace(
      /^#{1,6}\s*/gm,
      ""
    )

    /*
    Markdown links
    */

    .replace(
      /\[([^\]]+)\]\([^)]+\)/g,
      "$1"
    )

    /*
    Strikethrough
    */

    .replace(
      /~~(.*?)~~/gs,
      "$1"
    )

    /*
    Bullet points
    */

    .replace(
      /^\s*[-*+]\s+/gm,
      ""
    )

    /*
    Numbered lists
    */

    .replace(
      /^\s*\d+\.\s+/gm,
      ""
    )

    /*
    Block quotes
    */

    .replace(
      /^\s*>\s?/gm,
      ""
    )

    /*
    Remove remaining markdown characters
    */

    .replace(/\*/g, "")
    .replace(/_/g, "")
    .replace(/~/g, "")

    /*
    Normalize whitespace
    */

    .replace(
      /\s+/g,
      " "
    )

    .trim();
}

/*
==================================================
GENERATE TUTOR SPEECH
==================================================
*/

export async function generateTutorSpeech({
  text,
  gender,
  speed = 1.1,
}) {
  /*
  ================================================
  CLEAN TEXT
  ================================================
  */

  const cleanedText =
    cleanTextForTTS(text);

  if (!cleanedText) {
    console.log(
      "⚠️ TTS skipped because cleaned text is empty"
    );

    return null;
  }

  /*
  ================================================
  NORMALIZE GENDER
  ================================================
  */

  const normalizedGender =
    typeof gender === "string"
      ? gender
          .trim()
          .toLowerCase()
      : null;

  /*
  ================================================
  DEBUG
  ================================================
  */

  console.log(
    "========================================"
  );

  console.log(
    "🧑‍🎓 TUTOR STUDENT VOICE DEBUG"
  );

  console.log(
    "Original gender:",
    gender
  );

  console.log(
    "Normalized gender:",
    normalizedGender
  );

  console.log(
    "Speaking speed:",
    speed
  );

  console.log(
    "Text length:",
    cleanedText.length
  );

  console.log(
    "========================================"
  );

  /*
  ================================================
  GENERATE AUDIO
  ================================================
  */

  const audioBuffer =
    await callTTSProvider({
      text: cleanedText,
      gender: normalizedGender,
      speed,
    });

  /*
  ================================================
  VALIDATE AUDIO
  ================================================
  */

  if (
    !audioBuffer ||
    audioBuffer.length === 0
  ) {
    throw new Error(
      "Tutor TTS returned empty audio"
    );
  }

  /*
  ================================================
  RETURN RESULT
  ================================================
  */

  return {
    text: cleanedText,
    audioBuffer,
  };
}
