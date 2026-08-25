import React from "react";

// ============================================
// DIAGRAM SIZES
// ============================================

const SIZE = {
  hero: 1500,
  "single-visual": 1100,
  "two-column": 700,
  "grid-2x2": 480,
  gallery: 320,
  default: 700,
};

// ============================================
// GEOMETRY DIAGRAM BLOCK
// ============================================

export const GeometryDiagramBlock = ({
  width,
  height,
  shapes,
  labels,
  layout = "single-visual",
}) => {
  const size =
    SIZE[layout] ??
    SIZE.default;

  // ------------------------------------------
  // Defensive defaults
  // ------------------------------------------

  const safeWidth =
    Number(width) > 0
      ? width
      : 400;

  const safeHeight =
    Number(height) > 0
      ? height
      : 300;

  const safeShapes =
    Array.isArray(shapes)
      ? shapes
      : [];

  const safeLabels =
    Array.isArray(labels)
      ? labels
      : [];

  return (
    <svg
      width={size}
      height={
        (safeHeight /
          safeWidth) *
        size
      }
      viewBox={`0 0 ${safeWidth} ${safeHeight}`}
      style={{
        overflow: "visible",
      }}
    >
      {/* =======================================
          SHAPES
      ======================================= */}

      {safeShapes.map(
        (shape, index) => {
          if (!shape?.type)
            return null;

          switch (
            shape.type
          ) {
            //-----------------------------------
            // LINE
            //-----------------------------------

            case "line":
              return (
                <line
                  key={index}
                  x1={
                    shape.x1 ?? 0
                  }
                  y1={
                    shape.y1 ?? 0
                  }
                  x2={
                    shape.x2 ?? 0
                  }
                  y2={
                    shape.y2 ?? 0
                  }
                  stroke={
                    shape.color ??
                    "#111827"
                  }
                  strokeWidth={
                    shape.strokeWidth ??
                    4
                  }
                />
              );

            //-----------------------------------
            // POLYGON
            //-----------------------------------

            case "polygon":
              if (
                !Array.isArray(
                  shape.points
                )
              ) {
                return null;
              }

              return (
                <polygon
                  key={index}
                  points={shape.points
                    .map(
                      (point) =>
                        `${point.x},${point.y}`
                    )
                    .join(" ")}
                  fill={
                    shape.fill ??
                    "transparent"
                  }
                  stroke={
                    shape.color ??
                    "#111827"
                  }
                  strokeWidth={
                    shape.strokeWidth ??
                    4
                  }
                />
              );

            //-----------------------------------
            // CIRCLE
            //-----------------------------------

            case "circle":
              return (
                <circle
                  key={index}
                  cx={
                    shape.cx ?? 0
                  }
                  cy={
                    shape.cy ?? 0
                  }
                  r={
                    shape.r ?? 20
                  }
                  fill={
                    shape.fill ??
                    "transparent"
                  }
                  stroke={
                    shape.color ??
                    "#111827"
                  }
                  strokeWidth={
                    shape.strokeWidth ??
                    4
                  }
                />
              );

            //-----------------------------------
            // ARC
            //-----------------------------------

            case "arc":
              if (
                !shape.path
              ) {
                return null;
              }

              return (
                <path
                  key={index}
                  d={shape.path}
                  fill="none"
                  stroke={
                    shape.color ??
                    "#2563eb"
                  }
                  strokeWidth={
                    shape.strokeWidth ??
                    4
                  }
                />
              );

            //-----------------------------------
            // UNKNOWN
            //-----------------------------------

            default:
              return null;
          }
        }
      )}

      {/* =======================================
          LABELS
      ======================================= */}

      {safeLabels.map(
        (
          label,
          index
        ) => {
          if (
            !label
          )
            return null;

          return (
            <text
              key={index}
              x={
                label.x ?? 0
              }
              y={
                label.y ?? 0
              }
              fontSize={
                label.fontSize ??
                28
              }
              fontWeight="bold"
              textAnchor="middle"
              fill="#111827"
            >
              {label.text ??
                ""}
            </text>
          );
        }
      )}
    </svg>
  );
};