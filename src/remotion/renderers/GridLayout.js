import React from "react";

import { renderBlock } from "../layout/renderBlock.js";

import {
  getGridColumns,
  getGap,
} from "../layout/helpers.js";

// ============================================
// GRID LAYOUT
// ============================================

export function GridLayout({
  visuals = [],
  texts = [],
  layout,
  theme,
}) {
  const columns = getGridColumns(
    visuals.length
  );

  const gap = getGap(
    visuals.length + texts.length
  );

  const totalWords =
    layout?.totalWords ?? 0;

  const textCount =
    layout?.textCount ?? texts.length;

  let textFlex = 1;
  let gridFlex = 3;

  if (
    textCount >= 3 ||
    totalWords > 60
  ) {
    textFlex = 1.4;
    gridFlex = 2.6;
  }

  if (
    textCount >= 4 ||
    totalWords > 90
  ) {
    textFlex = 1.8;
    gridFlex = 2.2;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "40px 60px",
        boxSizing: "border-box",
        gap,
      }}
    >
      {texts.length > 0 && (
        <div
          style={{
            flex: textFlex,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: gap * 0.5,
          }}
        >
          {texts.map((block, index) =>
            renderBlock(
              block,
              index,
              "grid-2x2",
              theme,
              layout
            )
          )}
        </div>
      )}

      <div
        style={{
          flex: gridFlex,
          minHeight: 0,
          width: "100%",
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          justifyItems: "center",
          alignItems: "center",
          gap,
        }}
      >
        {visuals.map((block, index) => (
          <div
            key={index}
            style={{
              width: "100%",
              height: "100%",
              minHeight: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {renderBlock(
              block,
              index,
              "grid-2x2",
              theme,
              layout
            )}
          </div>
        ))}
      </div>
    </div>
  );
}