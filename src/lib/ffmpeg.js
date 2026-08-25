import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";

ffmpeg.setFfmpegPath(
  ffmpegPath
);

ffmpeg.setFfprobePath(
  ffprobePath.path
);

export default ffmpeg;