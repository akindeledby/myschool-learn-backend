import { LayoutType } from "./layoutTypes.js";

import {
  groupBlocks,
  getVisualWeight,
} from "./helpers.js";

// ============================================
// BUILD SCENE LAYOUT
// ============================================

export function buildSceneLayout(
  blocks = []
) {
  const {
    visuals,
    texts,
    others,
  } = groupBlocks(blocks);

  // ==========================================
  // VISUAL METRICS
  // ==========================================

  const visualCount =
    visuals.length;

  const visualWeight =
    getVisualWeight(
      visuals
    );

  // ==========================================
  // TEXT METRICS
  // ==========================================

  const textCount =
    texts.length;

  const totalWords =
    texts.reduce(
      (sum, block) => {
        const text =
          block.content ??
          block.text ??
          "";

        return (
          sum +
          text
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .length
        );
      },
      0
    );

  const averageWords =
    textCount > 0
      ? Math.round(
          totalWords /
            textCount
        )
      : 0;

  // ==========================================
  // ESTIMATED CONTENT DENSITY
  // ==========================================

  // Approximate amount of vertical space
  // likely required for text.

  const estimatedTextHeight =
    totalWords * 2.8;

  // Approximate amount of space required
  // for visuals.

  const estimatedVisualHeight =
    visualWeight * 120;

  // Overall scene complexity.

  const contentDensity =
    estimatedTextHeight +
    estimatedVisualHeight;

  // ==========================================
  // COMMON RETURN VALUES
  // ==========================================

  const common = {
    texts,
    visuals,
    others,

    blockCount:
      blocks.length,

    textCount,

    totalWords,

    averageWords,

    visualCount,

    visualWeight,

    estimatedTextHeight,

    estimatedVisualHeight,

    contentDensity,
  };

  //----------------------------------------------------
  // TEXT ONLY
  //----------------------------------------------------

  if (visualCount === 0) {
    return {
      ...common,
      type:
        LayoutType.TEXT_ONLY,
      visuals: [],
    };
  }

  //----------------------------------------------------
  // SINGLE VISUAL
  //----------------------------------------------------

  if (visualCount === 1) {
    return {
      ...common,
      type:
        LayoutType.SINGLE_VISUAL,
    };
  }

  //----------------------------------------------------
  // TWO LARGE VISUALS
  //----------------------------------------------------

  if (
    visualCount === 2 &&
    visualWeight >= 5
  ) {
    return {
      ...common,
      type:
        LayoutType.TWO_COLUMN,
    };
  }

  //----------------------------------------------------
  // MEDIUM GRID
  //----------------------------------------------------

  if (
    visualWeight <= 8
  ) {
    return {
      ...common,
      type:
        LayoutType.GRID_2X2,
    };
  }

  //----------------------------------------------------
  // LARGE GALLERY
  //----------------------------------------------------

  return {
    ...common,
    type:
      LayoutType.GALLERY,
  };
}

