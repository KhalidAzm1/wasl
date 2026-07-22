/**
 * Browser-direct ElevenLabs TTS
 *
 * The browser calls ElevenLabs directly (not via the Replit server) so the
 * request comes from the user's real IP address, bypassing Replit's VPN/proxy
 * which ElevenLabs blocks on Free Tier accounts.
 *
 * Audio is played via Web Audio API (AudioContext) so autoplay policy is not
 * an issue — the context must be unlocked once by calling unlockAudio() on a
 * user-gesture handler before the first TTS play.
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

// ── AudioContext singleton ─────────────────────────────────────────────────────
let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new AudioContext();
  }
  return _audioCtx;
}

/**
 * Must be called once inside a direct user-gesture handler (e.g. button onClick)
 * to unlock the AudioContext so subsequent async plays work without restriction.
 */
export async function unlockAudio(): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    // Play a 0-length silent buffer to fully unlock
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    console.log('[TTS] AudioContext unlocked, state:', ctx.state);
  } catch (e) {
    console.warn('[TTS] unlockAudio failed:', e);
  }
}

/**
 * Convert text to speech using ElevenLabs from the browser.
 * Plays audio via Web Audio API — resolves when playback ends.
 */
export async function elevenLabsTTS(text: string): Promise<void> {
  const clean = stripMarkdown(text).slice(0, 3000);
  if (!clean) throw new Error('empty text');

  console.log('[TTS] Fetching config...');
  const { voiceId, apiKey } = await fetchTTSConfig();
  console.log('[TTS] voiceId:', voiceId, '| text length:', clean.length);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
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

  console.log('[TTS] Audio received, decoding...');
  const arrayBuffer = await res.arrayBuffer();

  // Decode and play via AudioContext (bypasses autoplay restrictions)
  return new Promise((resolve, reject) => {
    const ctx = getAudioContext();

    ctx.resume().then(() => {
      ctx.decodeAudioData(
        arrayBuffer,
        (decoded) => {
          console.log('[TTS] Playing audio, duration:', decoded.duration.toFixed(1), 's');
          const src = ctx.createBufferSource();
          src.buffer = decoded;
          src.connect(ctx.destination);
          src.onended = () => {
            console.log('[TTS] Playback ended');
            resolve();
          };
          src.start(0);
        },
        (err) => {
          console.error('[TTS] decodeAudioData failed:', err);
          reject(err);
        }
      );
    }).catch(reject);
  });
}
