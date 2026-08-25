import React from "react";
import { Img } from "remotion";

// =====================================
// IMAGE SIZES
// =====================================

const IMAGE_SIZE = {
  hero: {
    width: 900,
    height: 520,
    caption: 34,
  },

  "single-visual": {
    width: 760,
    height: 480,
    caption: 30,
  },

  "two-column": {
    width: 500,
    height: 340,
    caption: 24,
  },

  "grid-2x2": {
    width: 360,
    height: 260,
    caption: 20,
  },

  gallery: {
    width: 260,
    height: 190,
    caption: 16,
  },

  default: {
    width: 700,
    height: 460,
    caption: 28,
  },
};

// =====================================
// IMAGE BLOCK
// =====================================

export const ImageBlock = ({
  imageUrl,
  caption,
  prompt,
  imageError,
  layout = "single-visual",
  theme,
}) => {
  const size =
    IMAGE_SIZE[layout] ??
    IMAGE_SIZE.default;

  const hasImage =
    typeof imageUrl === "string" &&
    imageUrl.trim() !== "" &&
    !imageError;

  const activeTheme = theme ?? {
    background: "#FFFFFF",
    titleColor: "#111827",
    bodyColor: "#374151",
    highlightColor: "#2563EB",
    accentColor: "#6366F1",
  };

  //--------------------------------------------------
  // IMAGE FAILED
  //--------------------------------------------------

  if (!hasImage) {
    return (
      <div
        style={{
          width: size.width,
          height: size.height,

          display: "flex",
          flexDirection: "column",

          justifyContent: "center",
          alignItems: "center",
          padding: 30,
          border: `2px solid ${activeTheme.accentColor}`,

          borderRadius: 22,
          backgroundColor: activeTheme.background,
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontSize: size.caption + 4,
            fontWeight: "bold",
            color: activeTheme.titleColor,
          }}
        >
          Image unavailable
        </div>

        {prompt && (
          <div
            style={{
              marginTop: 20,

              fontSize: size.caption - 6,

              color: activeTheme.bodyColor,

              lineHeight: 1.5,

              maxWidth: size.width * 0.85,
            }}
          >
            {prompt}
          </div>
        )}
      </div>
    );
  }

  //--------------------------------------------------
  // IMAGE
  //--------------------------------------------------

  return (
    <div
      style={{
        width: size.width,

        display: "flex",

        flexDirection: "column",

        alignItems: "center",
      }}
    >
      <div
        style={{
          width: size.width,
          height: size.height,
          borderRadius: 24,
          overflow: "hidden",
          backgroundColor: activeTheme.background,
          border: `4px solid ${activeTheme.accentColor}`,
          boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Img
          src={imageUrl}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      {caption && (
        <div
          style={{
            marginTop: 8,
            width: "100%",
            fontSize: size.caption,
            fontWeight: 600,
            textAlign: "center",
            color: activeTheme.titleColor,
            lineHeight: 1.45,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
};
