import React from "react";

import { renderBlock } from "../layout/renderBlock.js";

// ============================================
// TEXT ONLY LAYOUT
// ============================================

export function TextOnlyLayout({
  texts = [],
  theme,
  layout,
}) {
  const textCount =
    layout?.textCount ?? texts.length;

  const totalWords =
    layout?.totalWords ??
    texts.reduce((sum, block) => {
      const text =
        block.content ??
        block.text ??
        "";

      return (
        sum +
        text
          .trim()
          .split(/\s+/)
          .filter(Boolean).length
      );
    }, 0);

  //--------------------------------------------------
  // Adaptive spacing
  //--------------------------------------------------

  let paddingY = 60;
  let paddingX = 120;
  let gap = 36;

  if (textCount >= 3) {
    paddingY = 50;
    gap = 28;
  }

  if (textCount >= 4) {
    paddingY = 40;
    gap = 22;
  }

  if (totalWords > 80) {
    paddingY = 30;
    gap = 18;
  }

  if (totalWords > 120) {
    paddingY = 24;
    paddingX = 90;
    gap = 14;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",

        display: "flex",
        flexDirection: "column",

        justifyContent: "center",
        alignItems: "center",

        padding: `${paddingY}px ${paddingX}px`,
        gap,

        boxSizing: "border-box",
      }}
    >
      {texts.map((block, index) => (
        <div
          key={index}
          style={{
            width: "100%",

            display: "flex",

            justifyContent: "center",

            alignItems: "center",
          }}
        >
          {renderBlock(
            block,
            index,
            layout,
            theme
          )}
        </div>
      ))}
    </div>
  );
}