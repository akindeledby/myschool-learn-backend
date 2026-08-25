// get-audio-duration-buffer.service.js

import os from "os";
import path from "path";
import fs from "fs/promises";

import ffmpeg from "../../../src/lib/ffmpeg.js";

// =====================================
// GET AUDIO DURATION FROM BUFFER
// =====================================

export async function getAudioDurationFromBuffer(
  audioBuffer
) {
  if (!audioBuffer) {
    throw new Error(
      "Audio buffer is required"
    );
  }

  const tempFilePath = path.join(
    os.tmpdir(),
    `audio-${Date.now()}.mp3`
  );

  try {
    // =====================================
    // WRITE TEMP FILE
    // =====================================

    await fs.writeFile(
      tempFilePath,
      audioBuffer
    );

    // =====================================
    // GET DURATION
    // =====================================

    const duration =
      await new Promise(
        (resolve, reject) => {
          ffmpeg.ffprobe(
            tempFilePath,
            (err, metadata) => {
              if (err) {
                return reject(err);
              }

              resolve(
                metadata.format.duration || 0
              );
            }
          );
        }
      );

    return Number(duration);

  } finally {
    // =====================================
    // CLEAN TEMP FILE
    // =====================================

    try {
      await fs.unlink(
        tempFilePath
      );
    } catch {}
  }
}

