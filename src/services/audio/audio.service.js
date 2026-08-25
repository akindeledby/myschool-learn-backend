import textToSpeech from "@google-cloud/text-to-speech";

/*
==========================================
Google Cloud TTS credentials
==========================================
*/

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
==========================================
GENERATE TTS
==========================================
*/

export async function callTTSProvider({
  text,
  voice,
  speed = 1,
}) {
  // const start = Date.now();

  // console.log(
  //   "[GoogleTTS] Request received:",
  //   {
  //     textLength: text?.length,
  //     voice,
  //     speed,
  //   }
  // );

  /*
  ========================================
  Validate text
  ========================================
  */

  if (!text?.trim()) {
    throw new Error(
      "TTS text is required"
    );
  }

  /*
  ========================================
  Select voice
  ========================================
  */

  const selectedVoice =
    !voice || voice === "default"
      ? "en-GB-Neural2-D"
      : voice;

  // console.log(
  //   "[GoogleTTS] Selected voice:",
  //   selectedVoice
  // );

  /*
  ========================================
  Safe speaking rate
  ========================================
  */

  const safeSpeed = Math.min(
    Math.max(
      typeof speed === "number"
        ? speed
        : 1,
      0.75
    ),
    1.25
  );

  /*
  ========================================
  Google TTS request
  ========================================
  */

  const request = {
    input: {
      text: text.trim(),
    },

    voice: {
      languageCode: "en-GB",
      name: selectedVoice,
    },

    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: safeSpeed,
    },
  };

  // console.log(
  //   "[GoogleTTS] Calling Google Cloud TTS..."
  // );

  /*
  ========================================
  Call Google Cloud
  ========================================
  */

  const [response] =
    await ttsClient.synthesizeSpeech(
      request
    );

  // console.log(
  //   "[GoogleTTS] Response received:",
  //   {
  //     duration:
  //       `${Date.now() - start}ms`,

  //     hasAudio:
  //       Boolean(response.audioContent),
  //   }
  // );

  /*
  ========================================
  Validate response
  ========================================
  */

  if (!response.audioContent) {
    throw new Error(
      "No audio returned from TTS"
    );
  }

  /*
  ========================================
  Convert audio to Buffer
  ========================================
  */

  const buffer =
    Buffer.from(
      response.audioContent,
      "binary"
    );

  // console.log(
  //   "[GoogleTTS] Audio buffer created:",
  //   {
  //     bytes: buffer.length,

  //     duration:
  //       `${Date.now() - start}ms`,
  //   }
  // );

  return buffer;
}


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