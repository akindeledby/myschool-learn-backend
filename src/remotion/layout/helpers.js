import {
  BLOCK_WEIGHT,
  VISUAL_BLOCKS,
  TEXT_BLOCKS,
} from "./constants.js";

// ============================================
// TYPE HELPERS
// ============================================

export function isVisualBlock(block) {
  return (
    block &&
    VISUAL_BLOCKS.includes(block.type)
  );
}

export function isTextBlock(block) {
  return (
    block &&
    TEXT_BLOCKS.includes(block.type)
  );
}

// ============================================
// FILTER HELPERS
// ============================================

export function getVisualBlocks(
  blocks = []
) {
  return blocks.filter(
    isVisualBlock
  );
}

export function getTextBlocks(
  blocks = []
) {
  return blocks.filter(
    isTextBlock
  );
}

export function getOtherBlocks(
  blocks = []
) {
  return blocks.filter(
    (block) =>
      !isVisualBlock(block) &&
      !isTextBlock(block)
  );
}

// ============================================
// WEIGHTS
// ============================================

export function getBlockWeight(
  block
) {
  if (!block) return 0;

  return (
    BLOCK_WEIGHT[
      block.type
    ] ?? 1
  );
}

export function getVisualWeight(
  visuals = []
) {
  return visuals.reduce(
    (sum, block) =>
      sum +
      getBlockWeight(
        block
      ),
    0
  );
}

// ============================================
// GROUP BLOCKS
// ============================================

export function groupBlocks(
  blocks = []
) {
  return {
    visuals:
      getVisualBlocks(
        blocks
      ),

    texts:
      getTextBlocks(
        blocks
      ),

    others:
      getOtherBlocks(
        blocks
      ),
  };
}

// ============================================
// TEXT HELPERS
// ============================================

export function hasLongText(
  texts = []
) {
  const characters =
    texts.reduce(
      (
        total,
        block
      ) =>
        total +
        (
          block.content ||
          block.text ||
          ""
        ).length,
      0
    );

  return (
    characters > 220
  );
}

export function estimateTextLines(
  texts = []
) {
  const characters =
    texts.reduce(
      (
        total,
        block
      ) =>
        total +
        (
          block.content ||
          block.text ||
          ""
        ).length,
      0
    );

  return Math.ceil(
    characters / 40
  );
}

// ============================================
// VISUAL HELPERS
// ============================================

export function hasLargeVisual(
  visuals = []
) {
  return (
    getVisualWeight(
      visuals
    ) >= 6
  );
}

export function hasImages(
  visuals = []
) {
  return visuals.some(
    (block) =>
      block.type ===
      "image"
  );
}

export function imageCount(
  visuals = []
) {
  return visuals.filter(
    (block) =>
      block.type ===
      "image"
  ).length;
}

// ============================================
// QUESTIONS
// ============================================

export function hasQuestion(
  blocks = []
) {
  return blocks.some(
    (block) =>
      block.type ===
      "question"
  );
}

// ============================================
// CLOCKS
// ============================================

export function hasClock(
  blocks = []
) {
  return blocks.some(
    (block) =>
      block.type ===
      "clock"
  );
}

// ============================================
// TITLES
// ============================================

export function getSceneTitle(
  texts = []
) {
  const first =
    texts[0];

  if (!first)
    return "";

  return (
    first.content ||
    first.text ||
    ""
  );
}

// ============================================
// LAYOUT SIZE
// ============================================

export function getScaleFactor(
  blockCount
) {
  if (blockCount <= 2)
    return 1;

  if (blockCount <= 4)
    return 0.92;

  if (blockCount <= 6)
    return 0.82;

  if (blockCount <= 8)
    return 0.72;

  return 0.62;
}

// ============================================
// GAP
// ============================================

export function getGap(
  blockCount
) {
  if (blockCount <= 2)
    return 40;

  if (blockCount <= 4)
    return 30;

  if (blockCount <= 6)
    return 24;

  return 18;
}

// ============================================
// GRID COLUMNS
// ============================================

export function getGridColumns(
  count
) {
  if (count <= 1)
    return 1;

  if (count <= 4)
    return 2;

  if (count <= 9)
    return 3;

  return 4;
}

// ============================================
// GRID ROWS
// ============================================

export function getGridRows(
  count,
  columns
) {
  return Math.ceil(
    count / columns
  );
}