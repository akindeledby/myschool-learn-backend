import { GoogleGenAI } from "@google/genai";
import wav from "wav";

/*
==================================================
GEMINI AI CLIENT
==================================================
*/

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/*
==================================================
GEMINI TTS MODEL
==================================================
*/

const GEMINI_TTS_MODEL =
  "gemini-2.5-flash-preview-tts";

/*
==================================================
DEFAULT VOICE
==================================================

Kore gives a warm female teaching voice.

You can change this to another Gemini
prebuilt voice later if desired.
==================================================
*/

const DEFAULT_VOICE = "Kore";

/*
==================================================
NIGERIAN TEACHER STYLE
==================================================
*/

const NIGERIAN_TUTOR_STYLE = `
You are a warm, knowledgeable British teacher
creating an educational lesson for Nigerian
primary and secondary school students.

Speak naturally with authentic British English
pronunciation, intonation and rhythm.

Do not sound excessively British.
Do not sound American.

Use a clear, confident and friendly British
English teaching voice.

Sound like an experienced British classroom teacher
explaining a lesson naturally to students.

Keep the narration engaging and lively.

Use a slightly fast but comfortable teaching pace.
Do not rush.
Do not swallow words.
Pronounce academic, scientific and mathematical
terms clearly.

Use short natural pauses between important ideas.

When emphasizing an important concept, use natural
vocal emphasis.

Do not read these instructions aloud.
`;

/*
==================================================
SPEED INSTRUCTION
==================================================
*/

function getSpeedInstruction(speed) {
  const safeSpeed = Math.min(
    Math.max(
      typeof speed === "number"
        ? speed
        : 1.1,
      0.75
    ),
    1.25
  );

  if (safeSpeed <= 0.85) {
    return `
Speak slowly and deliberately.
Give students enough time to understand
each idea.
`;
  }

  if (safeSpeed <= 0.95) {
    return `
Speak at a slightly slower than normal
teaching pace.
`;
  }

  if (safeSpeed >= 1.15) {
    return `
Speak at a slightly fast and energetic
teaching pace.

Remain very clear and easy to understand.
Do not rush through important concepts.
`;
  }

  if (safeSpeed >= 1.05) {
    return `
Speak at a slightly faster than normal
teaching pace.

Keep the delivery energetic, natural
and very clear.

Maintain short natural pauses between
important ideas.
`;
  }

  return `
Speak at a natural moderate teaching pace.
`;
}

/*
==================================================
GENERATE WAV FROM PCM
==================================================

Gemini returns:

24,000 Hz
1 channel
16 bit PCM

We wrap that PCM data inside a WAV container.
==================================================
*/

function pcmToWav(
  pcmBuffer,
  {
    sampleRate = 24000,
    channels = 1,
    bitDepth = 16,
  } = {}
) {
  return new Promise(
    (resolve, reject) => {
      const chunks = [];

      const writer =
        new wav.Writer({
          channels,
          sampleRate,
          bitDepth,
        });

      writer.on(
        "data",
        (chunk) => {
          chunks.push(chunk);
        }
      );

      writer.on(
        "finish",
        () => {
          resolve(
            Buffer.concat(chunks)
          );
        }
      );

      writer.on(
        "error",
        reject
      );

      writer.write(pcmBuffer);
      writer.end();
    }
  );
}

/*
==================================================
CALL GEMINI TTS
==================================================
*/

export async function callTTSProvider({
  text,
  voice = DEFAULT_VOICE,
  speed = 1.1,
}) {
  /*
  ================================================
  Validate text
  ================================================
  */

  if (!text?.trim()) {
    throw new Error(
      "TTS text is required"
    );
  }

  /*
  ================================================
  Validate API key
  ================================================
  */

  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing"
    );
  }

  /*
  ================================================
  Select voice
  ================================================
  */

  const selectedVoice =
    !voice ||
    voice === "default"
      ? DEFAULT_VOICE
      : voice;

  /*
  ================================================
  Build Gemini TTS prompt
  ================================================
  */

  const prompt = `
${NIGERIAN_TUTOR_STYLE}

${getSpeedInstruction(speed)}

Voice:
Speak as one British teacher.

Text to narrate:

${text.trim()}
`;

  /*
  ================================================
  Generate speech
  ================================================
  */

  console.log(
    `🎙️ Gemini TTS generating speech using ${selectedVoice}`
  );

  const response =
    await ai.models.generateContent({
      model:
        GEMINI_TTS_MODEL,

      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],

      config: {
        responseModalities: [
          "AUDIO",
        ],

        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName:
                selectedVoice,
            },
          },
        },
      },
    });

  /*
  ================================================
  Extract PCM audio
  ================================================
  */

  const base64Audio =
    response
      ?.candidates?.[0]
      ?.content?.parts?.[0]
      ?.inlineData?.data;

  if (!base64Audio) {
    throw new Error(
      "Gemini TTS returned no audio data"
    );
  }

  const pcmBuffer =
    Buffer.from(
      base64Audio,
      "base64"
    );

  if (
    !pcmBuffer ||
    pcmBuffer.length === 0
  ) {
    throw new Error(
      "Gemini TTS returned empty audio"
    );
  }

  /*
  ================================================
  Convert PCM → WAV
  ================================================
  */

  const wavBuffer =
    await pcmToWav(
      pcmBuffer,
      {
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
      }
    );

  if (
    !wavBuffer ||
    wavBuffer.length === 0
  ) {
    throw new Error(
      "Failed to convert Gemini PCM audio to WAV"
    );
  }

  console.log(
    `✅ Gemini TTS generated ${wavBuffer.length} bytes`
  );

  return wavBuffer;
}


