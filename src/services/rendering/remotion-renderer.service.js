export function buildRemotionScene({
  scene,
  narration,
  blocks = [],
  audioUrl,
  durationInFrames = 150,
  fps = 30,
}) {
  const normalizedBlocks = blocks.map((block) => {
    if (block.type !== "image") {
      return block;
    }

    return {
      ...block,
      imagePath:
        block.imageUrl ||
        block.imagePath ||
        null,

      imageError:
        block.imageError || false,
    };
  });

  return {
    sceneId: scene.id ?? scene.sceneId ?? null,

    durationInFrames,

    fps,

    narration,

    audioUrl,

    backgroundImage:
      scene.backgroundImage || null,

    blocks: normalizedBlocks,
  };
}
