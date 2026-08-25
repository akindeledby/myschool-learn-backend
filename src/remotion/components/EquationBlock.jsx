import React from "react";

// =====================================
// FONT SIZES
// =====================================

const FONT_SIZE = {
  hero: 82,

  "single-visual": 70,

  "two-column": 56,

  "grid-2x2": 44,

  gallery: 34,

  default: 60,
};

// =====================================
// EQUATION BLOCK
// =====================================

export const EquationBlock = ({
  equation,
  explanation,
  layout = "single-visual",
}) => {
  const fontSize =
    FONT_SIZE[layout] ??
    FONT_SIZE.default;

  if (!equation) {
    return null;
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",

        display: "flex",
        flexDirection: "column",

        justifyContent: "center",
        alignItems: "center",

        padding: "0 20px",

        boxSizing: "border-box",
      }}
    >
      {/* Equation */}

      <div
        style={{
          width: "100%",

          fontSize,

          fontWeight: 700,

          color: "#111827",

          textAlign: "center",

          lineHeight: 1.25,

          wordBreak: "break-word",

          overflowWrap: "break-word",

          whiteSpace: "normal",
        }}
      >
        {equation}
      </div>

      {/* Explanation */}

      {explanation && (
        <div
          style={{
            marginTop:
              fontSize * 0.45,

            width: "100%",

            maxWidth:
              fontSize * 18,

            fontSize:
              fontSize * 0.45,

            color: "#4b5563",

            textAlign: "center",

            lineHeight: 1.45,

            wordBreak: "break-word",

            overflowWrap: "break-word",

            whiteSpace: "normal",
          }}
        >
          {explanation}
        </div>
      )}
    </div>
  );
};