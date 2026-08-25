import { Composition } from "remotion";
import { LessonVideo } from "./LessonVideo";

export const Root = () => {
  return (
    <>
      <Composition
        id="LessonVideo"
        component={LessonVideo}
        width={1920}
        height={1080}
        fps={30}
        defaultProps={{
          scenes: [],
        }}
        calculateMetadata={({ props }) => {
          const durationInFrames = (props.scenes || []).reduce(
            (total, scene) => total + (scene.durationInFrames || 150),
            0
          );

          return {
            durationInFrames,
          };
        }}
      />
    </>
  );
};