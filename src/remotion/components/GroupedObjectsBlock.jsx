import React from "react";

// =====================================
// GROUPED OBJECT SIZES
// =====================================

const GROUP_SIZE = {
  hero: {
    box: 280,
    emoji: 64,
    padding: 26,
    gap: 18,
    groupGap: 50,
    border: 5,
    label: 42,
  },

  "single-visual": {
    box: 220,
    emoji: 52,
    padding: 22,
    gap: 14,
    groupGap: 40,
    border: 4,
    label: 34,
  },

  "two-column": {
    box: 180,
    emoji: 40,
    padding: 18,
    gap: 12,
    groupGap: 30,
    border: 4,
    label: 28,
  },

  "grid-2x2": {
    box: 140,
    emoji: 30,
    padding: 14,
    gap: 8,
    groupGap: 20,
    border: 3,
    label: 22,
  },

  gallery: {
    box: 110,
    emoji: 22,
    padding: 10,
    gap: 6,
    groupGap: 16,
    border: 3,
    label: 18,
  },

  default: {
    box: 200,
    emoji: 40,
    padding: 20,
    gap: 10,
    groupGap: 30,
    border: 4,
    label: 30,
  },
};

// =====================================
// GROUPED OBJECTS BLOCK
// =====================================

export const GroupedObjectsBlock = ({
  object = "🍎",
  total = 12,
  groups = 3,
  label,
  layout = "single-visual",
}) => {
  const size =
    GROUP_SIZE[layout] ??
    GROUP_SIZE.default;

  const safeGroups =
    Math.max(1, groups);

  const itemsPerGroup =
    Math.ceil(total / safeGroups);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",

        alignItems: "center",

        gap: size.groupGap,
      }}
    >
      {/* LABEL */}

      {label && (
        <div
          style={{
            fontSize: size.label,

            fontWeight: 700,

            color: "#111827",

            textAlign: "center",
          }}
        >
          {label}
        </div>
      )}

      {/* GROUPS */}

      <div
        style={{
          display: "flex",

          flexWrap: "wrap",

          justifyContent: "center",

          gap: size.groupGap,
        }}
      >
        {Array.from({
          length: safeGroups,
        }).map((_, groupIndex) => (
          <div
            key={groupIndex}
            style={{
              width: size.box,
              height: size.box,

              display: "flex",

              flexWrap: "wrap",

              justifyContent: "center",

              alignContent: "center",

              gap: size.gap,

              padding: size.padding,

              border: `${size.border}px solid #111827`,

              borderRadius: 20,

              backgroundColor: "#ffffff",

              boxSizing: "border-box",
            }}
          >
            {Array.from({
              length: itemsPerGroup,
            }).map((_, itemIndex) => (
              <div
                key={itemIndex}
                style={{
                  fontSize: size.emoji,

                  lineHeight: 1,
                }}
              >
                {object}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
