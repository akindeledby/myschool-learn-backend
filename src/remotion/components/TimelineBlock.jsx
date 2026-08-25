import React from "react";

// ============================================
// TIMELINE SIZES
// ============================================

const TIMELINE_SIZE = {
  hero: {
    width: 1200,
    year: 44,
    text: 36,
    dot: 20,
    gap: 30,
    spacing: 40,
    yearWidth: 170,
  },

  "single-visual": {
    width: 900,
    year: 40,
    text: 32,
    dot: 18,
    gap: 28,
    spacing: 34,
    yearWidth: 150,
  },

  "two-column": {
    width: 700,
    year: 32,
    text: 26,
    dot: 16,
    gap: 22,
    spacing: 28,
    yearWidth: 120,
  },

  "grid-2x2": {
    width: 450,
    year: 24,
    text: 18,
    dot: 12,
    gap: 16,
    spacing: 20,
    yearWidth: 80,
  },

  gallery: {
    width: 320,
    year: 18,
    text: 14,
    dot: 10,
    gap: 12,
    spacing: 14,
    yearWidth: 60,
  },

  default: {
    width: 900,
    year: 40,
    text: 32,
    dot: 18,
    gap: 28,
    spacing: 34,
    yearWidth: 150,
  },
};

// ============================================
// TIMELINE BLOCK
// ============================================

export const TimelineBlock = ({
  title,
  events = [],
  layout = "single-visual",
}) => {
  const size = {
    ...(TIMELINE_SIZE[layout] ??
      TIMELINE_SIZE.default),
  };

  if (!events.length) {
    return null;
  }

  const eventCount = events.length;

  // ------------------------------------------
  // Dynamically scale for many events
  // ------------------------------------------

  if (eventCount >= 6) {
    size.year -= 4;
    size.text -= 4;
    size.spacing -= 8;
  }

  if (eventCount >= 8) {
    size.year -= 4;
    size.text -= 4;
    size.spacing -= 6;
    size.gap -= 4;
    size.dot -= 2;
  }

  // ------------------------------------------
  // Dynamic title size
  // ------------------------------------------

  const titleLength = title?.length ?? 0;

  let titleFont = size.year + 10;

  if (titleLength > 40) titleFont -= 4;
  if (titleLength > 70) titleFont -= 4;
  if (titleLength > 100) titleFont -= 4;

  const eventSpacing =
    eventCount > 6
      ? size.spacing * 0.65
      : size.spacing;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: size.width,

        display: "flex",
        flexDirection: "column",

        alignItems: "stretch",
      }}
    >
      {title && (
        <div
          style={{
            fontSize: titleFont,
            fontWeight: 700,
            textAlign: "center",
            color: "#111827",
            marginBottom: size.spacing,
            lineHeight: 1.25,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </div>
      )}

      {events.map((event, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            gap: size.gap,

            marginBottom:
              index === events.length - 1
                ? 0
                : eventSpacing,
          }}
        >
          {/* YEAR */}

          <div
            style={{
              width: size.yearWidth,
              maxWidth: size.yearWidth,

              fontSize: size.year,
              fontWeight: 700,

              color: "#111827",

              textAlign: "right",

              flexShrink: 0,

              wordBreak: "break-word",
              overflowWrap: "anywhere",
              whiteSpace: "normal",
            }}
          >
            {event.year}
          </div>

          {/* DOT */}

          <div
            style={{
              width: size.dot,
              height: size.dot,

              borderRadius: "50%",

              backgroundColor: "#2563eb",

              flexShrink: 0,
            }}
          />

          {/* DESCRIPTION */}

          <div
            style={{
              flex: 1,

              fontSize: size.text,

              color: "#374151",

              lineHeight: 1.45,

              wordBreak: "break-word",
              overflowWrap: "anywhere",
              whiteSpace: "pre-wrap",
            }}
          >
            {event.text}
          </div>
        </div>
      ))}
    </div>
  );
};