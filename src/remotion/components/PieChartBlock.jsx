import React from "react";

const SIZE = {
  hero: 600,
  "single-visual": 480,
  "two-column": 380,
  "grid-2x2": 300,
  gallery: 220,
  default: 480,
};

const TITLE_FONT = {
  hero: 44,
  "single-visual": 38,
  "two-column": 30,
  "grid-2x2": 24,
  gallery: 18,
  default: 38,
};

const LABEL_FONT = {
  hero: 28,
  "single-visual": 24,
  "two-column": 20,
  "grid-2x2": 18,
  gallery: 14,
  default: 24,
};

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#ca8a04",
  "#9333ea",
  "#0891b2",
  "#ea580c",
  "#6b7280",
];

export const PieChartBlock = ({
  title,
  data,
  layout = "single-visual",
}) => {
  const size =
    SIZE[layout] ??
    SIZE.default;

  const titleFont =
    TITLE_FONT[layout] ??
    TITLE_FONT.default;

  const labelFont =
    LABEL_FONT[layout] ??
    LABEL_FONT.default;

  // ------------------------------------
  // Normalize data
  // ------------------------------------

  let safeData = [];

  if (Array.isArray(data)) {
    safeData = data.map((item, index) => {
      if (typeof item === "string") {
        const parts = item.split(":");

        return {
          label: parts[0]?.trim() ?? `Item ${index + 1}`,
          value: Number(parts[1]) || 1,
        };
      }

      return {
        label:
          item?.label ??
          item?.name ??
          item?.title ??
          `Item ${index + 1}`,

        value:
          Number(
            item?.value ??
            item?.count ??
            item?.amount
          ) || 1,
      };
    });
  }

  const total = safeData.reduce(
    (sum, item) => sum + item.value,
    0
  );

  if (total <= 0) {
    return null;
  }

  let startAngle = 0;

  const radius = size / 2;
  const center = radius;

  const polarToCartesian = (
    cx,
    cy,
    r,
    angle
  ) => {
    const radians =
      ((angle - 90) * Math.PI) /
      180;

    return {
      x:
        cx +
        r * Math.cos(radians),

      y:
        cy +
        r * Math.sin(radians),
    };
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 30,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: titleFont,
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          {title}
        </div>
      )}

      <svg
        width={size}
        height={size}
      >
        {safeData.map(
          (item, index) => {
            const angle =
              (item.value / total) *
              360;

            const endAngle =
              startAngle + angle;

            const start =
              polarToCartesian(
                center,
                center,
                radius,
                startAngle
              );

            const end =
              polarToCartesian(
                center,
                center,
                radius,
                endAngle
              );

            const largeArc =
              angle > 180 ? 1 : 0;

            const path = `
M ${center} ${center}
L ${start.x} ${start.y}
A ${radius} ${radius}
0 ${largeArc} 1
${end.x} ${end.y}
Z
`;

            startAngle = endAngle;

            return (
              <path
                key={index}
                d={path}
                fill={
                  COLORS[
                    index %
                      COLORS.length
                  ]
                }
                stroke="#ffffff"
                strokeWidth={3}
              />
            );
          }
        )}
      </svg>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {safeData.map(
          (item, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                fontSize: labelFont,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  background:
                    COLORS[
                      index %
                        COLORS.length
                    ],
                }}
              />

              <div>
                {item.label} ({item.value})
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};