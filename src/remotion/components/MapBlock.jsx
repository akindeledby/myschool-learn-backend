import React from "react";
import { Img } from "remotion";

const SIZE = {
  hero: {
    width: 1100,
    height: 700,
  },

  "single-visual": {
    width: 850,
    height: 550,
  },

  "two-column": {
    width: 620,
    height: 420,
  },

  "grid-2x2": {
    width: 430,
    height: 300,
  },

  gallery: {
    width: 300,
    height: 220,
  },

  default: {
    width: 850,
    height: 550,
  },
};

const TITLE = {
  hero: 44,
  "single-visual": 36,
  "two-column": 30,
  "grid-2x2": 24,
  gallery: 20,
};

const LABEL = {
  hero: 24,
  "single-visual": 20,
  "two-column": 18,
  "grid-2x2": 16,
  gallery: 14,
};

export const MapBlock = ({
  title,
  imageUrl,
  caption,
  markers = [],
  imageError,
  layout = "single-visual",
}) => {
  const size =
    SIZE[layout] ??
    SIZE.default;

  let titleFont =
    TITLE[layout] ??
    TITLE["single-visual"];

  let labelFont =
    LABEL[layout] ??
    LABEL["single-visual"];

  //----------------------------------------
  // Adaptive sizing
  //----------------------------------------

  const markerCount = markers.length;

  if (markerCount > 8) {
    labelFont -= 2;
  }

  if (markerCount > 15) {
    labelFont -= 2;
    titleFont -= 2;
  }

  const titleLength =
    title?.length ?? 0;

  if (titleLength > 40)
    titleFont -= 2;

  if (titleLength > 80)
    titleFont -= 2;

  const captionLength =
    caption?.length ?? 0;

  const captionFont =
    captionLength > 120
      ? labelFont - 2
      : labelFont;

  const hasImage =
    typeof imageUrl === "string" &&
    imageUrl.trim() !== "" &&
    !imageError;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",

        width: "100%",
        maxWidth: size.width,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: titleFont,
            fontWeight: 700,
            marginBottom: 24,
            textAlign: "center",
            lineHeight: 1.25,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            width: "100%",
          }}
        >
          {title}
        </div>
      )}

      {!hasImage ? (
        <div
          style={{
            width: "100%",
            maxWidth: size.width,
            height: size.height,

            border: "3px dashed #bbb",
            borderRadius: 20,

            display: "flex",
            justifyContent: "center",
            alignItems: "center",

            fontSize: titleFont,
            color: "#666",
            textAlign: "center",
          }}
        >
          Map unavailable
        </div>
      ) : (
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: size.width,
            height: size.height,
          }}
        >
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              borderRadius: 18,
              backgroundColor: "#fff",
            }}
          />

          {markers.map((marker, index) => (
            <div
              key={index}
              style={{
                position: "absolute",
                left: `${marker.x}%`,
                top: `${marker.y}%`,
                transform:
                  "translate(-50%, -50%)",
                maxWidth: 140,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  backgroundColor: "#e11d48",
                  margin: "0 auto",
                }}
              />

              <div
                style={{
                  marginTop: 6,
                  padding: "4px 8px",

                  backgroundColor: "#fff",

                  borderRadius: 8,

                  fontSize: labelFont,

                  fontWeight: 600,

                  textAlign: "center",

                  lineHeight: 1.25,

                  whiteSpace: "normal",

                  wordBreak: "break-word",

                  overflowWrap: "anywhere",

                  boxShadow:
                    "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                {marker.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {caption && (
        <div
          style={{
            marginTop: 20,

            width: "100%",

            textAlign: "center",

            fontSize: captionFont,

            color: "#444",

            lineHeight: 1.4,

            wordBreak: "break-word",

            overflowWrap: "anywhere",

            whiteSpace: "pre-wrap",
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
};