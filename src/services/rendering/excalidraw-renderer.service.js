import crypto from "crypto";

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

function mapElementType(type) {
  switch (type) {
    case "label":
      return "text";

    case "text":
      return "text";

    case "heading":
      return "text";

    case "arrow":
      return "arrow";

    case "box":
      return "rectangle";
    
    case "circle":
      return "circle";

    case "square":
      return "square";

    default:
      return "text";
  }
}

/**
 * Ensures visual instructions are always safe to render
 */
function normalizeElements(elements) {
  if (!Array.isArray(elements)) return [];

  return elements
    .filter((el) => el && typeof el === "object")
    .map((el) => ({
      type: el.type || "label",
      text: el.text || "",
    }));
}

/**
 * Center stacked layout
 */
function renderCenterDiagram(elements) {
  const centerX = CANVAS_WIDTH / 2;
  let currentY = 160;

  return elements.map((element) => {
    const excalidrawElement = {
      id: crypto.randomUUID(),
      type: mapElementType(element.type),

      x: centerX - 150,
      y: currentY,

      width: 300,
      height: 60,

      text: element.text,
      fontSize: 28,

      strokeColor: "#000000",
      backgroundColor: "transparent",
    };

    currentY += 120;

    return excalidrawElement;
  });
}

/**
 * Two column layout
 */
function renderTwoColumn(elements) {
  const leftX = 200;
  const rightX = 700;

  let leftY = 160;
  let rightY = 160;

  return elements.map((element, index) => {
    const isLeft = index % 2 === 0;

    const excalidrawElement = {
      id: crypto.randomUUID(),
      type: mapElementType(element.type),

      x: isLeft ? leftX : rightX,
      y: isLeft ? leftY : rightY,

      width: 320,
      height: 60,

      text: element.text,
      fontSize: 26,

      strokeColor: "#000000",
      backgroundColor: "transparent",
    };

    if (isLeft) {
      leftY += 120;
    } else {
      rightY += 120;
    }

    return excalidrawElement;
  });
}

/**
 * MAIN EXPORT
 * Converts AI visual instructions → Excalidraw renderable objects
 */
export function renderSceneToExcalidraw({
  visualInstructions,
  canvasWidth = CANVAS_WIDTH,
  canvasHeight = CANVAS_HEIGHT,
}) {
  if (!visualInstructions) {
    return [];
  }

  const layout =
    visualInstructions.layout || "center-diagram";

  const elements = normalizeElements(
    visualInstructions.elements
  );

  if (elements.length === 0) {
    return renderCenterDiagram([
      { type: "text", text: "Learning content coming soon" }
    ]);
  }

  switch (layout) {
    case "center-diagram":
      return renderCenterDiagram(elements);

    case "two-column":
      return renderTwoColumn(elements);

    default:
      return renderCenterDiagram(elements);
  }
}


// import crypto from "crypto";

// function mapElementType(type) {
//   switch (type) {
//     case "label":
//       return "text";

//     case "heading":
//       return "text";

//     case "arrow":
//       return "arrow";

//     case "box":
//       return "rectangle";

//     default:
//       return "text";
//   }
// }

// function renderCenterDiagram({
//   elements,
//   canvasWidth,
//   canvasHeight,
// }) {
//   const centerX = canvasWidth / 2;

//   let currentY = 180;

//   return elements.map((element) => {
//     const excalidrawElement = {
//       id: crypto.randomUUID(),

//       type: mapElementType(element.type),

//       x: centerX - 150,

//       y: currentY,

//       width: 300,

//       height: 60,

//       text: element.text || "",

//       fontSize: 28,

//       strokeColor: "#000000",

//       backgroundColor: "transparent",
//     };

//     currentY += 120;

//     return excalidrawElement;
//   });
// }

// function renderTwoColumn({
//   elements,
//   canvasWidth,
//   canvasHeight,
// }) {
//   const leftX = 200;
//   const rightX = canvasWidth - 500;

//   let currentLeftY = 160;
//   let currentRightY = 160;

//   return elements.map((element, index) => {
//     const isLeft = index % 2 === 0;

//     const excalidrawElement = {
//       id: crypto.randomUUID(),

//       type: mapElementType(element.type),

//       x: isLeft ? leftX : rightX,

//       y: isLeft
//         ? currentLeftY
//         : currentRightY,

//       width: 320,

//       height: 60,

//       text: element.text || "",

//       fontSize: 26,

//       strokeColor: "#000000",

//       backgroundColor: "transparent",
//     };

//     if (isLeft) {
//       currentLeftY += 120;
//     } else {
//       currentRightY += 120;
//     }

//     return excalidrawElement;
//   });
// }

// export function renderSceneToExcalidraw({
//   visualInstructions,
//   canvasWidth = 1280,
//   canvasHeight = 720,
// }) {
//   if (!visualInstructions) {
//     throw new Error(
//       "visualInstructions is required"
//     );
//   }

//   const {
//     layout = "center-diagram",
//     elements = [],
//   } = visualInstructions;

//   switch (layout) {
//     case "center-diagram":
//       return renderCenterDiagram({
//         elements,
//         canvasWidth,
//         canvasHeight,
//       });

//     case "two-column":
//       return renderTwoColumn({
//         elements,
//         canvasWidth,
//         canvasHeight,
//       });

//     default:
//       return renderCenterDiagram({
//         elements,
//         canvasWidth,
//         canvasHeight,
//       });
//   }
// }