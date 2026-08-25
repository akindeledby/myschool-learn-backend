import React from "react";

// =====================================
// FRACTION SIZES
// =====================================

const FRACTION_SIZE = {
  hero: 90,

  "single-visual": 74,

  "two-column": 58,

  "grid-2x2": 44,

  gallery: 34,

  default: 60,
};

// =====================================
// FRACTION BLOCK
// =====================================

export const FractionBlock = ({
  numerator,
  denominator,
  label,
  layout = "single-visual",
}) => {
  const fontSize =
    FRACTION_SIZE[layout] ??
    FRACTION_SIZE.default;

  const longest =
    Math.max(
      String(numerator ?? "").length,
      String(denominator ?? "").length
    );

  const lineWidth = Math.max(
    fontSize * 1.7,
    longest * fontSize * 0.55
  );

  const lineThickness = Math.max(
    3,
    fontSize * 0.07
  );

  const spacing =
    fontSize * 0.15;

  const labelSize =
    fontSize * 0.45;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",

        justifyContent: "center",
        alignItems: "center",

        width: "100%",
        maxWidth: fontSize * 5,
      }}
    >
      {/* Fraction */}

      <div
        style={{
          display: "flex",
          flexDirection: "column",

          alignItems: "center",

          width: "100%",
        }}
      >
        {/* Numerator */}

        <div
          style={{
            width: "100%",

            fontSize,

            fontWeight: "bold",

            color: "#111827",

            lineHeight: 1,

            textAlign: "center",

            wordBreak: "break-word",
          }}
        >
          {numerator}
        </div>

        {/* Fraction Line */}

        <div
          style={{
            width: lineWidth,

            borderTop: `${lineThickness}px solid #111827`,

            margin: `${spacing}px 0`,
          }}
        />

        {/* Denominator */}

        <div
          style={{
            width: "100%",

            fontSize,

            fontWeight: "bold",

            color: "#111827",

            lineHeight: 1,

            textAlign: "center",

            wordBreak: "break-word",
          }}
        >
          {denominator}
        </div>
      </div>

      {/* Optional Label */}

      {label && (
        <div
          style={{
            marginTop:
              fontSize * 0.45,

            fontSize: labelSize,

            fontWeight: 500,

            color: "#4b5563",

            textAlign: "center",

            lineHeight: 1.4,

            maxWidth: "100%",

            wordBreak: "break-word",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};