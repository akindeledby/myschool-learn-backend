const DEFAULT_MAX_IMAGES_PER_TOPIC = 2;

const VISUAL_KEYWORDS = [
  "introduction",
  "diagram",
  "structure",
  "process",
  "cycle",
  "system",
  "parts of",
  "human body",
  "plant",
  "animal",
  "map",
  "geography",
  "experiment",
  "laboratory",
  "machine",
  "device",
  "tool",
  "mathematics",
  "geometry",
  "shape",
  "graph",
  "chart",
  "fraction",
  "angle",
  "equation",
  "formula",
  "timeline",
  "historical event",
  "architecture",
  "cell",
  "organ",
  "ecosystem",
  "food chain",
  "water cycle",
  "life cycle",
  "solar system",
  "planet",
  "earth",
  "chemical",
  "atom",
  "molecule",
];

const LOW_VALUE_KEYWORDS = [
  "welcome",
  "conclusion",
  "summary",
  "revision",
  "recap",
  "definition",
  "discussion",
  "question",
  "exercise",
  "practice",
];

function getSceneText(scene) {
  if (!scene || !Array.isArray(scene.blocks)) {
    return "";
  }

  return scene.blocks
    .filter(
      (block) =>
        block &&
        block.type === "text"
    )
    .map((block) => block.text || "")
    .join(" ")
    .toLowerCase();
}

function getImagePrompt(scene) {
  if (!scene || !Array.isArray(scene.blocks)) {
    return "";
  }

  return scene.blocks
    .filter(
      (block) =>
        block &&
        block.type === "image" &&
        typeof block.prompt === "string" &&
        block.prompt.trim()
    )
    .map((block) => block.prompt)
    .join(" ")
    .toLowerCase();
}

function calculateVisualScore(scene) {
  const text = getSceneText(scene);
  const prompt = getImagePrompt(scene);

  const combinedText =
    `${text} ${prompt}`.toLowerCase();

  let score = 0;

  for (const keyword of VISUAL_KEYWORDS) {
    if (combinedText.includes(keyword)) {
      score += 3;
    }
  }

  for (const keyword of LOW_VALUE_KEYWORDS) {
    if (combinedText.includes(keyword)) {
      score -= 2;
    }
  }

  if (prompt.trim()) {
    score += 2;
  }

  return score;
}

export function decideSceneImages({
  scenes,
  maxImages = DEFAULT_MAX_IMAGES_PER_TOPIC,
}) {
  if (
    !Array.isArray(scenes) ||
    scenes.length === 0
  ) {
    return {
      scenes: [],
      selectedImages: 0,
    };
  }

  const safeMaxImages = Math.max(
    0,
    Math.min(
      Number(maxImages) || DEFAULT_MAX_IMAGES_PER_TOPIC,
      DEFAULT_MAX_IMAGES_PER_TOPIC
    )
  );

  const candidates = [];

  scenes.forEach(
    (scene, sceneIndex) => {
      if (
        !scene ||
        !Array.isArray(scene.blocks)
      ) {
        return;
      }

      scene.blocks.forEach(
        (block, blockIndex) => {
          if (
            !block ||
            block.type !== "image"
          ) {
            return;
          }

          if (
            typeof block.prompt !==
              "string" ||
            !block.prompt.trim()
          ) {
            return;
          }

          const score =
            calculateVisualScore(scene);

          candidates.push({
            sceneIndex,
            blockIndex,
            score,
          });
        }
      );
    }
  );

  candidates.sort(
    (a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (
        a.sceneIndex !==
        b.sceneIndex
      ) {
        return (
          a.sceneIndex -
          b.sceneIndex
        );
      }

      return (
        a.blockIndex -
        b.blockIndex
      );
    }
  );

  const selected =
    candidates.slice(
      0,
      safeMaxImages
    );

  const selectedKeys =
    new Set(
      selected.map(
        (item) =>
          `${item.sceneIndex}:${item.blockIndex}`
      )
    );

  const selectedScoreMap =
    new Map(
      selected.map(
        (item) => [
          `${item.sceneIndex}:${item.blockIndex}`,
          item.score,
        ]
      )
    );

  const updatedScenes =
    scenes.map(
      (scene, sceneIndex) => {
        if (
          !scene ||
          !Array.isArray(
            scene.blocks
          )
        ) {
          return scene;
        }

        return {
          ...scene,

          blocks:
            scene.blocks.map(
              (
                block,
                blockIndex
              ) => {
                if (
                  !block ||
                  block.type !==
                    "image"
                ) {
                  return block;
                }

                const key =
                  `${sceneIndex}:${blockIndex}`;

                if (
                  selectedKeys.has(
                    key
                  )
                ) {
                  return {
                    ...block,

                    imageGenerationDecision:
                      "APPROVED",

                    imageDecisionScore:
                      selectedScoreMap.get(
                        key
                      ) ?? 0,
                  };
                }

                return {
                  ...block,

                  imageGenerationDecision:
                    "SKIPPED",

                  imageDecisionScore:
                    calculateVisualScore(
                      scene
                    ),
                };
              }
            ),
        };
      }
    );

  console.log(
    `🧠 Image decision: ${candidates.length} candidate(s), ${selected.length} approved.`
  );

  selected.forEach(
    (item) => {
      console.log(
        `✅ Approved image: Scene ${item.sceneIndex}, Block ${item.blockIndex}, Score ${item.score}`
      );
    }
  );

  candidates
    .filter(
      (item) =>
        !selectedKeys.has(
          `${item.sceneIndex}:${item.blockIndex}`
        )
    )
    .forEach(
      (item) => {
        console.log(
          `⏭️ Skipped image: Scene ${item.sceneIndex}, Block ${item.blockIndex}, Score ${item.score}`
        );
      }
    );

  return {
    scenes: updatedScenes,

    selectedImages:
      selected.length,

    candidates:
      candidates.length,
  };
}