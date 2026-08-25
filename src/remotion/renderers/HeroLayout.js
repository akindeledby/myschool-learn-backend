import React from "react";

import { renderBlock } from "../layout/renderBlock.js";

// ============================================
// HERO LAYOUT
// ============================================

export function HeroLayout({
  visuals = [],
  texts = [],
  layout,
  theme,
}) {
  const hero = visuals[0] ?? null;

  const totalWords =
    layout?.totalWords ?? 0;

  const textCount =
    layout?.textCount ?? texts.length;

  let visualFlex = 2.2;
  let textFlex = 1.8;

  // ------------------------------------------
  // Adaptive sizing
  // ------------------------------------------

  if (
    textCount >= 3 ||
    totalWords > 60
  ) {
    visualFlex = 2;
    textFlex = 2;
  }

  if (
    textCount >= 4 ||
    totalWords > 90
  ) {
    visualFlex = 1.7;
    textFlex = 2.3;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        // padding: "50px 70px",
        padding: "25px 40px",
        gap: 35,
        boxSizing: "border-box",
      }}
    >
      {hero && (
        <div
          style={{
            flex: visualFlex,
            minHeight: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {renderBlock(
            hero,
            0,
            "hero",
            theme,
            layout
          )}
        </div>
      )}

      {texts.length > 0 && (
        <div
          style={{
            flex: textFlex,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 35,
          }}
        >
          {texts.map((block, index) =>
            renderBlock(
              block,
              index,
              "hero",
              theme,
              layout
            )
          )}
        </div>
      )}
    </div>
  );
}