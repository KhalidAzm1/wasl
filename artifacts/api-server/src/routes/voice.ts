/**
 * Voice routes — ElevenLabs TTS
 *
 * POST /api/tts   { text: string } → audio/mpeg
 *
 * Uses the Replit ElevenLabs connector (managed credentials).
 * Voice: Salma (aCChyB4P5WEomwRsOKRh) — conversational Arabic female.
 * Model: eleven_multilingual_v2 for best Arabic quality.
 */
import { Router, type IRouter } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

const connectors = new ReplitConnectors();

// ── Saudi Arabic female voice ─────────────────────────────────────────────────
const VOICE_ID = "aCChyB4P5WEomwRsOKRh"; // Salma — Conversational Expressive Arabic
const MODEL_ID = "eleven_multilingual_v2";

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`[^`]+`/g, "")
    .replace(/[-•]\s/g, "")
    .replace(/\d+\.\s/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// POST /api/tts
router.post("/api/tts", async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const clean = stripMarkdown(text).slice(0, 3000); // ElevenLabs limit
  if (!clean) {
    res.status(400).json({ error: "text is empty after stripping" });
    return;
  }

  try {
    const response = await connectors.proxy(
      "elevenlabs",
      `/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: clean,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.85,
            style: 0.25,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[tts] ElevenLabs error:", response.status, errText);
      res.status(502).json({ error: "TTS upstream error" });
      return;
    }

    const audioBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.set("Cache-Control", "no-cache");
    res.send(Buffer.from(audioBuffer));
  } catch (err: any) {
    console.error("[tts] error:", err?.message ?? err);
    res.status(500).json({ error: "TTS failed" });
  }
});

export default router;
