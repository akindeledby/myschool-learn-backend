import React from "react";

// ============================================
// SCIENTIFIC DIAGRAM BLOCK
// ============================================

const SIZE = {
  hero: 900,
  "single-visual": 700,
  "two-column": 520,
  "grid-2x2": 380,
  gallery: 260,
  default: 700,
};

export const ScientificDiagramBlock = ({
  width = 800,
  height = 600,
  shapes,
  labels,
  layout = "single-visual",
}) => {
  const size = SIZE[layout] ?? SIZE.default;

  const safeWidth =
    typeof width === "number" && width > 0
      ? width
      : 800;

  const safeHeight =
    typeof height === "number" && height > 0
      ? height
      : 600;

  const safeShapes = Array.isArray(shapes)
    ? shapes
    : [];

  let safeLabels = [];

  if (Array.isArray(labels)) {
    safeLabels = labels;
  } else if (typeof labels === "string") {
    safeLabels = labels
      .split(",")
      .map((text, index) => ({
        text: text.trim(),
        x: 120,
        y: 70 + index * 50,
      }));
  }

  return (
    <svg
      width={size}
      height={(safeHeight / safeWidth) * size}
      viewBox={`0 0 ${safeWidth} ${safeHeight}`}
      style={{
        overflow: "visible",
      }}
    >
      {/* SHAPES */}

      {safeShapes.map((shape, index) => {
        switch (shape.type) {
          case "circle":
            return (
              <circle
                key={index}
                cx={shape.cx}
                cy={shape.cy}
                r={shape.r}
                fill={shape.fill ?? "white"}
                stroke={shape.stroke ?? "#111"}
                strokeWidth={shape.strokeWidth ?? 3}
              />
            );

          case "ellipse":
            return (
              <ellipse
                key={index}
                cx={shape.cx}
                cy={shape.cy}
                rx={shape.rx}
                ry={shape.ry}
                fill={shape.fill ?? "white"}
                stroke={shape.stroke ?? "#111"}
                strokeWidth={shape.strokeWidth ?? 3}
              />
            );

          case "rect":
            return (
              <rect
                key={index}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                rx={shape.radius ?? 0}
                fill={shape.fill ?? "white"}
                stroke={shape.stroke ?? "#111"}
                strokeWidth={shape.strokeWidth ?? 3}
              />
            );

          case "line":
            return (
              <line
                key={index}
                x1={shape.x1}
                y1={shape.y1}
                x2={shape.x2}
                y2={shape.y2}
                stroke={shape.stroke ?? "#111"}
                strokeWidth={shape.strokeWidth ?? 3}
              />
            );

          case "polygon":
            return (
              <polygon
                key={index}
                points={(shape.points ?? [])
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill={shape.fill ?? "white"}
                stroke={shape.stroke ?? "#111"}
                strokeWidth={shape.strokeWidth ?? 3}
              />
            );

          case "path":
            return (
              <path
                key={index}
                d={shape.d}
                fill={shape.fill ?? "none"}
                stroke={shape.stroke ?? "#111"}
                strokeWidth={shape.strokeWidth ?? 3}
              />
            );

          default:
            return null;
        }
      })}

      {/* LABELS */}

      {safeLabels.map((label, index) => {
        if (typeof label === "string") {
          return (
            <text
              key={index}
              x={120}
              y={70 + index * 50}
              fontSize={24}
              fontWeight="bold"
              fill="#111"
            >
              {label}
            </text>
          );
        }

        return (
          <g key={index}>
            {label.line && (
              <line
                x1={label.line.x1}
                y1={label.line.y1}
                x2={label.line.x2}
                y2={label.line.y2}
                stroke="#111"
                strokeWidth={2}
              />
            )}

            <text
              x={label.x ?? 120}
              y={label.y ?? 80}
              fontSize={label.fontSize ?? 24}
              fontWeight="bold"
              fill="#111"
            >
              {label.text ?? ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
};