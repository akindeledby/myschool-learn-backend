import { renderSceneToExcalidraw } from "./excalidraw-renderer.service.js";
import { buildRemotionScene } from "./remotion-renderer.service.js";

export function buildVideoProject({
  lesson,
  scenesWithNarration,
}) {
  const scenes = scenesWithNarration.map((sceneData, index) => {
    const excalidrawElements =
      renderSceneToExcalidraw({
        visualInstructions:
          sceneData.visualInstructions,
      });

    return buildRemotionScene({
      scene: sceneData.scene,
      excalidrawElements,
      narration: sceneData.narration,
      durationInFrames: sceneData.durationInFrames || 180,
    });
  });

  const totalDuration = scenes.reduce(
    (sum, s) => sum + s.durationInFrames,
    0
  );

  return {
    lessonId: lesson?.id || null,

    title: lesson?.title || "Untitled Lesson",

    scenes,

    metadata: {
      sceneCount: scenes.length,
      totalDurationInFrames: totalDuration,
      fps: 30,
    },

    renderConfig: {
      width: 1280,
      height: 720,
      format: "mp4",
    },
  };
}