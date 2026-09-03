import { Worker } from "bullmq";

import { db } from "../../lib/db.js";
import { createRedisConnection } from "../../lib/redis.js";

import { audioQueue } from "../queues/audio.queue.js";
import { generateSceneImages } from "../services/image/image-generator.service.js";

import {
  decideSceneImages,
} from "../services/image/imageGenerationDecision.service.js";

const MAX_IMAGES_PER_TOPIC = 2;

// =====================================
// IMAGE WORKER
// =====================================

export const imageWorker = new Worker(
  "image",

  async (job) => {
    const { topicId } = job.data;

    try {
      console.log(
        `🖼️ Image job started for topic ${topicId}`
      );

      // =====================================
      // FETCH TOPIC
      // =====================================

      const topic =
        await db.topic.findUnique({
          where: {
            id: topicId,
          },
        });

      if (!topic) {
        throw new Error(
          "Topic not found"
        );
      }

      // =====================================
      // ALREADY COMPLETED
      // =====================================

      if (
        topic.status === "COMPLETED"
      ) {
        console.log(
          "✅ Topic already completed. Skipping image worker."
        );

        return {
          success: true,
          topicId,
          skipped: true,
          reason:
            "Topic already completed",
        };
      }

      // =====================================
      // GET SCENES
      // =====================================

      let scenes =
        topic.generatedScenes || [];

      if (
        !Array.isArray(scenes) ||
        scenes.length === 0
      ) {
        throw new Error(
          "No generated scenes found."
        );
      }

      console.log(
        `📚 Found ${scenes.length} scenes.`
      );

      // =====================================
      // IMAGE GENERATION DECISION
      // =====================================

      const decision =
        decideSceneImages({
          scenes,

          maxImages:
            MAX_IMAGES_PER_TOPIC,
        });

      scenes =
        decision.scenes;

      console.log(
        "🧠 Image generation decision complete."
      );

      console.log(
        `🖼️ Image candidates: ${decision.candidates}`
      );

      console.log(
        `✅ Approved images: ${decision.selectedImages}`
      );

      // =====================================
      // SAVE IMAGE DECISIONS
      // =====================================

      await db.topic.update({
        where: {
          id: topicId,
        },

        data: {
          generatedScenes:
            scenes,
        },
      });

      // =====================================
      // FIND APPROVED IMAGE BLOCKS
      // =====================================

      const approvedImageBlocks = [];

      scenes.forEach(
        (scene, sceneIndex) => {
          if (
            !scene ||
            !Array.isArray(
              scene.blocks
            )
          ) {
            return;
          }

          scene.blocks.forEach(
            (
              block,
              blockIndex
            ) => {
              if (
                !block ||
                block.type !==
                  "image"
              ) {
                return;
              }

              if (
                block.imageGenerationDecision !==
                "APPROVED"
              ) {
                return;
              }

              approvedImageBlocks.push({
                sceneIndex,
                blockIndex,
                hasImage:
                  Boolean(
                    block.imageUrl
                  ),
              });
            }
          );
        }
      );

      console.log(
        `🎯 Approved image blocks: ${approvedImageBlocks.length}`
      );

      // =====================================
      // FIND PENDING APPROVED IMAGES
      // =====================================

      const pendingImageBlocks =
        approvedImageBlocks.filter(
          (item) =>
            !item.hasImage
        );

      console.log(
        `⏳ Pending approved images: ${pendingImageBlocks.length}`
      );

      // =====================================
      // HARD SAFETY LIMIT
      // =====================================

      const imagesAllowedToGenerate =
        pendingImageBlocks.slice(
          0,
          MAX_IMAGES_PER_TOPIC
        );

      const allowedKeys =
        new Set(
          imagesAllowedToGenerate.map(
            (item) =>
              `${item.sceneIndex}:${item.blockIndex}`
          )
        );

      console.log(
        `🎯 Images allowed to generate: ${imagesAllowedToGenerate.length}/${MAX_IMAGES_PER_TOPIC}`
      );

      // =====================================
      // NO IMAGES REQUIRED
      // =====================================

      if (
        imagesAllowedToGenerate.length ===
        0
      ) {
        console.log(
          "📦 No approved images require generation."
        );

        await db.topic.update({
          where: {
            id: topicId,
          },

          data: {
            generatedScenes:
              scenes,

            currentStage:
              "GENERATING_AUDIO",

            progress: 45,
          },
        });

        await job.updateProgress(
          45
        );

        // =====================================
        // QUEUE AUDIO
        // =====================================

        await audioQueue.add(
          "audio",
          {
            topicId,
          },
          {
            jobId:
              `audio-${topicId}`,

            removeOnComplete: 20,

            removeOnFail: 50,
          }
        );

        console.log(
          "🎤 Audio generation queued."
        );

        return {
          success: true,

          topicId,

          imagesGenerated: 0,

          skippedImageGeneration:
            true,

          nextStage:
            "GENERATING_AUDIO",
        };
      }

      // =====================================
      // UPDATE STATUS
      // =====================================

      await db.topic.update({
        where: {
          id: topicId,
        },

        data: {
          currentStage:
            "GENERATING_IMAGES",

          progress: 35,
        },
      });

      await job.updateProgress(
        35
      );

      console.log(
        `🖼️ Processing ${scenes.length} scenes...`
      );

      // =====================================
      // GENERATE APPROVED IMAGES
      // =====================================

      const updatedScenes = [];

      let generatedImageCount = 0;

      for (
        let sceneIndex = 0;
        sceneIndex < scenes.length;
        sceneIndex++
      ) {
        const scene =
          scenes[sceneIndex];

        if (
          !scene ||
          !Array.isArray(
            scene.blocks
          )
        ) {
          updatedScenes.push(
            scene
          );

          continue;
        }

        // =====================================
        // PROCESS BLOCKS
        // =====================================

        const updatedBlocks = [];

        for (
          let blockIndex = 0;
          blockIndex < scene.blocks.length;
          blockIndex++
        ) {
          const block =
            scene.blocks[blockIndex];

          // =====================================
          // ONLY PROCESS APPROVED IMAGE BLOCKS
          // =====================================

          if (
            block.type !== "image" ||
            block.imageGenerationDecision !==
              "APPROVED"
          ) {
            updatedBlocks.push(
              block
            );

            continue;
          }

          // =====================================
          // IMAGE ALREADY EXISTS
          // =====================================

          if (
            block.imageUrl
          ) {
            updatedBlocks.push(
              block
            );

            continue;
          }

          // =====================================
          // INVALID IMAGE PROMPT
          // =====================================

          if (
            !block.prompt ||
            !block.prompt.trim()
          ) {
            console.warn(
              `⚠️ Scene ${sceneIndex} Block ${blockIndex} has no image prompt.`
            );

            updatedBlocks.push({
              ...block,

              imageError: true,

              imageErrorMessage:
                "Image prompt is missing.",
            });

            continue;
          }

          // =====================================
          // HARD IMAGE LIMIT
          // =====================================

          const blockKey =
            `${sceneIndex}:${blockIndex}`;

          if (
            !allowedKeys.has(
              blockKey
            )
          ) {
            console.log(
              `⏭️ Image limit reached/skipped: Scene ${sceneIndex} Block ${blockIndex}`
            );

            updatedBlocks.push(
              block
            );

            continue;
          }

          if (
            generatedImageCount >=
            MAX_IMAGES_PER_TOPIC
          ) {
            console.log(
              "🛑 Maximum image generation limit reached."
            );

            updatedBlocks.push(
              block
            );

            continue;
          }

          // =====================================
          // GENERATE IMAGE
          // =====================================

          console.log(
            "===================================="
          );

          console.log(
            `🎨 Generating image ${generatedImageCount + 1}/${MAX_IMAGES_PER_TOPIC}`
          );

          console.log(
            `Scene ${sceneIndex} | Block ${blockIndex}`
          );

          try {
            const updatedScene =
              await generateSceneImages({
                topicId,

                scene: {
                  ...scene,

                  blocks: [
                    block,
                  ],
                },

                sceneIndex,
              });

            const generatedBlock =
              updatedScene?.blocks?.[0];

            if (
              generatedBlock?.imageUrl
            ) {
              generatedImageCount++;

              updatedBlocks.push(
                generatedBlock
              );

              console.log(
                `✅ Image ${generatedImageCount}/${MAX_IMAGES_PER_TOPIC} generated successfully.`
              );
            } else {
              updatedBlocks.push(
                generatedBlock ||
                  block
              );

              console.warn(
                "⚠️ Image generation returned without an image URL."
              );
            }
          } catch (error) {
            console.error(
              `❌ Failed image for Scene ${sceneIndex} Block ${blockIndex}`
            );

            console.error(
              error
            );

            updatedBlocks.push({
              ...block,

              imageError: true,

              imageErrorMessage:
                error?.message ||
                "Image generation failed.",
            });
          }

          console.log(
            "===================================="
          );
        }

        // =====================================
        // SAVE UPDATED SCENE
        // =====================================

        updatedScenes.push({
          ...scene,

          blocks:
            updatedBlocks,
        });

        // =====================================
        // UPDATE PROGRESS
        // =====================================

        const progress =
          35 +
          Math.round(
            ((sceneIndex + 1) /
              scenes.length) *
              10
          );

        await job.updateProgress(
          progress
        );
      }

      // =====================================
      // FINAL IMAGE COUNT
      // =====================================

      let finalImageCount = 0;

      updatedScenes.forEach(
        (scene) => {
          if (
            !scene ||
            !Array.isArray(
              scene.blocks
            )
          ) {
            return;
          }

          scene.blocks.forEach(
            (block) => {
              if (
                block &&
                block.type ===
                  "image" &&
                block.imageUrl
              ) {
                finalImageCount++;
              }
            }
          );
        }
      );

      console.log(
        `✅ Image generation complete.`
      );

      console.log(
        `🖼️ Total generated images: ${finalImageCount}`
      );

      // =====================================
      // DEBUG OUTPUT
      // =====================================

      updatedScenes.forEach(
        (
          scene,
          sceneIndex
        ) => {
          if (
            !scene ||
            !Array.isArray(
              scene.blocks
            )
          ) {
            return;
          }

          scene.blocks
            .filter(
              (block) =>
                block &&
                block.type ===
                  "image"
            )
            .forEach(
              (
                block,
                blockIndex
              ) => {
                console.log(
                  `Scene ${sceneIndex} Block ${blockIndex}`
                );

                console.log(
                  "Decision:",
                  block.imageGenerationDecision ||
                    "NONE"
                );

                console.log(
                  "Score:",
                  block.imageDecisionScore ??
                    "NONE"
                );

                console.log(
                  "Image URL:",
                  block.imageUrl ||
                    "NONE"
                );

                console.log(
                  "Image Error:",
                  block.imageError ||
                    false
                );
              }
            );
        }
      );

      // =====================================
      // SAVE UPDATED SCENES
      // =====================================

      await db.topic.update({
        where: {
          id: topicId,
        },

        data: {
          generatedScenes:
            updatedScenes,

          currentStage:
            "GENERATING_AUDIO",

          progress: 45,
        },
      });

      await job.updateProgress(
        45
      );

      console.log(
        "✅ Updated scenes saved."
      );

      // =====================================
      // QUEUE AUDIO
      // =====================================

      await audioQueue.add(
        "audio",
        {
          topicId,
        },
        {
          jobId:
            `audio-${topicId}`,

          removeOnComplete: 20,

          removeOnFail: 50,
        }
      );

      console.log(
        "🎤 Audio generation queued."
      );

      // =====================================
      // RETURN
      // =====================================

      return {
        success: true,

        topicId,

        imagesGenerated:
          finalImageCount,

        nextStage:
          "GENERATING_AUDIO",
      };
    } catch (error) {
      console.error(
        "❌ Image worker failed."
      );

      console.error(
        error
      );

      const { topicId } =
        job.data;

      await db.topic.updateMany({
        where: {
          id: topicId,

          status: {
            not: "COMPLETED",
          },
        },

        data: {
          status: "FAILED",

          currentStage:
            "FAILED",
        },
      });

      throw error;
    }
  },

  {
    connection:
      createRedisConnection(),

    concurrency: 2,

    lockDuration:
      1000 * 60 * 30,

    stalledInterval:
      1000 * 60,

    maxStalledCount: 3,
  }
);

