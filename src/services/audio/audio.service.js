
import textToSpeech from "@google-cloud/text-to-speech";

const credentials = JSON.parse(
  process.env.GOOGLE_TTS_CREDENTIALS
);

const ttsClient = new textToSpeech.TextToSpeechClient({
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key.replace(/\\n/g, "\n"),
  },
  projectId: credentials.project_id,
});

export async function callTTSProvider({
  text,
  voice,
  speed = 1,
}) {
  const selectedVoice =
    !voice || voice === "default"
      ? "en-GB-Neural2-B"
      : voice;

  const request = {
    input: { text },

    voice: {
      languageCode: "en-GB",
      name: selectedVoice,
    },

    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: speed,
    },
  };

  const [response] =
    await ttsClient.synthesizeSpeech(request);

  if (!response.audioContent) {
    throw new Error(
      "No audio returned from TTS"
    );
  }

  return Buffer.from(
    response.audioContent,
    "binary"
  );
}

