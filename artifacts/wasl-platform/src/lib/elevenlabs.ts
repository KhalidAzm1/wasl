/**
 * Browser-direct ElevenLabs TTS
 *
 * The browser calls ElevenLabs directly (not via the Replit server) so the
 * request comes from the user's real IP address, bypassing Replit's VPN/proxy
 * which ElevenLabs blocks on Free Tier accounts.
 */
import { supabase } from '@/lib/supabaseClient';

interface TTSConfig {
  voiceId: string;
  apiKey:  string;
}

let cachedConfig: TTSConfig | null = null;

async function fetchTTSConfig(): Promise<TTSConfig> {
  if (cachedConfig) return cachedConfig;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch('/api/tts-config', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`tts-config ${res.status}`);
  const cfg = await res.json() as TTSConfig;
  cachedConfig = cfg;
  return cfg;
}

export function clearTTSCache() {
  cachedConfig = null;
}

const MODEL_ID = 'eleven_multilingual_v2';

export function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/[-•]\s/g, '')
    .replace(/\d+\.\s/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Convert text to speech using ElevenLabs from the browser.
 * Returns an AudioBuffer URL (caller is responsible for revoking it).
 */
export async function elevenLabsTTS(text: string): Promise<string> {
  const clean = stripMarkdown(text).slice(0, 3000);
  if (!clean) throw new Error('empty text');

  const { voiceId, apiKey } = await fetchTTSConfig();

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
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

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${err}`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