// =====================================
// EVENTS
// =====================================

imageWorker.on(
  "ready",
  () => {
    console.log(
      "✅ Image worker connected to Redis"
    );
  }
);

imageWorker.on(
  "active",
  (job) => {
    console.log(
      `⚙️ Image job active: ${job.id}`
    );
  }
);

imageWorker.on(
  "completed",
  (job) => {
    console.log(
      `🎯 Image job completed: ${job.id}`
    );
  }
);

imageWorker.on(
  "failed",
  (job, err) => {
    console.error(
      `❌ Image job failed: ${job?.id}`
    );

    console.error(
      err
    );
  }
);

imageWorker.on(
  "error",
  (err) => {
    console.error(
      "❌ Image worker connection error:"
    );

    console.error(
      err
    );
  }
);

// =====================================
// SHUTDOWN
// =====================================

process.on(
  "SIGINT",
  async () => {
    console.log(
      "Closing image worker..."
    );

    await imageWorker.close();

    process.exit(0);
  }
);


// import { Worker } from "bullmq";

// import { db } from "../../lib/db.js";
// import { createRedisConnection } from "../../lib/redis.js";

// import { audioQueue } from "../queues/audio.queue.js";
// import { generateSceneImages } from "../services/image/image-generator.service.js";

// // =====================================
// // IMAGE WORKER
// // =====================================

