import React from "react";

const SIZE = {
  hero: 600,
  "single-visual": 450,
  "two-column": 360,
  "grid-2x2": 280,
  gallery: 220,
  default: 450,
};

const FONT = {
  hero: 46,
  "single-visual": 38,
  "two-column": 30,
  "grid-2x2": 24,
  gallery: 18,
  default: 38,
};

export const AngleDiagramBlock = ({
  angle = 60,
  label = "θ",
  layout = "single-visual",
}) => {
  const size =
    SIZE[layout] ??
    SIZE.default;

  const font =
    FONT[layout] ??
    FONT.default;

  const radius =
    size * 0.38;

  const center =
    size / 2;

  const radians =
    (angle * Math.PI) / 180;

  const x =
    center +
    radius *
      Math.cos(-radians);

  const y =
    center +
    radius *
      Math.sin(-radians);

  const arcRadius =
    radius * 0.45;

  const arcX =
    center +
    arcRadius *
      Math.cos(
        -radians / 2
      );

  const arcY =
    center +
    arcRadius *
      Math.sin(
        -radians / 2
      );

  return (
    <div
      style={{
        display: "flex",
        flexDirection:
          "column",
        alignItems:
          "center",
      }}
    >
      <svg
        width={size}
        height={size}
      >
        {/* Horizontal Arm */}

        <line
          x1={center}
          y1={center}
          x2={
            center +
            radius
          }
          y2={center}
          stroke="black"
          strokeWidth="6"
        />

        {/* Rotated Arm */}

        <line
          x1={center}
          y1={center}
          x2={x}
          y2={y}
          stroke="#2563eb"
          strokeWidth="6"
        />

        {/* Arc */}

        <path
          d={`
            M ${center + arcRadius} ${center}
            A ${arcRadius} ${arcRadius}
            0 0 0
            ${arcX}
            ${arcY}
          `}
          fill="none"
          stroke="#ef4444"
          strokeWidth="5"
        />

        {/* Center */}

        <circle
          cx={center}
          cy={center}
          r="7"
          fill="black"
        />

        {/* Angle Label */}

        <text
          x={arcX + 18}
          y={arcY - 8}
          fontSize={font}
          fontWeight="bold"
          fill="#111827"
        >
          {label}
        </text>

        {/* Degree */}

        <text
          x={center + 30}
          y={center - 20}
          fontSize={
            font * 0.8
          }
          fill="#374151"
        >
          {angle}°
        </text>
      </svg>
    </div>
  );
};