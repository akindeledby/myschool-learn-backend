import React from "react";

import { EquationBlock } from "../components/EquationBlock.jsx";
import { ClockBlock } from "../components/ClockBlock.jsx";
import { ChartBlock } from "../components/ChartBlock.jsx";
import { FractionBlock } from "../components/FractionBlock.jsx";
import { TimelineBlock } from "../components/TimelineBlock.jsx";
import { QuestionBlock } from "../components/QuestionBlock.jsx";
import { ImageBlock } from "../components/ImageBlock.jsx";
import { GroupedObjectsBlock } from "../components/GroupedObjectsBlock.jsx";
import { TableBlock } from "../components/TableBlock.jsx";
import { PieChartBlock } from "../components/PieChartBlock.jsx";
import { FlowChartBlock } from "../components/FlowChartBlock.jsx";
import { VennDiagramBlock } from "../components/VennDiagramBlock.jsx";
import { MapBlock } from "../components/MapBlock.jsx";
import { GeometryDiagramBlock } from "../components/GeometryDiagramBlock.jsx";
import { ScientificDiagramBlock } from "../components/ScientificDiagramBlock.jsx";
import { AngleDiagramBlock } from "../components/AngleDiagramBlock.jsx";

import { LESSON_THEMES } from "../themes/lessonThemes.js";

import React from "react";

// ============================================
// FONT SIZES
// ============================================

const FONT = {
  hero: 48,
  "text-only": 44,
  "single-visual": 40,
  "two-column": 34,
  "grid-2x2": 28,
  gallery: 22,
};

// ============================================
// TEXT BLOCK
// ============================================

function TextBlock({
  block,
  layout = "single-visual",
  theme,
}) {
  const currentTheme =
    theme ?? LESSON_THEMES.default;

  const text =
    block.content ??
    block.text ??
    "";

  const length = text.length;

  const layoutType =
    typeof layout === "string"
      ? layout
      : layout.type ?? "single-visual";

  let fontSize =
    FONT[layoutType] ??
    FONT["single-visual"];

  const textCount =
    typeof layout === "object"
      ? layout.textCount ?? 1
      : 1;

  const totalWords =
    typeof layout === "object"
      ? layout.totalWords ?? 0
      : 0;

  const density =
    typeof layout === "object"
      ? layout.contentDensity
      : "low";

  // --------------------------------------------
  // Multiple text blocks
  // --------------------------------------------

  if (textCount >= 2) fontSize -= 2;
  if (textCount >= 3) fontSize -= 4;
  if (textCount >= 4) fontSize -= 6;
  if (textCount >= 5) fontSize -= 8;

  // --------------------------------------------
  // Overall scene density
  // --------------------------------------------

  if (totalWords > 35) fontSize -= 2;
  if (totalWords > 60) fontSize -= 4;
  if (totalWords > 85) fontSize -= 6;
  if (totalWords > 110) fontSize -= 8;

  // --------------------------------------------
  // Density adjustment
  // --------------------------------------------

  if (density === "medium")
    fontSize -= 3;

  if (density === "high")
    fontSize -= 7;

  // --------------------------------------------
  // Individual block length
  // --------------------------------------------

  if (length > 80) fontSize -= 2;
  if (length > 140) fontSize -= 4;
  if (length > 200) fontSize -= 6;
  if (length > 280) fontSize -= 8;

  // --------------------------------------------
  // Clamp
  // --------------------------------------------

  fontSize = Math.max(20, fontSize);

  let color =
    currentTheme.bodyColor;

  switch (block.role) {
    case "title":
      color =
        currentTheme.titleColor;
      break;

    case "keyword":
      color =
        currentTheme.highlightColor;
      break;

    case "important":
      color =
        currentTheme.accentColor;
      break;

    case "definition":
      color =
        currentTheme.titleColor;
      break;

    case "summary":
      color =
        currentTheme.accentColor;
      break;

    default:
      color =
        currentTheme.bodyColor;
  }

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: 1200,

          fontSize,

          fontWeight:
            block.role === "title"
              ? 800
              : 700,

          color,

          lineHeight: 1.35,

          textAlign: "center",

          wordBreak: "break-word",

          overflowWrap: "break-word",

          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>
    </div>
  );
}

// ============================================
// UNSUPPORTED BLOCK
// ============================================