// export const imageWorker = new Worker(
//   "image",

//   async (job) => {
//     const { topicId } = job.data;

//     try {
//       console.log(
//         `🖼️ Image job started for topic ${topicId}`
//       );

//       // =====================================
//       // FETCH TOPIC
//       // =====================================

//       const topic =
//         await db.topic.findUnique({
//           where: {
//             id: topicId,
//           },
//         });

//       if (!topic) {
//         throw new Error(
//           "Topic not found"
//         );
//       }

//       // =====================================
//       // ALREADY COMPLETED
//       // =====================================

//       if (
//         topic.status === "COMPLETED"
//       ) {
//         console.log(
//           "✅ Topic already completed. Skipping image worker."
//         );

//         return {
//           success: true,
//           topicId,
//           skipped: true,
//           reason:
//             "Topic already completed",
//         };
//       }

//       // =====================================
//       // GET SCENES
//       // =====================================

//       const scenes =
//         topic.generatedScenes || [];

//       if (
//         !Array.isArray(scenes) ||
//         scenes.length === 0
//       ) {
//         throw new Error(
//           "No generated scenes found."
//         );
//       }

//       // =====================================
//       // CHECK WHETHER ALL IMAGES
//       // ARE ALREADY GENERATED
//       // =====================================

//       const hasPendingImages =
//         scenes.some((scene) => {
//           const imageBlocks =
//             Array.isArray(scene.blocks)
//               ? scene.blocks.filter(
//                   (block) =>
//                     block.type === "image"
//                 )
//               : [];

