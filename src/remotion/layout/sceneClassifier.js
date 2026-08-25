import {
  hasQuestion,
  hasClock,
  hasImages,
  hasLongText,
  getVisualBlocks,
  getTextBlocks,
} from "./helpers.js";

// ============================================
// SCENE TYPES
// ============================================

export const SceneType = {
  INTRODUCTION: "introduction",

  EXPLANATION: "explanation",

  VISUAL_EXPLANATION:
    "visual-explanation",

  WORKED_EXAMPLE:
    "worked-example",

  PRACTICE: "practice",

  SUMMARY: "summary",

  RECAP: "recap",

  TEXT_ONLY: "text-only",

  MIXED: "mixed",
};

// ============================================
// KEYWORD HELPERS
// ============================================

function contains(
  text = "",
  keywords = []
) {
  const lower =
    text.toLowerCase();

  return keywords.some(
    (word) =>
      lower.includes(
        word
      )
  );
}

// ============================================
// CLASSIFIER
// ============================================

export function classifyScene(
  scene = {}
) {
  const blocks =
    scene.blocks ?? [];

  const visuals =
    getVisualBlocks(
      blocks
    );

  const texts =
    getTextBlocks(
      blocks
    );

  const narration =
    (
      scene.narration ??
      ""
    ).toLowerCase();

  const title =
    (
      texts[0]?.content ??
      texts[0]?.text ??
      ""
    ).toLowerCase();

  const searchable =
    `${scene.title ?? ""} ${title} ${narration}`;

  //----------------------------------------------------
  // INTRODUCTION
  //----------------------------------------------------

  if (
    contains(
      searchable,
      [
        "welcome",

        "today",

        "let's learn",

        "our lesson",

        "introduction",

        "hello",
      ]
    )
  ) {
    return SceneType.INTRODUCTION;
  }

  //----------------------------------------------------
  // PRACTICE
  //----------------------------------------------------

  if (
    hasQuestion(
      blocks
    )
  ) {
    return SceneType.PRACTICE;
  }

  //----------------------------------------------------
  // SUMMARY / RECAP
  //----------------------------------------------------

  if (
    contains(
      searchable,
      [
        "summary",

        "recap",

        "remember",

        "revision",

        "finally",

        "conclusion",

        "keep practicing",
      ]
    )
  ) {
    return SceneType.RECAP;
  }

  //----------------------------------------------------
  // WORKED EXAMPLE
  //----------------------------------------------------

  if (
    hasClock(
      blocks
    ) ||
    visuals.some(
      (v) =>
        [
          "equation",

          "fraction",

          "chart",
        ].includes(
          v.type
        )
    )
  ) {
    return SceneType.WORKED_EXAMPLE;
  }

  //----------------------------------------------------
  // VISUAL EXPLANATION
  //----------------------------------------------------

  if (
    hasImages(
      visuals
    )
  ) {
    return SceneType.VISUAL_EXPLANATION;
  }

  //----------------------------------------------------
  // LONG EXPLANATION
  //----------------------------------------------------

  if (
    hasLongText(
      texts
    )
  ) {
    return SceneType.EXPLANATION;
  }

  //----------------------------------------------------
  // TEXT ONLY
  //----------------------------------------------------

  if (
    visuals.length ===
    0
  ) {
    return SceneType.TEXT_ONLY;
  }

  //----------------------------------------------------
  // DEFAULT
  //----------------------------------------------------

  return SceneType.MIXED;
}