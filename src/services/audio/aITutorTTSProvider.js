
import textToSpeech from "@google-cloud/text-to-speech";

const credentials = JSON.parse(
  process.env.GOOGLE_TTS_CREDENTIALS
);

const ttsClient =
  new textToSpeech.TextToSpeechClient({
    credentials: {
      client_email:
        credentials.client_email,

      private_key:
        credentials.private_key.replace(
          /\\n/g,
          "\n"
        ),
    },

    projectId:
      credentials.project_id,
  });

/*
==================================================
VOICE CONFIGURATION
==================================================
*/

/*
Female student
*/
const FEMALE_VOICE =
  "en-GB-Neural2-A";

/*
Male student
*/
const MALE_VOICE =
  "en-GB-Neural2-B";

/*
Fallback voice
*/
const DEFAULT_VOICE =
  MALE_VOICE;

/*
Language
*/
const LANGUAGE_CODE =
  "en-GB";

/*
==================================================
SPEED CONFIGURATION
==================================================
*/

const MIN_SPEED = 0.75;
const MAX_SPEED = 1.25;

/*
==================================================
SELECT VOICE USING STUDENT GENDER
==================================================
*/

function getTutorVoice(gender) {
  /*
  Normalize gender
  */

  const normalizedGender =
    typeof gender === "string"
      ? gender.trim().toLowerCase()
      : null;

  /*
  Debug
  */

  console.log(
    "========================================"
  );

  console.log(
    "🔎 GOOGLE TTS VOICE SELECTION"
  );

  console.log(
    "Gender received:",
    gender
  );

  console.log(
    "Normalized gender:",
    normalizedGender
  );

  /*
  Female student
  */

  if (
    normalizedGender === "female"
  ) {
    console.log(
      "✅ Female student detected"
    );

    console.log(
      "🎙️ Selected voice:",
      FEMALE_VOICE
    );

    console.log(
      "========================================"
    );

    return FEMALE_VOICE;
  }

  /*
  Male student
  */

  if (
    normalizedGender === "male"
  ) {
    console.log(
      "✅ Male student detected"
    );

    console.log(
      "🎙️ Selected voice:",
      MALE_VOICE
    );

    console.log(
      "========================================"
    );

    return MALE_VOICE;
  }

  /*
  Unknown or missing gender
  */

  console.log(
    "⚠️ Gender is missing or not recognized"
  );

  console.log(
    "🎙️ Using default voice:",
    DEFAULT_VOICE
  );

  console.log(
    "========================================"
  );

  return DEFAULT_VOICE;
}

/*
==================================================
SAFE SPEAKING RATE
==================================================
*/

function getSafeSpeed(speed) {
  return Math.min(
    Math.max(
      typeof speed === "number"
        ? speed
        : 1,

      MIN_SPEED
    ),

    MAX_SPEED
  );
}

/*
==================================================
GENERATE GOOGLE CLOUD TTS AUDIO
==================================================
*/

export async function callTTSProvider({
  text,
  gender,
  speed = 1.1,
}) {
  /*
  ================================================
  VALIDATE TEXT
  ================================================
  */

  if (!text?.trim()) {
    throw new Error(
      "TTS text is required"
    );
  }

  /*
  ================================================
  SELECT VOICE FROM GENDER
  ================================================
  */

  const selectedVoice =
    getTutorVoice(gender);

  /*
  ================================================
  SAFE SPEAKING RATE
  ================================================
  */

  const safeSpeed =
    getSafeSpeed(speed);

  /*
  ================================================
  GOOGLE CLOUD TTS REQUEST
  ================================================
  */

  const request = {
    input: {
      text: text.trim(),
    },

    voice: {
      languageCode:
        LANGUAGE_CODE,

      name:
        selectedVoice,
    },

    audioConfig: {
      audioEncoding:
        "MP3",

      speakingRate:
        safeSpeed,
    },
  };

  /*
  ================================================
  REQUEST DEBUG
  ================================================
  */

  console.log(
    "========================================"
  );

  console.log(
    "🎤 GOOGLE CLOUD TTS REQUEST"
  );

  console.log(
    "Gender:",
    gender || "unknown"
  );

  console.log(
    "Selected voice:",
    selectedVoice
  );

  console.log(
    "Language:",
    LANGUAGE_CODE
  );

  console.log(
    "Speaking rate:",
    safeSpeed
  );

  console.log(
    "Text length:",
    text.trim().length
  );

  console.log(
    "========================================"
  );

  /*
  ================================================
  CALL GOOGLE CLOUD TTS
  ================================================
  */

  const [response] =
    await ttsClient.synthesizeSpeech(
      request
    );

  /*
  ================================================
  VALIDATE RESPONSE
  ================================================
  */

  if (
    !response ||
    !response.audioContent
  ) {
    throw new Error(
      "Google Cloud TTS returned no audio"
    );
  }

  /*
  ================================================
  CONVERT AUDIO TO BUFFER
  ================================================
  */

  const audioBuffer =
    Buffer.isBuffer(
      response.audioContent
    )
      ? response.audioContent
      : Buffer.from(
          response.audioContent,
          "binary"
        );

  /*
  ================================================
  VALIDATE AUDIO BUFFER
  ================================================
  */

  if (
    !audioBuffer ||
    audioBuffer.length === 0
  ) {
    throw new Error(
      "Google Cloud TTS returned empty audio"
    );
  }

  /*
  ================================================
  SUCCESS LOG
  ================================================
  */

  console.log(
    `✅ TTS audio generated successfully`
  );

  console.log(
    `🎙️ Voice used: ${selectedVoice}`
  );

  console.log(
    `📦 Audio size: ${audioBuffer.length} bytes`
  );

  return audioBuffer;
}