//           if (
//             imageBlocks.length === 0
//           ) {
//             return false;
//           }

//           return imageBlocks.some(
//             (block) =>
//               !block.imageUrl
//           );
//         });

//       // =====================================
//       // IMAGES ALREADY COMPLETE
//       // =====================================

//       if (!hasPendingImages) {
//         console.log(
//           "📦 All scene images already exist. Skipping image generation."
//         );

//         // Make sure the pipeline continues
//         if (
//           (topic.progress ?? 0) <
//           45
//         ) {
//           await db.topic.update({
//             where: {
//               id: topicId,
//             },

//             data: {
//               currentStage:
//                 "GENERATING_AUDIO",

//               progress: 45,
//             },
//           });
//         }

//         await job.updateProgress(
//           45
//         );

//         // =====================================
//         // QUEUE AUDIO
//         // =====================================

//         await audioQueue.add(
//           "audio",
//           {
//             topicId,
//           },
//           {
//             jobId:
//               `audio-${topicId}`,

//             removeOnComplete: 20,

//             removeOnFail: 50,
//           }
//         );

//         console.log(
//           "🎤 Audio generation queued."
//         );

//         return {
//           success: true,
//           topicId,

//           skippedImageGeneration:
//             true,

//           nextStage:
//             "GENERATING_AUDIO",
//         };
//       }

//       // =====================================
//       // UPDATE STATUS
//       // =====================================

//       await db.topic.update({
//         where: {
//           id: topicId,
//         },

//         data: {
//           currentStage:
//             "GENERATING_IMAGES",

//           progress: 35,
//         },
//       });

//       await job.updateProgress(
//         35
//       );

//       console.log(
//         `🖼️ Checking images for ${scenes.length} scenes...`
//       );

//       // =====================================
//       // GENERATE MISSING IMAGES
//       // =====================================

//       const updatedScenes = [];

//       for (
//         let sceneIndex = 0;
//         sceneIndex < scenes.length;
//         sceneIndex++
//       ) {
//         const scene =
//           scenes[sceneIndex];

//         const imageBlocks =
//           Array.isArray(scene.blocks)
//             ? scene.blocks.filter(
//                 (block) =>
//                   block.type === "image"
//               )
//             : [];

//         // =====================================
//         // NO IMAGE BLOCKS
//         // =====================================

//         if (
//           imageBlocks.length === 0
//         ) {
//           updatedScenes.push(
//             scene
//           );

//           const progress =
//             35 +
//             Math.round(
//               ((sceneIndex + 1) /
//                 scenes.length) *
//                 10
//             );

//           await job.updateProgress(
//             progress
//           );

//           continue;
//         }

//         // =====================================
//         // CHECK IF SCENE NEEDS IMAGES
//         // =====================================

//         const sceneNeedsImages =
//           imageBlocks.some(
//             (block) =>
//               !block.imageUrl
//           );

//         // =====================================
//         // SCENE ALREADY COMPLETE
//         // =====================================

