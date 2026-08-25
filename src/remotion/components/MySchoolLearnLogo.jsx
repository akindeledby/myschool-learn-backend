import { Img } from "remotion";
import logo from "../assets/MySchoolLearn-logo.png";

export const MySchoolLearnWatermark = () => {
  return (
    <Img
      src={logo}
      style={{
        position: "absolute",
        top: 30,
        right: 30,
        width: 220,
        height: "auto",
        opacity: 0.70,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    />
  );
};