import React from "react";

import { renderBlock } from "../layout/renderBlock.js";

// ============================================
// SINGLE VISUAL LAYOUT
// ============================================

export function SingleVisualLayout({
  visuals = [],
  texts = [],
  layout,
  theme,
  sceneIndex = 0,
}) {
  const visual = visuals[0];

  if (!visual) return null;

  const hasText = texts.length > 0;

  const totalWords =
    layout?.totalWords ??
    texts.reduce((sum, block) => {
      const text =
        block.content ??
        block.text ??
        "";

      return (
        sum +
        text
          .trim()
          .split(/\s+/)
          .filter(Boolean).length
      );
    }, 0);

  const textCount =
    layout?.textCount ??
    texts.length;

  const density =
    layout?.contentDensity ??
    0;

  //----------------------------------------------------
  // Decide layout
  //----------------------------------------------------

  const useVerticalLayout =
    density > 0.65 ||
    textCount >= 3 ||
    totalWords > 80;

  //----------------------------------------------------
  // Adaptive spacing
  //----------------------------------------------------

  let outerGap = 70;
  let innerGap = 26;

  if (totalWords > 60) {
    outerGap = 55;
    innerGap = 22;
  }

  if (totalWords > 90) {
    outerGap = 40;
    innerGap = 18;
  }

  if (totalWords > 120) {
    outerGap = 28;
    innerGap = 14;
  }

  //----------------------------------------------------
  // Adaptive flex
  //----------------------------------------------------

  let visualFlex = 1;
  let textFlex = 1;

  if (totalWords > 70) {
    visualFlex = 0.9;
    textFlex = 1.1;
  }

  if (totalWords > 110) {
    visualFlex = 0.8;
    textFlex = 1.2;
  }

  //----------------------------------------------------
  // Alternate left/right
  //----------------------------------------------------

  const visualLeft =
    sceneIndex % 2 === 0;

  //----------------------------------------------------
  // No text
  //----------------------------------------------------

  if (!hasText) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",

          display: "flex",

          justifyContent: "center",

          alignItems: "center",

          padding: "40px",

          boxSizing: "border-box",
        }}
      >
        {renderBlock(
          visual,
          0,
          layout,
          theme
        )}
      </div>
    );
  }

  //----------------------------------------------------
  // Vertical layout
  //----------------------------------------------------

  if (useVerticalLayout) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",

          display: "flex",

          flexDirection: "column",

          justifyContent: "center",

          alignItems: "center",

          padding: "40px 70px",

          boxSizing: "border-box",

          gap: outerGap,
        }}
      >
        <div
          style={{
            flex: visualFlex,

            width: "100%",

            display: "flex",

            justifyContent: "center",

            alignItems: "center",
          }}
        >
          {renderBlock(
            visual,
            0,
            layout,
            theme
          )}
        </div>

        <div
          style={{
            flex: textFlex,

            width: "100%",

            display: "flex",

            flexDirection: "column",

            justifyContent: "center",

            alignItems: "center",

            gap: innerGap,

            maxHeight: "100%",
          }}
        >
          {texts.map(
            (block, index) =>
              renderBlock(
                block,
                index,
                layout,
                theme
              )
          )}
        </div>
      </div>
    );
  }

  //----------------------------------------------------
  // Side-by-side layout
  //----------------------------------------------------

  return (
    <div
      style={{
        width: "100%",
        height: "100%",

        display: "flex",

        alignItems: "center",

        justifyContent: "space-between",

        padding: "40px 70px",

        boxSizing: "border-box",

        gap: outerGap,
      }}
    >
      <div
        style={{
          flex: visualLeft
            ? visualFlex
            : textFlex,

          display: "flex",

          flexDirection:
            visualLeft
              ? "row"
              : "column",

          justifyContent: "center",

          alignItems: "center",

          gap: innerGap,
        }}
      >
        {visualLeft
          ? renderBlock(
              visual,
              0,
              layout,
              theme
            )
          : texts.map(
              (block, index) =>
                renderBlock(
                  block,
                  index,
                  layout,
                  theme
                )
            )}
      </div>

      <div
        style={{
          flex: visualLeft
            ? textFlex
            : visualFlex,

          display: "flex",

          flexDirection:
            visualLeft
              ? "column"
              : "row",

          justifyContent: "center",

          alignItems: "center",

          gap: innerGap,

          maxHeight: "100%",
        }}
      >
        {visualLeft
          ? texts.map(
              (block, index) =>
                renderBlock(
                  block,
                  index,
                  layout,
                  theme
                )
            )
          : renderBlock(
              visual,
              0,
              layout,
              theme
            )}
      </div>
    </div>
  );
}