// import textToSpeech from "@google-cloud/text-to-speech";

// /*
// ==========================================
// Google Cloud TTS credentials
// ==========================================
// */

// const credentials = JSON.parse(
//   process.env.GOOGLE_TTS_CREDENTIALS
// );

// const ttsClient =
//   new textToSpeech.TextToSpeechClient({
//     credentials: {
//       client_email:
//         credentials.client_email,

//       private_key:
//         credentials.private_key.replace(
//           /\\n/g,
//           "\n"
//         ),
//     },

//     projectId:
//       credentials.project_id,
//   });

// /*
// ==========================================
// GENERATE TTS
// ==========================================
// */

// export async function callTTSProvider({
//   text,
//   voice,
//   speed = 1,
// }) {

//   /*
//   ========================================
//   Validate text
//   ========================================
//   */

//   if (!text?.trim()) {
//     throw new Error(
//       "TTS text is required"
//     );
//   }

//   /*
//   ========================================
//   Select voice
//   ========================================
//   */

//   const selectedVoice =
//     !voice || voice === "default"
//       ? "en-GB-Neural2-D"
//       : voice;

//   /*
//   ========================================
//   Safe speaking rate
//   ========================================
//   */

//   const safeSpeed = Math.min(
//     Math.max(
//       typeof speed === "number"
//         ? speed
//         : 1,
//       0.75
//     ),
//     1.25
//   );

//   /*
//   ========================================
//   Google TTS request
//   ========================================
//   */

//   const request = {
//     input: {
//       text: text.trim(),
//     },

//     voice: {
//       languageCode: "en-GB",
//       name: selectedVoice,
//     },

//     audioConfig: {
//       audioEncoding: "MP3",
//       speakingRate: safeSpeed,
//     },
//   };

//   /*
//   ========================================
//   Call Google Cloud
//   ========================================
//   */

//   const [response] =
//     await ttsClient.synthesizeSpeech(
//       request
//     );

//   /*
//   ========================================
//   Validate response
//   ========================================
//   */

//   if (!response.audioContent) {
//     throw new Error(
//       "No audio returned from TTS"
//     );
//   }

//   /*
//   ========================================
//   Convert audio to Buffer
//   ========================================
//   */

//   const buffer =
//     Buffer.from(
//       response.audioContent,
//       "binary"
//     );

//   return buffer;
// }


// import textToSpeech from "@google-cloud/text-to-speech";

// const credentials = JSON.parse(
//   process.env.GOOGLE_TTS_CREDENTIALS
// );

// const ttsClient = new textToSpeech.TextToSpeechClient({
//   credentials: {
//     client_email: credentials.client_email,
//     private_key: credentials.private_key.replace(/\\n/g, "\n"),
//   },
//   projectId: credentials.project_id,
// });

// export async function callTTSProvider({
//   text,
//   voice,
//   speed = 1,
// }) {
//   const selectedVoice =
//     !voice || voice === "default"
//       ? "en-GB-Neural2-D"
//       : voice;

//   const request = {
//     input: { text },

//     voice: {
//       languageCode: "en-GB",
//       name: selectedVoice,
//     },

//     audioConfig: {
//       audioEncoding: "MP3",
//       speakingRate: speed,
//     },
//   };

//   const [response] =
//     await ttsClient.synthesizeSpeech(request);

//   if (!response.audioContent) {
//     throw new Error(
//       "No audio returned from TTS"
//     );
//   }

//   return Buffer.from(
//     response.audioContent,
//     "binary"
//   );
// }