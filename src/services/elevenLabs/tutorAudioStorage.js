import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { s3 } from "../../lib/aws-s3.js";

const BUCKET =
  process.env.REMOTION_AWS_BUCKET_NAME;

const REGION =
  process.env.AWS_REGION;

if (!BUCKET) {
  throw new Error(
    "REMOTION_AWS_BUCKET_NAME missing"
  );
}

if (!REGION) {
  throw new Error(
    "AWS_REGION missing"
  );
}

/*
==========================================
UPLOAD GENERATED TUTOR AUDIO
==========================================
*/

export async function uploadTutorAudio({
  buffer,
  mimeType = "audio/mpeg",
  studentId,
  conversationId,
  sequence,
}) {
  if (!buffer) {
    throw new Error(
      "Audio buffer is required."
    );
  }

  if (!mimeType) {
    throw new Error(
      "Audio MIME type is required."
    );
  }

  if (!studentId) {
    throw new Error(
      "Student ID is required."
    );
  }

  if (!conversationId) {
    throw new Error(
      "Conversation ID is required."
    );
  }

  if (
    sequence === undefined ||
    sequence === null
  ) {
    throw new Error(
      "Audio sequence is required."
    );
  }

  /*
  ========================================
  DETERMINE FILE EXTENSION
  ========================================
  */

  let extension = "mp3";

  if (
    mimeType === "audio/wav" ||
    mimeType === "audio/x-wav"
  ) {
    extension = "wav";
  } else if (
    mimeType === "audio/ogg"
  ) {
    extension = "ogg";
  } else if (
    mimeType === "audio/webm"
  ) {
    extension = "webm";
  } else if (
    mimeType === "audio/mp4" ||
    mimeType === "audio/m4a"
  ) {
    extension = "m4a";
  }

  /*
  ========================================
  CREATE UNIQUE FILE NAME
  ========================================
  */

  const hash = crypto
    .createHash("md5")
    .update(
      `${studentId}-${conversationId}-${sequence}-${Date.now()}-${crypto.randomUUID()}`
    )
    .digest("hex")
    .substring(0, 12);

  const fileName =
    `sentence-${sequence}-${hash}.${extension}`;

  /*
  ========================================
  S3 OBJECT KEY
  ========================================
  */

  const key =
    `generated-tutor-audio/${studentId}/${conversationId}/${fileName}`;

//   console.log(
//     "===================================="
//   );

//   console.log(
//     "Uploading Tutor audio to S3:"
//   );

//   console.log(key);

  /*
  ========================================
  UPLOAD
  ========================================
  */

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,

      Key: key,

      Body: buffer,

      ContentType: mimeType,

      CacheControl:
        "public,max-age=31536000,immutable",
    })
  );

  /*
  ========================================
  PUBLIC AUDIO URL
  ========================================
  */

  const url =
    `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

//   console.log(
//     "Tutor audio uploaded successfully:"
//   );

//   console.log(url);

//   console.log(
//     "===================================="
//   );

  return {
    url,
    storageKey: key,
    sequence: Number(sequence),
    mimeType,
  };
}