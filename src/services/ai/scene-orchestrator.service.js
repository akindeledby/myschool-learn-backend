import { createSceneGenerationCache } from "./scene-cache.service.js";
import { generateSceneContent } from "./scene-generator.service.js";

function sleep(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

export async function generateAllScenes({
  lesson,
  subject,
  topic,
  classLevel,
  lessonContents,
}) {
  const scenes = lesson?.scenes || [];

  if (!scenes.length) {
    throw new Error(
      "No scenes found in lesson plan."
    );
  }

  // ============================================================
  // CREATE ONE CACHE FOR THE ENTIRE LESSON
  // ============================================================

  console.log(
    "🧠 Creating Gemini scene generation cache..."
  );

  const cache =
    await createSceneGenerationCache({
      subject,
      topic,
      classLevel,
      lessonContents,
      lessonPlan: lesson,
    });

  if (!cache?.name) {
    throw new Error(
      "Failed to create Gemini scene generation cache."
    );
  }

  console.log(
    `✅ Scene generation cache created: ${cache.name}`
  );

  // ============================================================
  // GENERATE SCENES SEQUENTIALLY
  // ============================================================

  const allScenes = [];

  let previousSceneTitle = null;
  let previousNarration = null;

  for (
    let sceneIndex = 0;
    sceneIndex < scenes.length;
    sceneIndex++
  ) {
    const scene = scenes[sceneIndex];

    console.log(
      `🎬 Generating scene ${
        sceneIndex + 1
      }/${scenes.length}`
    );

    try {
      const generatedScene =
        await generateSceneContent({
          cacheName: cache.name,
          scene,
          sceneIndex,
          totalScenes:
            scenes.length,
          previousSceneTitle,
          previousNarration,
          targetSeconds: 90,
        });

      // ========================================================
      // VALIDATE GENERATED SCENE
      // ========================================================

      if (!generatedScene) {
        throw new Error(
          `Scene ${
            sceneIndex + 1
          } returned no data.`
        );
      }

      if (
        !generatedScene.title ||
        !generatedScene.narration ||
        !Array.isArray(
          generatedScene.blocks
        )
      ) {
        throw new Error(
          `Scene ${
            sceneIndex + 1
          } returned an invalid structure.`
        );
      }

      // ========================================================
      // SAVE TO MEMORY
      // ========================================================

      allScenes.push(
        generatedScene
      );

      // ========================================================
      // UPDATE PREVIOUS SCENE CONTEXT
      // ========================================================

      previousSceneTitle =
        generatedScene.title;

      previousNarration =
        generatedScene.narration;

      console.log(
        `✅ Scene ${
          sceneIndex + 1
        }/${scenes.length} generated successfully.`
      );

    } catch (error) {
      console.error(
        `❌ Scene ${
          sceneIndex + 1
        }/${scenes.length} generation failed:`,
        error
      );

      throw new Error(
        `Failed to generate scene ${
          sceneIndex + 1
        }: ${error.message}`
      );
    }

    // ============================================================
    // THROTTLE BETWEEN SCENES
    // ============================================================

    if (
      sceneIndex <
      scenes.length - 1
    ) {
      await sleep(5000);
    }
  }

  // ============================================================
  // COMPLETE
  // ============================================================

  console.log(
    `🎉 All ${allScenes.length} scenes generated successfully.`
  );

  return allScenes;
}
