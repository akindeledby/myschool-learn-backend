import crypto from "crypto";

import { PutObjectCommand } from "@aws-sdk/client-s3";

import { ai } from "../../../lib/gemini.js";
import { s3 } from "../../lib/aws-s3.js";

const IMAGE_MODEL =
  "gemini-2.5-flash-image";

const MAX_RETRIES = 3;

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
GENERATE AND UPLOAD ASSIGNMENT IMAGE
==========================================
*/

export async function generateAssignmentImage({
  prompt,
  studentId,
}) {
  /*
  ========================================
  VALIDATE INPUT
  ========================================
  */

  if (!prompt?.trim()) {
    throw new Error(
      "Assignment image generation prompt is required."
    );
  }

  if (!studentId) {
    throw new Error(
      "Student ID is required for assignment image generation."
    );
  }

  let lastError;

  /*
  ========================================
  RETRY IMAGE GENERATION
  ========================================
  */

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      console.log(
        `🎨 Assignment image generation attempt ${attempt}/${MAX_RETRIES}`
      );

      /*
      ====================================
      GENERATE IMAGE WITH GEMINI
      ====================================
      */

      const response =
        await ai.models.generateContent({
          model: IMAGE_MODEL,

          contents: [
            {
              role: "user",

              parts: [
                {
                  text: `
                    Generate a clean educational illustration for a school student's homework or assignment.

                    Requirements:

                    • child friendly
                    • educational
                    • accurate
                    • classroom appropriate
                    • clear and easy to understand
                    • suitable for the student's academic level
                    • visually engaging without being distracting
                    • simple and uncluttered composition
                    • focused specifically on the educational concept
                    • no watermark
                    • no unnecessary decorative text
                    • no slogans
                    • no advertisements
                    • no inappropriate content
                    • no sexual content
                    • no graphic violence
                    • do not add information that is not supported by the assignment
                    • use labels only when labels are educationally necessary
                    • if labels are required, make them clear and readable

                    The image should help the student understand the assignment rather than merely decorate the answer.

                    Educational image request:

                    ${prompt.trim()}
                  `.trim(),
                },
              ],
            },
          ],

          config: {
            responseModalities: [
              "TEXT",
              "IMAGE",
            ],
          },
        });

      /*
      ====================================
      VALIDATE GEMINI RESPONSE
      ====================================
      */

      const candidates =
        response?.candidates || [];

      if (!candidates.length) {
        throw new Error(
          "Gemini returned no candidates."
        );
      }

      const parts =
        candidates[0]?.content?.parts || [];

      let imagePart = null;
      let textPart = "";

      /*
      ====================================
      FIND IMAGE DATA
      ====================================
      */

      for (const part of parts) {
        if (part.text) {
          textPart += part.text;
        }

        if (
          part.inlineData?.data
        ) {
          imagePart =
            part.inlineData;
        }
      }

      if (!imagePart?.data) {
        throw new Error(
          "Gemini did not return an image."
        );
      }

      /*
      ====================================
      CONVERT BASE64 TO BUFFER
      ====================================
      */

      const buffer =
        Buffer.from(
          imagePart.data,
          "base64"
        );

      if (!buffer.length) {
        throw new Error(
          "Generated assignment image buffer is empty."
        );
      }

      const mimeType =
        imagePart.mimeType ||
        "image/png";

      /*
      ====================================
      DETERMINE EXTENSION
      ====================================
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
      ====================================
      CREATE UNIQUE FILE NAME
      ====================================
      */

      const fileName =
        `${Date.now()}-${crypto.randomUUID()}.${extension}`;

      /*
      ====================================
      S3 OBJECT KEY
      ====================================
      */

      const key =
        `generated-assignment-images/${studentId}/${fileName}`;

      /*
      ====================================
      UPLOAD TO S3
      ====================================
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
      ====================================
      PUBLIC IMAGE URL
      ====================================
      */

      const url =
        `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

      console.log(
        "✅ Assignment image generated and uploaded successfully."
      );

      /*
      ====================================
      RETURN IMAGE INFORMATION
      ====================================
      */

      return {
        url,

        storageKey: key,

        mimeType,

        model: IMAGE_MODEL,

        description:
          textPart.trim() || null,
      };

    } catch (error) {
      lastError = error;

      console.error(
        `❌ Assignment image generation attempt ${attempt} failed:`,
        error?.message || error
      );

      /*
      ======================================
      WAIT BEFORE RETRY
      ======================================
      */

      if (
        attempt < MAX_RETRIES
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              2000
            )
        );
      }
    }
  }

  throw lastError;
}