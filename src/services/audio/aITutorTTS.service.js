import {
  callTTSProvider,
} from "./aITutorTTSProvider.js";

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


export async function generateTutorSpeech({
  text,
  gender,
  speed = 1.1,
}) {
  const cleanedText =
    cleanTextForTTS(text);

  if (!cleanedText) {
    return null;
  }

  const normalizedGender =
    typeof gender === "string"
      ? gender
          .trim()
          .toLowerCase()
      : null;

  const audioBuffer =
    await callTTSProvider({
      text: cleanedText,
      gender: normalizedGender,
      speed,
    });

  if (
    !audioBuffer ||
    audioBuffer.length === 0
  ) {
    throw new Error(
      "Tutor TTS returned empty audio"
    );
  }

  return {
    text: cleanedText,
    audioBuffer,
  };
}


// import {
//   callTTSProvider,
// } from "./aITutorTTSProvider.js";

// /*
// ==================================================
// CLEAN TEXT FOR TTS
// ==================================================
// */

// function cleanTextForTTS(text) {
//   if (!text) {
//     return "";
//   }

//   return text

//     /*
//     Bold
//     */

//     .replace(
//       /\*\*(.*?)\*\*/gs,
//       "$1"
//     )

//     /*
//     Italic
//     */

//     .replace(
//       /\*(.*?)\*/gs,
//       "$1"
//     )

//     /*
//     Inline code
//     */

//     .replace(
//       /`([^`]+)`/g,
//       "$1"
//     )

//     /*
//     Markdown headings
//     */

//     .replace(
//       /^#{1,6}\s*/gm,
//       ""
//     )

//     /*
//     Markdown links
//     */

//     .replace(
//       /\[([^\]]+)\]\([^)]+\)/g,
//       "$1"
//     )

//     /*
//     Strikethrough
//     */

//     .replace(
//       /~~(.*?)~~/gs,
//       "$1"
//     )

//     /*
//     Bullet points
//     */

//     .replace(
//       /^\s*[-*+]\s+/gm,
//       ""
//     )

//     /*
//     Numbered lists
//     */

//     .replace(
//       /^\s*\d+\.\s+/gm,
//       ""
//     )

//     /*
//     Block quotes
//     */

//     .replace(
//       /^\s*>\s?/gm,
//       ""
//     )

//     /*
//     Remove remaining markdown characters
//     */

//     .replace(/\*/g, "")
//     .replace(/_/g, "")
//     .replace(/~/g, "")

//     /*
//     Normalize whitespace
//     */

//     .replace(
//       /\s+/g,
//       " "
//     )

//     .trim();
// }

// /*
// ==================================================
// GENERATE TUTOR SPEECH
// ==================================================
// */

// export async function generateTutorSpeech({
//   text,
//   gender,
//   speed = 1.1,
// }) {
//   /*
//   ================================================
//   CLEAN TEXT
//   ================================================
//   */

//   const cleanedText =
//     cleanTextForTTS(text);

//   if (!cleanedText) {

//     return null;
//   }

//   /*
//   ================================================
//   NORMALIZE GENDER
//   ================================================
//   */

//   const normalizedGender =
//     typeof gender === "string"
//       ? gender
//           .trim()
//           .toLowerCase()
//       : null;

//   /*
//   ================================================
//   GENERATE AUDIO
//   ================================================
//   */

//   const audioBuffer =
//     await callTTSProvider({
//       text: cleanedText,
//       gender: normalizedGender,
//       speed,
//     });

//   /*
//   ================================================
//   VALIDATE AUDIO
//   ================================================
//   */

//   if (
//     !audioBuffer ||
//     audioBuffer.length === 0
//   ) {
//     throw new Error(
//       "Tutor TTS returned empty audio"
//     );
//   }

//   /*
//   ================================================
//   RETURN RESULT
//   ================================================
//   */

//   return {
//     text: cleanedText,
//     audioBuffer,
//   };
// }
