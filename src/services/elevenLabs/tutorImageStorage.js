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
UPLOAD GENERATED TUTOR IMAGE
==========================================
*/

export async function uploadTutorImage({
  buffer,
  mimeType,
  studentId,
  conversationId,
}) {
  if (!buffer) {
    throw new Error(
      "Image buffer is required."
    );
  }

  if (!mimeType) {
    throw new Error(
      "Image MIME type is required."
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

  /*
  ========================================
  DETERMINE FILE EXTENSION
  ========================================
  */

  let extension = "png";

  if (
    mimeType === "image/jpeg" ||
    mimeType === "image/jpg"
  ) {
    extension = "jpg";
  } else if (
    mimeType === "image/webp"
  ) {
    extension = "webp";
  }

  /*
  ========================================
  CREATE UNIQUE FILE NAME
  ========================================
  */

  const fileName =
    `${Date.now()}-${crypto.randomUUID()}.${extension}`;

  /*
  ========================================
  S3 OBJECT KEY
  ========================================
  */

  const key =
    `generated-tutor-images/${studentId}/${conversationId}/${fileName}`;

  console.log(
    "===================================="
  );

  console.log(
    "Uploading Tutor image to S3:"
  );

  console.log(key);

  /*
  ========================================
  UPLOAD TO S3
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
  PUBLIC IMAGE URL
  ========================================
  */

  const url =
    `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

  console.log(
    "Tutor image uploaded successfully:"
  );

  console.log(url);

  console.log(
    "===================================="
  );

  return {
    url,
    storageKey: key,
  };
}