// import React from "react";

// import { renderBlock } from "../layout/renderBlock.js";

// // ============================================
// // SINGLE VISUAL LAYOUT
// // ============================================

// export function SingleVisualLayout({
//   visuals = [],
//   texts = [],
// }) {
//   const visual = visuals[0];

//   const hasText = texts.length > 0;

//   const totalCharacters = texts.reduce(
//     (total, block) =>
//       total +
//       (
//         block.content ??
//         block.text ??
//         ""
//       ).length,
//     0
//   );

//   //----------------------------------------------------
//   // LARGE TEXT
//   // Put visual on top
//   //----------------------------------------------------

//   if (hasText && totalCharacters > 250) {
//     return (
//       <div
//         style={{
//           width: "100%",
//           height: "100%",

//           display: "flex",
//           flexDirection: "column",

//           justifyContent: "center",
//           alignItems: "center",

//           gap: 60,
//         }}
//       >
//         {/* VISUAL */}

//         <div
//         style={{
//             flex: 3,
//             width: "100%",
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//         }}
//         >
//         {renderBlock(
//             visual,
//             0,
//             "single-visual"
//         )}
//         </div>

//         {/* TEXT */}

//         <div
//             style={{
//                 flex: 2,
//                 width: "100%",
//                 display: "flex",
//                 flexDirection: "column",
//                 justifyContent: "center",
//                 alignItems: "center",
//                 gap: 25,
//             }}
//             >
//             {texts.map((block, index) =>
//                 renderBlock(
//                 block,
//                 index,
//                 "single-visual"
//                 )
//             )}
//         </div>
//       </div>
//     );
//   }

//   //----------------------------------------------------
//   // NO TEXT
//   //----------------------------------------------------

//   if (!hasText) {
//     return (
//       <div
//         style={{
//           width: "100%",
//           height: "100%",

//           display: "flex",

//           justifyContent: "center",

//           alignItems: "center",
//         }}
//       >
//         {renderBlock(visual, 0)}
//       </div>
//     );
//   }

//   //----------------------------------------------------
//   // NORMAL LESSON
//   // Alternate left/right
//   //----------------------------------------------------

//   const visualLeft =
//     totalCharacters % 2 === 0;

//   return (
//     <div
//       style={{
//         width: "100%",
//         height: "100%",

//         display: "flex",

//         alignItems: "center",

//         justifyContent: "space-between",

//         gap: 70,
//       }}
//     >
//       {/* LEFT */}

//       <div
//         style={{
//           flex: 1,

//           display: "flex",

//           justifyContent: "center",

//           alignItems: "center",
//         }}
//       >
//         {visualLeft
//             ? renderBlock(
//                 visual,
//                 0,
//                 "single-visual"
//                 )
//             : texts.map((block, index) =>
//                 renderBlock(
//                     block,
//                     index,
//                     "single-visual"
//                 )
//                 )}
//       </div>

//       {/* RIGHT */}

//       <div
//         style={{
//           flex: 1,

//           display: "flex",

//           flexDirection: "column",

//           justifyContent: "center",

//           alignItems: "center",

//           gap: 25,
//         }}
//       >
//         {visualLeft
//             ? texts.map((block, index) =>
//                 renderBlock(
//                     block,
//                     index,
//                     "single-visual"
//                 )
//                 )
//             : renderBlock(
//                 visual,
//                 0,
//                 "single-visual"
//                 )}
//       </div>
//     </div>
//   );
// }