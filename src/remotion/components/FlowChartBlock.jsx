import React from "react";

const WIDTH = {
  hero: 1100,
  "single-visual": 850,
  "two-column": 650,
  "grid-2x2": 420,
  gallery: 320,
};

const FONT = {
  hero: 42,
  "single-visual": 34,
  "two-column": 28,
  "grid-2x2": 22,
  gallery: 18,
};

const BOX_WIDTH = {
  hero: 420,
  "single-visual": 340,
  "two-column": 280,
  "grid-2x2": 220,
  gallery: 180,
};

const BOX_HEIGHT = {
  hero: 90,
  "single-visual": 78,
  "two-column": 66,
  "grid-2x2": 58,
  gallery: 48,
};

export const FlowChartBlock = ({
  title,
  nodes,
  layout = "single-visual",
}) => {
  const width =
    WIDTH[layout] ??
    WIDTH["single-visual"];

  const fontSize =
    FONT[layout] ??
    FONT["single-visual"];

  const boxWidth =
    BOX_WIDTH[layout] ??
    BOX_WIDTH["single-visual"];

  const boxHeight =
    BOX_HEIGHT[layout] ??
    BOX_HEIGHT["single-visual"];

  // ------------------------------------
  // Normalize nodes
  // ------------------------------------

  let safeNodes = [];

  if (Array.isArray(nodes)) {
    safeNodes = nodes.map((node, index) => {
      if (typeof node === "string") {
        return {
          id: index,
          text: node,
        };
      }

      return {
        id: node?.id ?? index,
        text:
          node?.text ??
          node?.label ??
          node?.title ??
          "",
      };
    });
  } else if (typeof nodes === "string") {
    safeNodes = nodes
      .split(",")
      .map((text, index) => ({
        id: index,
        text: text.trim(),
      }));
  }

  return (
    <div
      style={{
        width,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {title && (
        <div
          style={{
            fontSize: fontSize + 6,
            fontWeight: 700,
            marginBottom: 35,
            textAlign: "center",
          }}
        >
          {title}
        </div>
      )}

      {safeNodes.map((node, index) => (
        <React.Fragment key={node.id}>
          <div
            style={{
              width: boxWidth,
              minHeight: boxHeight,

              border: "4px solid #111827",
              borderRadius: 16,

              display: "flex",
              justifyContent: "center",
              alignItems: "center",

              textAlign: "center",

              padding: 18,

              fontSize,
              fontWeight: 600,

              backgroundColor: "#ffffff",

              wordBreak: "break-word",
            }}
          >
            {node.text}
          </div>

          {index < safeNodes.length - 1 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                margin: "10px 0",
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 40,
                  backgroundColor: "#111827",
                }}
              />

              <div
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "8px solid transparent",
                  borderRight: "8px solid transparent",
                  borderTop: "14px solid #111827",
                }}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};