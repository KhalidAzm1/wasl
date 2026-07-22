/**
 * Voice routes
 *
 * GET /api/tts-config  → { voiceId, apiKey } for authenticated browser-direct TTS
 *
 * The browser calls ElevenLabs directly to avoid Replit's VPN/proxy
 * being flagged by ElevenLabs' Free Tier unusual-activity detection.
 */
import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

const VOICE_ID = "aCChyB4P5WEomwRsOKRh"; // Salma — Conversational Expressive Arabic

// GET /api/tts-config — return config to authenticated browser
router.get("/tts-config", (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  if (!apiKey) {
    res.status(503).json({ error: "ELEVENLABS_API_KEY not configured" });
    return;
  }
  res.json({ voiceId: VOICE_ID, apiKey });
});

export default router;