function UnsupportedBlock({
  type,
  layout,
  theme,
}) {
  const currentTheme =
    theme ?? LESSON_THEMES.default;

  const text = `Unsupported block: ${type}`;

  const layoutType =
    typeof layout === "string"
      ? layout
      : layout?.type ??
        "single-visual";

  let fontSize =
    FONT[layoutType] ?? 26;

  if (text.length > 40)
    fontSize -= 2;

  if (text.length > 80)
    fontSize -= 4;

  if (text.length > 120)
    fontSize -= 6;

  fontSize = Math.max(18, fontSize);

  return (
    <div
      style={{
        padding: 30,

        borderRadius: 20,

        background:
          currentTheme.background,

        border: `3px solid ${currentTheme.accentColor}`,

        color:
          currentTheme.titleColor,

        fontSize,

        fontWeight: 700,

        lineHeight: 1.35,

        textAlign: "center",

        wordBreak: "break-word",

        overflowWrap: "break-word",
      }}
    >
      {text}
    </div>
  );
}

// ============================================
// RENDER BLOCK
// ============================================

export function renderBlock(
  block,
  index,
  layout,
  theme
) {
  if (!block?.type) {
    return (
      <UnsupportedBlock
        key={index}
        type="unknown"
        layout={layout}
      />
    );
  }

  switch (block.type) {
    case "text":
      return (
        <TextBlock
          key={index}
          block={block}
          layout={layout}
          theme={theme}
        />
      );

    case "image":
      return (
        <ImageBlock
          key={index}
          imageUrl={block.imageUrl}
          caption={block.caption}
          prompt={block.prompt}
          imageError={block.imageError}
          layout={layout}
          theme={theme}
        />
      );

    case "clock":
      return (
        <ClockBlock
          key={index}
          hour={block.hour}
          minute={block.minute}
          label={block.label}
          layout={layout}
        />
      );

    case "equation":
      return (
        <EquationBlock
          key={index}
          equation={block.equation}
          explanation={block.explanation}
          layout={layout}
        />
      );

    case "chart":
      return (
        <ChartBlock
          key={index}
          title={block.title}
          data={block.data}
          layout={layout}
        />
      );

    case "fraction":
      return (
        <FractionBlock
          key={index}
          numerator={block.numerator}
          denominator={block.denominator}
          label={block.label}
          layout={layout}
        />
      );

    case "timeline":
      return (
        <TimelineBlock
          key={index}
          title={block.title}
          events={
            block.events ??
            block.items
          }
          layout={layout}
        />
      );

    case "question":
      return (
        <QuestionBlock
          key={index}
          question={block.question}
          options={block.options}
          answer={block.answer}
          layout={layout}
        />
      );

    case "groupedObjects":
      return (
        <GroupedObjectsBlock
          key={index}
          object={block.object}
          total={block.total}
          groups={block.groups}
          label={block.label}
          layout={layout}
        />
      );

    case "table":
      return (
        <TableBlock
          key={index}
          title={block.title}
          headers={block.headers}
          rows={block.rows}
          layout={layout}
        />
      );

    case "pieChart":
      return (
        <PieChartBlock
          key={index}
          title={block.title}
          data={block.data}
          layout={layout}
        />
      );

    case "flowchart":
      return (
        <FlowChartBlock
          key={index}
          title={block.title}
          nodes={block.nodes}
          layout={layout}
        />
      );

    case "vennDiagram":
      return (
        <VennDiagramBlock
          key={index}
          title={block.title}
          leftTitle={block.leftTitle}
          rightTitle={block.rightTitle}
          leftItems={block.leftItems}
          overlapItems={block.overlapItems}
          rightItems={block.rightItems}
          layout={layout}
        />
      );

    case "map":
      return (
        <MapBlock
          key={index}
          title={block.title}
          imageUrl={block.imageUrl}
          caption={block.caption}
          markers={block.markers}
          imageError={block.imageError}
          layout={layout}
        />
      );

    case "geometryDiagram":
      return (
        <GeometryDiagramBlock
          key={index}
          width={block.width}
          height={block.height}
          shapes={block.shapes}
          labels={block.labels}
          layout={layout}
        />
      );

    case "scientificDiagram":
      return (
        <ScientificDiagramBlock
          key={index}
          width={block.width}
          height={block.height}
          shapes={block.shapes}
          labels={block.labels}
          layout={layout}
        />
      );

    case "angleDiagram":
      return (
        <AngleDiagramBlock
          key={index}
          angle={block.angle}
          label={block.label}
          layout={layout}
        />
      );

    default:
      return (
        <UnsupportedBlock
          key={index}
          type="unknown"
          layout={layout}
          theme={theme}
        />
      );
  }
}