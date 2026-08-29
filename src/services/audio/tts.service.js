import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../../lib/aws-s3.js";
import { callTTSProvider } from "./audio.service.js";
import { getAudioDurationFromBuffer } from "./get-audio-duration.service.js";

function cleanTextForTTS(text) {
  if (!text) {
    return "";
  }

  return text
    .replace(/\*\*(.*?)\*\*/gs, "$1")

    .replace(/\*(.*?)\*/gs, "$1")

    .replace(/`([^`]+)`/g, "$1")

    .replace(/^#{1,6}\s*/gm, "")

    .replace(
      /\[([^\]]+)\]\([^)]+\)/g,
      "$1"
    )

    .replace(/~~(.*?)~~/gs, "$1")

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

    .replace(/~/g, "")

    .replace(/\s+/g, " ")

    .trim();
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
  voice = "en-GB-Neural2-B",
  speed = 1.1,
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


// import { PutObjectCommand } from "@aws-sdk/client-s3";
// import { s3 } from "../../lib/aws-s3.js";
// import { callTTSProvider } from "./audio.service.js";
// import { getAudioDurationFromBuffer } from "./get-audio-duration.service.js";

// function cleanTextForTTS(text) {
//   if (!text) {
//     return "";
//   }

//   return text
//     .replace(/\*\*(.*?)\*\*/gs, "$1")
//     .replace(/\*(.*?)\*/gs, "$1")
//     .replace(/`([^`]+)`/g, "$1")
//     .replace(/^#{1,6}\s*/gm, "")
//     .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
//     .replace(/~~(.*?)~~/gs, "$1")
//     .replace(/^\s*[-*+]\s+/gm, "")
//     .replace(/^\s*\d+\.\s+/gm, "")
//     .replace(/^\s*>\s?/gm, "")
//     .replace(/\*/g, "")
//     .replace(/_/g, "")
//     .replace(/~/g, "")
//     .replace(/\s+/g, " ")
//     .trim();
// }

// /*
// ==========================================
// LESSON VIDEO TTS
// ==========================================
// */

// export async function generateTTS({
//   topicId,
//   sceneId,
//   text,
//   voice = "Kore",
//   speed = 1.1,
// }) {
//   if (!text?.trim()) {
//     throw new Error(
//       "Text is required for TTS"
//     );
//   }

//   const bucketName =
//     process.env.REMOTION_AWS_BUCKET_NAME;

//   const region =
//     process.env.AWS_REGION;

//   if (!bucketName) {
//     throw new Error(
//       "REMOTION_AWS_BUCKET_NAME missing"
//     );
//   }

//   if (!region) {
//     throw new Error(
//       "AWS_REGION missing"
//     );
//   }

//   const ttsText =
//     cleanTextForTTS(text);

//   if (!ttsText) {
//     throw new Error(
//       `TTS text became empty after cleaning for scene ${sceneId}`
//     );
//   }

//   const fileName =
//     `scene-${sceneId}.wav`;

//   const s3Key =
//     `audio/${topicId}/${fileName}`;

//   try {
//     console.log(
//       `🎤 Generating Gemini TTS audio for scene ${sceneId}`
//     );

//     const audioBuffer =
//       await callTTSProvider({
//         text: ttsText,
//         voice,
//         speed,
//       });

//     if (
//       !audioBuffer ||
//       !audioBuffer.length
//     ) {
//       throw new Error(
//         `Gemini TTS provider returned empty audio for scene ${sceneId}`
//       );
//     }

//     /*
//     ========================================
//     GET AUDIO DURATION
//     ========================================
//     */

//     const durationInSeconds =
//       await getAudioDurationFromBuffer(
//         audioBuffer
//       );

//     if (
//       !durationInSeconds ||
//       durationInSeconds <= 0
//     ) {
//       throw new Error(
//         `Unable to determine audio duration for scene ${sceneId}`
//       );
//     }

//     /*
//     ========================================
//     VIDEO FRAME DURATION
//     ========================================
//     */

//     const fps = 30;

//     const durationInFrames =
//       Math.ceil(
//         durationInSeconds * fps
//       );

//     /*
//     ========================================
//     UPLOAD TO S3
//     ========================================
//     */

//     await s3.send(
//       new PutObjectCommand({
//         Bucket: bucketName,

//         Key: s3Key,

//         Body: audioBuffer,

//         ContentType:
//           "audio/wav",
//       })
//     );

//     const audioUrl =
//       `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;

//     console.log(
//       `✅ Scene ${sceneId} audio uploaded`
//     );

//     console.log(
//       `⏱️ Duration: ${durationInSeconds.toFixed(2)}s`
//     );

//     console.log(
//       `🎞️ Frames: ${durationInFrames}`
//     );

//     return {
//       sceneId,
//       fileName,
//       s3Key,
//       audioUrl,
//       durationInSeconds,
//       durationInFrames,
//     };

//   } catch (error) {
//     console.error(
//       `❌ Gemini TTS generation failed for scene ${sceneId}`,
//       error
//     );

//     throw error;
//   }
// }


// import { PutObjectCommand } from "@aws-sdk/client-s3";
// import { s3 } from "../../lib/aws-s3.js";
// import { callTTSProvider } from "./audio.service.js";
// import { getAudioDurationFromBuffer } from "./get-audio-duration.service.js";

// // =====================================
// // GENERATE TTS
// // =====================================

// export async function generateTTS({
//   topicId,
//   sceneId,
//   text,
//   voice = "en-GB-Neural2-D",
//   speed = 1,
// }) {
//   if (!text?.trim()) {
//     throw new Error("Text is required for TTS");
//   }

//   const bucketName =
//     process.env.REMOTION_AWS_BUCKET_NAME;

//   const region =
//     process.env.AWS_REGION;

//   if (!bucketName) {
//     throw new Error(
//       "REMOTION_AWS_BUCKET_NAME missing"
//     );
//   }

//   if (!region) {
//     throw new Error("AWS_REGION missing");
//   }

//   // =====================================
//   // FILE
//   // =====================================

//   const fileName = `scene-${sceneId}.mp3`;

//   const s3Key = `audio/${topicId}/${fileName}`;

//   try {
//     console.log(
//       `🎤 Generating audio for scene ${sceneId}`
//     );

//     // =====================================
//     // GENERATE AUDIO
//     // =====================================

//     const audioBuffer =
//       await callTTSProvider({
//         text,
//         voice,
//         speed,
//       });

//     if (!audioBuffer || !audioBuffer.length) {
//       throw new Error(
//         `TTS provider returned empty audio for scene ${sceneId}`
//       );
//     }

//     // =====================================
//     // GET AUDIO DURATION
//     // =====================================

//     const durationInSeconds =
//       await getAudioDurationFromBuffer(
//         audioBuffer
//       );

//     const fps = 30;

//     const durationInFrames =
//       Math.ceil(
//         durationInSeconds * fps
//       );

//     // =====================================
//     // UPLOAD TO S3
//     // =====================================

//     console.log(
//       `☁️ Uploading ${fileName} to S3`
//     );

//     await s3.send(
//       new PutObjectCommand({
//         Bucket: bucketName,
//         Key: s3Key,
//         Body: audioBuffer,
//         ContentType: "audio/mpeg",
//       })
//     );

//     // =====================================
//     // PUBLIC AUDIO URL
//     // =====================================

//     const audioUrl =
//       `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;

//     console.log(
//       `✅ Audio uploaded for scene ${sceneId}`
//     );

//     // =====================================
//     // RETURN
//     // =====================================

//     return {
//       sceneId,
//       fileName,
//       s3Key,
//       audioUrl,
//       durationInSeconds,
//       durationInFrames,
//     };
//   } catch (error) {
//     console.error(
//       `❌ TTS generation failed for scene ${sceneId}`
//     );

//     console.error(error);

//     throw error;
//   }
// }
