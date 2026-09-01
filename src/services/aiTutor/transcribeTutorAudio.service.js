import fs from "node:fs/promises";
import { ai } from "../../../lib/gemini.js";

const TRANSCRIPTION_MODEL =
  "gemini-3.5-transcribe";

export async function transcribeTutorAudio({
  filePath,
  mimeType,
}) {
  if (!filePath) {
    const error = new Error(
      "Audio file is required."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!mimeType) {
    const error = new Error(
      "Audio MIME type is required."
    );

    error.statusCode = 400;

    throw error;
  }

  try {
    // console.log(
    //   "[TUTOR TRANSCRIPTION] Uploading audio to Gemini:",
    //   {
    //     filePath,
    //     mimeType,
    //   }
    // );

    const audioFile =
      await ai.files.upload({
        file: filePath,

        config: {
          mimeType,
        },
      });

    if (!audioFile?.uri) {
      const error = new Error(
        "Unable to upload the audio for transcription."
      );

      error.statusCode = 502;

      throw error;
    }

    // console.log(
    //   "[TUTOR TRANSCRIPTION] Audio uploaded:",
    //   {
    //     uri: audioFile.uri,
    //     mimeType: audioFile.mimeType,
    //   }
    // );

    const interaction =
      await ai.interactions.create({
        model: TRANSCRIPTION_MODEL,

        input: [
          {
            type: "audio",
            uri: audioFile.uri,
            mime_type: audioFile.mimeType,
          },
        ],

        generation_config: {
          transcription_config: {
            mode: "smart",
            language_codes: [],
          },
        },
      });

    const text =
      interaction?.output_text?.trim();

    if (!text) {
      const error = new Error(
        "No speech could be detected in the audio."
      );

      error.statusCode = 422;

      throw error;
    }

    // console.log(
    //   "[TUTOR TRANSCRIPTION] Transcription completed."
    // );

    return text;
  } finally {
    try {
      await fs.unlink(filePath);

      // console.log(
      //   "[TUTOR TRANSCRIPTION] Temporary audio file deleted."
      // );
    } catch (error) {
      console.error(
        "[TUTOR TRANSCRIPTION] Failed to delete temporary audio file:",
        error
      );
    }
  }
}