import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenAI } from "@google/genai";

import { s3 } from "../../lib/aws-s3.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const BUCKET = process.env.REMOTION_AWS_BUCKET_NAME;
const REGION = process.env.AWS_REGION;

if (!BUCKET) {
  throw new Error("REMOTION_AWS_BUCKET_NAME missing");
}

if (!REGION) {
  throw new Error("AWS_REGION missing");
}

const MAX_RETRIES = 3;

// =====================================
// GENERATE IMAGE
// =====================================

async function createImageFromPrompt(prompt) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `🎨 Gemini image generation (attempt ${attempt}/${MAX_RETRIES})`
      );

      console.log(prompt);

      const response =
        await ai.models.generateContent({
          model: "gemini-2.5-flash-image",

          contents: [
            {
              role: "user",

              parts: [
                {
                  text: `
                    Generate a clean educational illustration.

                    Requirements
                    • low quality
                    • colourful
                    • child friendly
                    • simple background
                    • educational
                    • classroom suitable
                    • no watermark
                    • no text unless requested

                    Illustration:

                    ${prompt}
                  `,
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

      const candidates =
        response?.candidates ?? [];

      if (!candidates.length) {
        throw new Error(
          "Gemini returned no candidates."
        );
      }

      const parts =
        candidates[0]?.content?.parts ?? [];

      const imagePart =
        parts.find(
          (part) => part.inlineData
        );

      if (!imagePart) {
        const text =
          parts
            .filter((p) => p.text)
            .map((p) => p.text)
            .join("\n");

        console.log(
          "Gemini returned text instead of image:"
        );

        console.log(text);

        throw new Error(
          "Gemini returned no image."
        );
      }

      return {
        imageBuffer: Buffer.from(
          imagePart.inlineData.data,
          "base64"
        ),

        mimeType:
          imagePart.inlineData.mimeType ||
          "image/png",
      };

    } catch (error) {
      lastError = error;

      console.error(
        `Gemini attempt ${attempt} failed`
      );

      console.error(error.message);

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, 2000)
        );
      }
    }
  }

  throw lastError;
}

// =====================================
// UPLOAD TO S3
// =====================================

async function uploadImage({
  topicId,
  sceneIndex,
  blockIndex,
  prompt,
  imageBuffer,
  mimeType,
}) {
  const extension =
    mimeType.includes("jpeg")
      ? "jpg"
      : "png";

  const hash = crypto
    .createHash("md5")
    .update(prompt)
    .digest("hex")
    .substring(0, 10);

  const fileName =
    `${Date.now()}-${hash}.${extension}`;

  const key =
    `generated-images/${topicId}/scene-${sceneIndex}/block-${blockIndex}/${fileName}`;

  console.log("☁ Uploading image");

  console.log(key);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,

      Key: key,

      Body: imageBuffer,

      ContentType: mimeType,

      CacheControl:
        "public,max-age=31536000,immutable",
    })
  );

  const imageUrl =
    `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

  console.log("✅ Upload complete");

  console.log(imageUrl);

  return imageUrl;
}

// =====================================
// GENERATE SCENE IMAGES
// =====================================

export async function generateSceneImages({
  topicId,
  scene,
  sceneIndex,
}) {
  if (
    !scene ||
    !Array.isArray(scene.blocks)
  ) {
    return scene;
  }

  const updatedBlocks = [];

  for (
    let blockIndex = 0;
    blockIndex < scene.blocks.length;
    blockIndex++
  ) {
    const block =
      scene.blocks[blockIndex];

    if (block.type !== "image") {
      updatedBlocks.push(block);
      continue;
    }

    if (
      !block.prompt ||
      !block.prompt.trim()
    ) {
      updatedBlocks.push({
        ...block,
        imageError: true,
      });

      continue;
    }

    console.log(
      "===================================="
    );

    console.log(
      `Scene ${sceneIndex} | Image Block ${blockIndex}`
    );

    try {
      const {
        imageBuffer,
        mimeType,
      } =
        await createImageFromPrompt(
          block.prompt
        );

      const imageUrl =
        await uploadImage({
          topicId,
          sceneIndex,
          blockIndex,
          prompt:
            block.prompt,
          imageBuffer,
          mimeType,
        });

      updatedBlocks.push({
        ...block,

        imageUrl,

        imageMimeType:
          mimeType,

        imageGeneratedAt:
          new Date().toISOString(),

        imageError: false,
      });

      console.log(
        "✅ Image attached successfully"
      );

    } catch (error) {
      console.error(
        `❌ Failed image for Scene ${sceneIndex} Block ${blockIndex}`
      );

      console.error(error);

      updatedBlocks.push({
        ...block,

        imageError: true,

        imageErrorMessage:
          error.message,
      });
    }

    console.log(
      "===================================="
    );
  }

  return {
    ...scene,

    blocks: updatedBlocks,
  };
}
