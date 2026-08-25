import React from "react";

import {
  AbsoluteFill,
  Sequence,
} from "remotion";

import { SceneRenderer } from "./SceneRenderer.jsx";
import { MySchoolLearnWatermark } from "./components/MySchoolLearnLogo.jsx";

// =====================================
// LESSON VIDEO
// =====================================

export const LessonVideo = ({
  scenes = [],
}) => {
  let frameCursor = 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ffffff",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {scenes.map((scene, index) => {
        const from = frameCursor;

        const duration =
          scene.durationInFrames ?? 150;

        frameCursor += duration;

        return (
          <Sequence
            key={
              scene.sceneId ??
              index
            }
            from={from}
            durationInFrames={duration}
          >
            <SceneRenderer
              scene={scene}
            />
          </Sequence>
        );
      })}

      <MySchoolLearnWatermark />

    </AbsoluteFill>
  );
};


// import React from "react";

// import {
//   AbsoluteFill,
//   Sequence,
// } from "remotion";

// import { SceneRenderer } from "./SceneRenderer.jsx";
// import { MySchoolLearnWatermark } from "./components/MySchoolLearnLogo.jsx";

// // =====================================
// // LESSON VIDEO
// // =====================================

// export const LessonVideo = ({
//   scenes = [],
// }) => {
//   let frameCursor = 0;

//   return (
//     <AbsoluteFill
//       style={{
//         backgroundColor: "#ffffff",
//         fontFamily:
//           "Arial, sans-serif",
//       }}
//     >
//       {scenes.map(
//         (scene, index) => {
//           const from =
//             frameCursor;

//           const duration =
//             scene.durationInFrames ??
//             150;

//           frameCursor +=
//             duration;

//           return (
//             <Sequence
//               key={
//                 scene.sceneId ??
//                 index
//               }
//               from={from}
//               durationInFrames={
//                 duration
//               }
//             >
//               <SceneRenderer
//                 scene={scene}
//               />
//             </Sequence>
//           );
//         }
//       )}
//     </AbsoluteFill>
//   );
// };