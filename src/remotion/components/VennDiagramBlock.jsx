import React from "react";

const DIAMETER = {
  hero: 380,
  "single-visual": 300,
  "two-column": 240,
  "grid-2x2": 180,
  gallery: 140,
};

const FONT = {
  hero: 34,
  "single-visual": 28,
  "two-column": 24,
  "grid-2x2": 20,
  gallery: 16,
};

const TITLE = {
  hero: 44,
  "single-visual": 36,
  "two-column": 30,
  "grid-2x2": 24,
  gallery: 20,
};

export const VennDiagramBlock = ({
  title,
  leftTitle = "Set A",
  rightTitle = "Set B",

  leftItems = [],
  overlapItems = [],
  rightItems = [],

  layout = "single-visual",
}) => {
  let diameter =
    DIAMETER[layout] ??
    DIAMETER["single-visual"];

  let font =
    FONT[layout] ??
    FONT["single-visual"];

  let titleFont =
    TITLE[layout] ??
    TITLE["single-visual"];

  //---------------------------------------
  // Adaptive sizing
  //---------------------------------------

  const totalItems =
    leftItems.length +
    overlapItems.length +
    rightItems.length;

  if (totalItems > 8) {
    diameter *= 1.08;
    font -= 2;
  }

  if (totalItems > 14) {
    diameter *= 1.08;
    font -= 2;
  }

  if ((title?.length ?? 0) > 40) {
    titleFont -= 2;
  }

  if ((title?.length ?? 80) > 80) {
    titleFont -= 2;
  }

  const radius = diameter / 2;

  const overlap = diameter * 0.35;

  const itemFont = font * 0.72;

  const renderItems = (items) =>
    items.map((item, index) => (
      <div key={index}>{item}</div>
    ));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",

        width: "100%",
      }}
    >
      {title && (
        <div
          style={{
            fontSize: titleFont,
            fontWeight: 700,

            marginBottom: 30,

            width: "100%",

            textAlign: "center",

            lineHeight: 1.25,

            wordBreak: "break-word",

            overflowWrap: "anywhere",
          }}
        >
          {title}
        </div>
      )}

      <div
        style={{
          position: "relative",

          width: diameter * 2 - overlap,

          height: diameter,

          maxWidth: "100%",
        }}
      >
        {/* LEFT */}

        <div
          style={{
            position: "absolute",

            left: 0,
            top: 0,

            width: diameter,
            height: diameter,

            borderRadius: "50%",

            border: "4px solid #2563eb",

            backgroundColor:
              "rgba(37,99,235,0.12)",

            display: "flex",
            flexDirection: "column",

            justifyContent: "center",

            alignItems: "center",

            padding: 20,

            textAlign: "center",

            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontWeight: "bold",

              marginBottom: 10,

              fontSize: font,

              lineHeight: 1.2,

              wordBreak: "break-word",

              overflowWrap: "anywhere",
            }}
          >
            {leftTitle}
          </div>

          <div
            style={{
              fontSize: itemFont,

              lineHeight: 1.35,

              wordBreak: "break-word",

              overflowWrap: "anywhere",

              whiteSpace: "pre-wrap",

              maxWidth: "100%",
            }}
          >
            {renderItems(leftItems)}
          </div>
        </div>

        {/* RIGHT */}

        <div
          style={{
            position: "absolute",

            left: diameter - overlap,

            top: 0,

            width: diameter,
            height: diameter,

            borderRadius: "50%",

            border: "4px solid #dc2626",

            backgroundColor:
              "rgba(220,38,38,0.12)",

            display: "flex",
            flexDirection: "column",

            justifyContent: "center",

            alignItems: "center",

            padding: 20,

            textAlign: "center",

            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontWeight: "bold",

              marginBottom: 10,

              fontSize: font,

              lineHeight: 1.2,

              wordBreak: "break-word",

              overflowWrap: "anywhere",
            }}
          >
            {rightTitle}
          </div>

          <div
            style={{
              fontSize: itemFont,

              lineHeight: 1.35,

              wordBreak: "break-word",

              overflowWrap: "anywhere",

              whiteSpace: "pre-wrap",

              maxWidth: "100%",
            }}
          >
            {renderItems(rightItems)}
          </div>
        </div>

        {/* OVERLAP */}

        <div
          style={{
            position: "absolute",

            left: radius - overlap / 2,

            top: radius - diameter * 0.2,

            width: overlap,

            minHeight: diameter * 0.4,

            display: "flex",

            flexDirection: "column",

            justifyContent: "center",

            alignItems: "center",

            textAlign: "center",

            padding: 8,

            fontSize: itemFont,

            fontWeight: 600,

            lineHeight: 1.3,

            wordBreak: "break-word",

            overflowWrap: "anywhere",

            whiteSpace: "pre-wrap",

            boxSizing: "border-box",
          }}
        >
          {renderItems(overlapItems)}
        </div>
      </div>
    </div>
  );
};