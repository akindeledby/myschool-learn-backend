import React from "react";

import { renderBlock } from "../layout/renderBlock.js";
import { getGap } from "../layout/helpers.js";

// ============================================
// TWO COLUMN LAYOUT
// ============================================

export function TwoColumnLayout({
  visuals = [],
  texts = [],
  theme,
}) {
  const gap = getGap(
    visuals.length + texts.length
  );

  const leftVisuals = visuals.filter(
    (_, index) => index % 2 === 0
  );

  const rightVisuals = visuals.filter(
    (_, index) => index % 2 === 1
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        gap,
        padding: "50px 70px",
        boxSizing: "border-box",
      }}
    >
      {/* LEFT COLUMN */}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap,
          minHeight: 0,
        }}
      >
        {leftVisuals.map((block, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {renderBlock(
              block,
              index,
              "two-column",
              theme
            )}
          </div>
        ))}
      </div>

      {/* RIGHT COLUMN */}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap,
          minHeight: 0,
        }}
      >
        {texts.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              flexShrink: 0,
            }}
          >
            {texts.map((block, index) =>
              renderBlock(
                block,
                index,
                "two-column",
                theme
              )
            )}
          </div>
        )}

        {rightVisuals.map((block, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {renderBlock(
              block,
              index + texts.length,
              "two-column",
              theme
            )}
          </div>
        ))}
      </div>
    </div>
  );
}