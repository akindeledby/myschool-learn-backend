import React from "react";

// ============================================
// CHART SIZES
// ============================================

const CHART_SIZE = {
  hero: {
    width: 1200,
    height: 620,
    title: 54,
    label: 34,
    value: 30,
    barArea: 420,
    gap: 36,
  },

  "single-visual": {
    width: 900,
    height: 520,
    title: 46,
    label: 28,
    value: 24,
    barArea: 340,
    gap: 28,
  },

  "two-column": {
    width: 650,
    height: 420,
    title: 38,
    label: 24,
    value: 20,
    barArea: 260,
    gap: 22,
  },

  "grid-2x2": {
    width: 450,
    height: 320,
    title: 28,
    label: 18,
    value: 16,
    barArea: 180,
    gap: 16,
  },

  gallery: {
    width: 320,
    height: 240,
    title: 22,
    label: 14,
    value: 12,
    barArea: 120,
    gap: 10,
  },

  default: {
    width: 900,
    height: 520,
    title: 46,
    label: 28,
    value: 24,
    barArea: 340,
    gap: 28,
  },
};

// ============================================
// CHART BLOCK
// ============================================

export const ChartBlock = ({
  title,
  data = [],
  layout = "single-visual",
}) => {
  const size =
    CHART_SIZE[layout] ??
    CHART_SIZE.default;

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const max = Math.max(
    ...data.map((item) => Number(item.value) || 0),
    1
  );

  const barWidth = Math.min(
    90,
    Math.max(
      26,
      size.width / (data.length * 2.8)
    )
  );

  return (
    <div
      style={{
        width: size.width,
        maxWidth: "100%",

        display: "flex",
        flexDirection: "column",

        alignItems: "center",
      }}
    >
      {title && (
        <div
          style={{
            fontSize: size.title,
            fontWeight: 700,
            marginBottom: 30,
            textAlign: "center",
            color: "#111827",

            width: "100%",
            wordBreak: "break-word",
          }}
        >
          {title}
        </div>
      )}

      <div
        style={{
          width: "100%",
          height: size.height,

          display: "flex",

          justifyContent: "space-evenly",

          alignItems: "flex-end",

          gap: size.gap,

          padding: "0 20px",
        }}
      >
        {data.map((item, index) => {
          const value =
            Number(item.value) || 0;

          const barHeight =
            (value / max) *
            size.barArea;

          return (
            <div
              key={index}
              style={{
                flex: 1,

                display: "flex",
                flexDirection: "column",

                justifyContent: "flex-end",

                alignItems: "center",

                minWidth: 0,
              }}
            >
              {/* Value */}

              <div
                style={{
                  fontSize: size.value,
                  fontWeight: 700,
                  color: "#111827",
                  marginBottom: 10,
                }}
              >
                {value}
              </div>

              {/* Bar */}

              <div
                style={{
                  width: barWidth,

                  height: Math.max(
                    8,
                    barHeight
                  ),

                  backgroundColor:
                    "#4f46e5",

                  borderRadius:
                    "12px 12px 0 0",
                }}
              />

              {/* Label */}

              <div
                style={{
                  marginTop: 14,

                  width: "100%",

                  fontSize: size.label,

                  fontWeight: 600,

                  textAlign: "center",

                  color: "#374151",

                  lineHeight: 1.3,

                  wordBreak: "break-word",

                  overflowWrap: "break-word",
                }}
              >
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};