// import { GoogleGenAI } from "@google/genai";

// /*
// ==================================================
// GEMINI API CLIENT
// ==================================================
// */

// const GEMINI_API_KEY =
//   process.env.GEMINI_API_KEY;

// if (!GEMINI_API_KEY) {
//   throw new Error(
//     "GEMINI_API_KEY is not configured"
//   );
// }

// const ai = new GoogleGenAI({
//   apiKey: GEMINI_API_KEY,
// });

// /*
// ==================================================
// GEMINI TTS CONFIGURATION
// ==================================================
// */

// const GEMINI_TTS_MODEL =
//   "gemini-2.5-flash-preview-tts";

// /*
// ==================================================
// GEMINI PREBUILT VOICES
// ==================================================

// Charon = male
// Kore   = female

// These are Gemini's prebuilt voices.
// */

// const MALE_VOICE = "Sadachbia";

// const FEMALE_VOICE = "Aoede";

// /*
// ==================================================
// NIGERIAN ENGLISH TUTOR STYLE
// ==================================================
// */

// const NIGERIAN_TUTOR_STYLE = `
// Speak as a warm, knowledgeable British teacher
// speaking naturally to a Nigerian primary or
// secondary school student.

// Use a natural British English speaking style,
// with Nigerian English pronunciation, intonation,
// rhythm and conversational flow where appropriate.

// Do not sound excessively British or American.

// Speak clearly and naturally, with a friendly,
// patient and encouraging teaching personality.

// Pronounce academic terms, names, numbers,
// scientific terms and mathematical expressions
// clearly.

// Use a moderate speaking pace suitable for learning.

// Pause naturally between important ideas.

// Do not sound robotic.

// Do not read these instructions aloud.

// Only speak the actual text provided to you.
// `;

// /*
// ==================================================
// SELECT VOICE
// ==================================================
// */

// function getTutorVoice({
//   gender,
//   voice,
// }) {
//   /*
//   Explicit voice takes priority.
//   */

//   if (
//     voice &&
//     voice !== "default"
//   ) {
//     return voice;
//   }

//   /*
//   Female student
//   */

//   if (gender === "female") {
//     return FEMALE_VOICE;
//   }

//   /*
//   Male student
//   */

//   if (gender === "male") {
//     return MALE_VOICE;
//   }

//   /*
//   Safe fallback
//   */

//   return MALE_VOICE;
// }

// /*
// ==================================================
// SPEED INSTRUCTION
// ==================================================
// */

// function getSpeedInstruction(speed) {
//   const safeSpeed = Math.min(
//     Math.max(
//       typeof speed === "number" ? speed : 1.1,
//       0.75
//     ),
//     1.25
//   );

//   if (safeSpeed <= 0.85) {
//     return `
// Speak slowly and deliberately.
// Give the student enough time to understand
// each idea.
// `;
//   }

//   if (safeSpeed <= 0.95) {
//     return `
// Speak at a slightly slower than normal
// teaching pace.
// `;
//   }

//   if (safeSpeed >= 1.15) {
//     return `
// Speak at a slightly fast, energetic teaching pace.
// Maintain clear pronunciation and natural Nigerian
// English rhythm. Do not rush or swallow words.
// `;
//   }

//   if (safeSpeed >= 1.05) {
//     return `
// Speak at a slightly faster than normal teaching pace.
// Keep the delivery energetic, natural and clear.
// Maintain clear pronunciation and short natural pauses.
// Do not sound rushed.
// `;
//   }

//   return `
// Speak at a natural moderate teaching pace.
// Maintain clear pronunciation and natural
// pauses between ideas.
// `;
// }


// /*
// ==================================================
// PCM → WAV
// ==================================================

// Gemini TTS returns raw PCM audio.

// The documented Gemini TTS output is:
// 24kHz
// mono
// 16-bit PCM

// We wrap that PCM data inside a WAV container
// so the browser can play it directly.
// */

// function pcmToWav(
//   pcmBuffer,
//   sampleRate = 24000,
//   channels = 1,
//   bitsPerSample = 16
// ) {
//   const byteRate =
//     sampleRate *
//     channels *
//     (bitsPerSample / 8);

