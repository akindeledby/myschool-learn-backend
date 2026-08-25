import React from "react";

import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  useCurrentFrame,
} from "remotion";

import { renderLayout } from "./layout/renderLayout.js";
import { getLessonTheme } from "./themes/themeResolver.js";

// =====================================
// SCENE RENDERER
// =====================================

export function SceneRenderer({ scene }) {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, 15],
    [0, 1],
    {
      extrapolateRight: "clamp",
    }
  );

  const theme = getLessonTheme(
    scene.theme || scene.subjectTheme || "default"
  );

  return (
    <AbsoluteFill
      style={{
        opacity,
      }}
    >
      {/* AUDIO */}

      {scene.audioUrl && (
        <Audio
          src={scene.audioUrl}
          volume={1}
        />
      )}

      {/* BACKGROUND */}

      {scene.backgroundImage ? (
        <Img
          src={scene.backgroundImage}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background: theme.background,
          }}
        />
      )}

      {/* OVERLAY */}

      <AbsoluteFill
        style={{
          backgroundColor: "rgba(255,255,255,0.08)",
        }}
      />

      {/* CONTENT */}

      <AbsoluteFill
        style={{
          padding: 60,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {renderLayout(scene, theme)}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
