import { generateSpeech } from "../services/elevenLabs/elevenlabs.service.js";

export async function speakTutor(req, res) {
  try {
    const { text, voiceId } = req.body;

    const audio = await generateSpeech(text, voiceId);

    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audio);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Voice generation failed",
    });
  }
}