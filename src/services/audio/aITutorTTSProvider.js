
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
  const normalizedGender =
    typeof gender === "string"
      ? gender.trim().toLowerCase()
      : null;

   /*
    Female student
  */

  if (
    normalizedGender === "female"
  ) {

    return FEMALE_VOICE;
  }

  /*
    Male student
  */

  if (
    normalizedGender === "male"
  ) {

    return MALE_VOICE;
  }

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


export async function callTTSProvider({
  text,
  gender,
  speed = 1.1,
}) {

  if (!text?.trim()) {
    throw new Error(
      "TTS text is required"
    );
  }

  const selectedVoice =
    getTutorVoice(gender);


  const safeSpeed =
    getSafeSpeed(speed);

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

  const [response] =
    await ttsClient.synthesizeSpeech(
      request
    );

  if (
    !response ||
    !response.audioContent
  ) {
    throw new Error(
      "Google Cloud TTS returned no audio"
    );
  }

  const audioBuffer =
    Buffer.isBuffer(
      response.audioContent
    )
      ? response.audioContent
      : Buffer.from(
          response.audioContent,
          "binary"
        );

  if (
    !audioBuffer ||
    audioBuffer.length === 0
  ) {
    throw new Error(
      "Google Cloud TTS returned empty audio"
    );
  }

  return audioBuffer;
}
