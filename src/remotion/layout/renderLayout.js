import React from "react";

import { buildSceneLayout } from "./layoutEngine.js";
import {
  classifyScene,
  SceneType,
} from "./sceneClassifier.js";

import { LayoutType } from "./layoutTypes.js";

import { HeroLayout } from "../renderers/HeroLayout.js";
import { TextOnlyLayout } from "../renderers/TextOnlyLayout.js";
import { SingleVisualLayout } from "../renderers/SingleVisualLayout.js";
import { TwoColumnLayout } from "../renderers/TwoColumnLayout.js";
import { GridLayout } from "../renderers/GridLayout.js";
import { GalleryLayout } from "../renderers/GalleryLayout.js";

// ============================================
// RENDER SCENE
// ============================================

export function renderLayout(
  scene, theme
) {
  if (!scene) return null;

  //---------------------------------------
  // Determine educational scene type
  //---------------------------------------

  const sceneType =
    classifyScene(scene);

  //---------------------------------------
  // Determine visual layout
  //---------------------------------------

  const layout =
    buildSceneLayout(
      scene.blocks ?? []
    );

  //---------------------------------------
  // Common props
  //---------------------------------------

  const props = {
    scene,
    theme,
    sceneType,
    layout,
    texts:
      layout.texts ?? [],
    visuals:
      layout.visuals ?? [],
    others:
      layout.others ?? [],
  };

  //---------------------------------------
  // Educational overrides
  //---------------------------------------

  switch (
    sceneType
  ) {
    case SceneType.INTRODUCTION:
      return (
        <HeroLayout
          {...props}
        />
      );

    case SceneType.PRACTICE:
      return (
        <SingleVisualLayout
          {...props}
        />
      );

    case SceneType.RECAP:
      return (
        <GalleryLayout
          {...props}
        />
      );

    default:
      break;
  }

  //---------------------------------------
  // Default layouts
  //---------------------------------------

  switch (
    layout.type
  ) {
    case LayoutType.TEXT_ONLY:
      return (
        <TextOnlyLayout
          {...props}
        />
      );

    case LayoutType.SINGLE_VISUAL:
      return (
        <SingleVisualLayout
          {...props}
        />
      );

    case LayoutType.TWO_COLUMN:
      return (
        <TwoColumnLayout
          {...props}
        />
      );

    case LayoutType.GRID_2X2:
      return (
        <GridLayout
          {...props}
        />
      );

    case LayoutType.GALLERY:
      return (
        <GalleryLayout
          {...props}
        />
      );

    default:
      return (
        <TextOnlyLayout
          {...props}
        />
      );
  }
}