//   const blockAlign =
//     channels *
//     (bitsPerSample / 8);

//   const dataSize =
//     pcmBuffer.length;

//   const buffer =
//     Buffer.alloc(
//       44 + dataSize
//     );

//   /*
//   RIFF header
//   */

//   buffer.write(
//     "RIFF",
//     0
//   );

//   buffer.writeUInt32LE(
//     36 + dataSize,
//     4
//   );

//   buffer.write(
//     "WAVE",
//     8
//   );

//   /*
//   fmt chunk
//   */

//   buffer.write(
//     "fmt ",
//     12
//   );

//   buffer.writeUInt32LE(
//     16,
//     16
//   );

//   /*
//   PCM format
//   */

//   buffer.writeUInt16LE(
//     1,
//     20
//   );

//   buffer.writeUInt16LE(
//     channels,
//     22
//   );

//   buffer.writeUInt32LE(
//     sampleRate,
//     24
//   );

//   buffer.writeUInt32LE(
//     byteRate,
//     28
//   );

//   buffer.writeUInt16LE(
//     blockAlign,
//     32
//   );

//   buffer.writeUInt16LE(
//     bitsPerSample,
//     34
//   );

//   /*
//   data chunk
//   */

//   buffer.write(
//     "data",
//     36
//   );

//   buffer.writeUInt32LE(
//     dataSize,
//     40
//   );

//   /*
//   PCM data
//   */

//   pcmBuffer.copy(
//     buffer,
//     44
//   );

//   return buffer;
// }

// /*
// ==================================================
// CALL GEMINI TTS
// ==================================================
// */

// export async function callTTSProvider({
//   text,
//   gender,
//   voice = "default",
//   speed = 1.1,
// }) {
//   /*
//   ================================================
//   Validate text
//   ================================================
//   */

//   if (!text?.trim()) {
//     throw new Error(
//       "TTS text is required"
//     );
//   }

//   /*
//   ================================================
//   Normalize gender
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
//   Select Gemini voice
//   ================================================
//   */

//   const selectedVoice =
//     getTutorVoice({
//       gender:
//         normalizedGender,
//       voice,
//     });

//   /*
//   ================================================
//   Build speaking instructions
//   ================================================
//   */

//   const speakingInstructions = `
// ${NIGERIAN_TUTOR_STYLE}

// ${getSpeedInstruction(speed)}

// The listener is a ${
//     normalizedGender === "female"
//       ? "female student"
//       : normalizedGender === "male"
//       ? "male student"
//       : "student"
//   }.

// Speak directly to the student as their
// personal AI tutor.

// Read the following text exactly.

// Do not add an introduction.

// Do not add a conclusion.

// Do not explain the instructions.

// Do not say phrases such as
// "Here is the answer" unless they are
// actually present in the supplied text.

// Text to speak:

// ${text.trim()}
// `;

//   /*
//   ================================================
//   Gemini TTS request
//   ================================================
//   */

//   const response =
//     await ai.models.generateContent({
//       model:
//         GEMINI_TTS_MODEL,

//       contents: [
//         {
//           parts: [
//             {
//               text:
//                 speakingInstructions,
//             },
//           ],
//         },
//       ],

//       config: {
//         responseModalities: [
//           "AUDIO",
//         ],

//         speechConfig: {
//           voiceConfig: {
//             prebuiltVoiceConfig: {
//               voiceName:
//                 selectedVoice,
//             },
//           },

//           languageCode:
//             "en-US",
//         },
//       },
//     });

//   /*
//   ================================================
//   Extract audio
//   ================================================
//   */

//   const audioData =
//     response
//       ?.candidates?.[0]
//       ?.content?.parts?.find(
//         (part) =>
//           part.inlineData
//       )
//       ?.inlineData?.data;

//   if (!audioData) {
//     throw new Error(
//       "Gemini TTS returned no audio data"
//     );
//   }

//   /*
//   ================================================
//   Gemini returns base64 PCM
//   ================================================
//   */

//   const pcmBuffer =
//     Buffer.from(
//       audioData,
//       "base64"
//     );

//   if (
//     !pcmBuffer ||
//     pcmBuffer.length === 0
//   ) {
//     throw new Error(
//       "Gemini TTS returned empty PCM audio"
//     );
//   }

//   /*
//   ================================================
//   Convert PCM → WAV
//   ================================================
//   */

//   const audioBuffer =
//     pcmToWav(
//       pcmBuffer,
//       24000,
//       1,
//       16
//     );

//   /*
//   ================================================
//   Final validation
//   ================================================
//   */

//   if (
//     !audioBuffer ||
//     audioBuffer.length === 0
//   ) {
//     throw new Error(
//       "Gemini TTS returned empty WAV audio"
//     );
//   }

//   return audioBuffer;
// }