//         if (!sceneNeedsImages) {
//           console.log(
//             `📦 Scene ${sceneIndex} images already exist. Skipping.`
//           );

//           updatedScenes.push(
//             scene
//           );

//           const progress =
//             35 +
//             Math.round(
//               ((sceneIndex + 1) /
//                 scenes.length) *
//                 10
//             );

//           await job.updateProgress(
//             progress
//           );

//           continue;
//         }

//         // =====================================
//         // GENERATE MISSING IMAGES
//         // =====================================

//         console.log(
//           `🎨 Generating missing images for scene ${sceneIndex}`
//         );

//         const updatedScene =
//           await generateSceneImages({
//             topicId,

//             scene,

//             sceneIndex,
//           });

//         updatedScenes.push(
//           updatedScene
//         );

//         const progress =
//           35 +
//           Math.round(
//             ((sceneIndex + 1) /
//               scenes.length) *
//               10
//           );

//         await job.updateProgress(
//           progress
//         );
//       }

//       console.log(
//         "✅ Image generation/check complete."
//       );

//       // =====================================
//       // DEBUG OUTPUT
//       // =====================================

//       updatedScenes.forEach(
//         (
//           scene,
//           sceneIndex
//         ) => {
//           scene.blocks
//             ?.filter(
//               (block) =>
//                 block.type === "image"
//             )
//             .forEach(
//               (
//                 block,
//                 blockIndex
//               ) => {
//                 console.log(
//                   `Scene ${sceneIndex} Block ${blockIndex}`
//                 );

//                 console.log(
//                   "Image URL:",
//                   block.imageUrl ||
//                     "NONE"
//                 );

//                 console.log(
//                   "Image Error:",
//                   block.imageError ||
//                     false
//                 );
//               }
//             );
//         }
//       );

//       // =====================================
//       // SAVE UPDATED SCENES
//       // =====================================

//       await db.topic.update({
//         where: {
//           id: topicId,
//         },

//         data: {
//           generatedScenes:
//             updatedScenes,

//           currentStage:
//             "GENERATING_AUDIO",

//           progress: 45,
//         },
//       });

//       await job.updateProgress(
//         45
//       );

//       console.log(
//         "✅ Updated scenes saved."
//       );

//       // =====================================
//       // QUEUE AUDIO
//       // =====================================

//       await audioQueue.add(
//         "audio",
//         {
//           topicId,
//         },
//         {
//           jobId:
//             `audio-${topicId}`,
//           removeOnComplete: 20,
//           removeOnFail: 50,
//         }
//       );

//       console.log(
//         "🎤 Audio generation queued."
//       );

//       // =====================================
//       // RETURN
//       // =====================================

//       return {
//         success: true,

//         topicId,

//         nextStage:
//           "GENERATING_AUDIO",
//       };

//     } catch (error) {
//       console.error(
//         "❌ Image worker failed."
//       );

//       console.error(error);

//       // =====================================
//       // MARK FAILED
//       // =====================================

//       await db.topic.updateMany({
//         where: {
//           id: topicId,

//           status: {
//             not: "COMPLETED",
//           },
//         },

//         data: {
//           status: "FAILED",

//           currentStage:
//             "FAILED",
//         },
//       });

//       throw error;
//     }
//   },

//   {
//     connection:
//       createRedisConnection(),

//     concurrency: 2,

//     lockDuration:
//       1000 * 60 * 30,

//     stalledInterval:
//       1000 * 60,

//     maxStalledCount: 3,
//   }
// );

// // =====================================
// // EVENTS
// // =====================================

// imageWorker.on(
//   "ready",
//   () => {
//     console.log(
//       "✅ Image worker connected to Redis"
//     );
//   }
// );

// imageWorker.on(
//   "active",
//   (job) => {
//     console.log(
//       `⚙️ Image job active: ${job.id}`
//     );
//   }
// );

// imageWorker.on(
//   "completed",
//   (job) => {
//     console.log(
//       `🎯 Image job completed: ${job.id}`
//     );
//   }
// );

// imageWorker.on(
//   "failed",
//   (job, err) => {
//     console.error(
//       `❌ Image job failed: ${job?.id}`
//     );

//     console.error(err);
//   }
// );

// imageWorker.on(
//   "error",
//   (err) => {
//     console.error(
//       "❌ Image worker connection error:"
//     );

//     console.error(err);
//   }
// );

// // =====================================
// // SHUTDOWN
// // =====================================

// process.on(
//   "SIGINT",
//   async () => {
//     console.log(
//       "Closing image worker..."
//     );

//     await imageWorker.close();

//     process.exit(0);
//   }
// );