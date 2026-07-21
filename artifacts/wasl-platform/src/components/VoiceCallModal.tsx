/**
 * VoiceCallModal — ChatGPT-style voice call experience
 *
 * Flow: greeting TTS → listen (STT) → AI → TTS → listen → …
 * Voice: Salma (ElevenLabs, Saudi Arabic female) via /api/tts
 * STT:   browser Web Speech API (ar-SA)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneOff, Mic, MicOff, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
type CallState = 'greeting' | 'listening' | 'thinking' | 'speaking' | 'idle';

interface VoiceCallModalProps {
  open: boolean;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

async function authedFetch(path: string, init: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

const GREETING = 'أهلاً! أنا سلمى، مساعدتك في منصة وصل. تكلّم وأنا أسمعك.';

// ── Animated Orb ─────────────────────────────────────────────────────────────
function CallOrb({ state }: { state: CallState }) {
  const isListening = state === 'listening';
  const isSpeaking  = state === 'speaking';
  const isThinking  = state === 'thinking';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      {/* Outer pulse rings — listening */}
      {isListening && [1, 2, 3].map(i => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ border: '2px solid rgba(167,139,250,0.35)' }}
          initial={{ width: 160, height: 160, opacity: 0.7 }}
          animate={{ width: 160 + i * 55, height: 160 + i * 55, opacity: 0 }}
          transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.55, ease: 'easeOut' }}
        />
      ))}

      {/* Glow ring — speaking */}
      {isSpeaking && (
        <motion.div
          className="absolute rounded-full"
          style={{ width: 180, height: 180, background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Main orb */}
      <motion.div
        className="relative w-40 h-40 rounded-full flex items-center justify-center overflow-hidden"
        style={{
          background: isThinking
            ? 'conic-gradient(from 0deg, #7c3aed, #a855f7, #6d28d9, #7c3aed)'
            : 'radial-gradient(circle at 35% 35%, #a78bfa, #7c3aed 50%, #4c1d95)',
          boxShadow: '0 0 80px rgba(124,58,237,0.55), 0 0 160px rgba(124,58,237,0.2)',
        }}
        animate={
          isListening
            ? { scale: [1, 1.06, 1] }
            : isSpeaking
            ? { scale: [1, 1.1, 1, 1.07, 1] }
            : isThinking
            ? { rotate: 360 }
            : { scale: [1, 1.03, 1] }  // idle / greeting — gentle breathe
        }
        transition={
          isThinking
            ? { duration: 2.5, repeat: Infinity, ease: 'linear' }
            : {
                duration: isListening ? 1.5 : isSpeaking ? 1.0 : 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
      >
        {/* Speaking waveform bars */}
        {isSpeaking && (
          <div className="flex items-center gap-[3px]">
            {[0.5, 0.8, 1, 0.9, 0.6, 0.8, 1, 0.9, 0.5].map((h, i) => (
              <motion.div
                key={i}
                className="w-1.5 bg-white/85 rounded-full"
                animate={{ scaleY: [h, 1, h] }}
                transition={{ duration: 0.55, repeat: Infinity, delay: i * 0.065 }}
                style={{ height: 38, transformOrigin: 'center' }}
              />
            ))}
          </div>
        )}

        {/* Mic icon — listening */}
        {isListening && <Mic className="w-14 h-14 text-white drop-shadow-lg" />}

        {/* Sparkle — thinking / greeting */}
        {(isThinking || state === 'greeting' || state === 'idle') && (
          <Sparkles className="w-14 h-14 text-white/90 drop-shadow-lg" />
        )}
      </motion.div>
    </div>
  );
}

// ── State label ───────────────────────────────────────────────────────────────
function stateLabel(s: CallState): string {
  switch (s) {
    case 'greeting':  return 'جاري الاتصال...';
    case 'listening': return 'أسمعك...';
    case 'thinking':  return 'يفكر...';
    case 'speaking':  return 'يتحدث...';
    default:          return 'جاهز';
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export function VoiceCallModal({ open, onClose }: VoiceCallModalProps) {
  const [callState, setCallState]   = useState<CallState>('idle');
  const [transcript, setTranscript] = useState('');
  const [aiText, setAiText]         = useState('');
  const [muted, setMuted]           = useState(false);
  const [duration, setDuration]     = useState(0);

  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const closedRef      = useRef(false);
  const mutedRef       = useRef(false);
  const messagesRef    = useRef<Array<{ role: string; content: string }>>([]);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  mutedRef.current = muted;

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setDuration(0);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [open]);

  function formatDuration(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  }

  // ── TTS via ElevenLabs ────────────────────────────────────────────────────
  const playTTS = useCallback(async (text: string): Promise<void> => {
    if (closedRef.current) return;
    setCallState('speaking');
    setAiText(text);

    return new Promise(async (resolve) => {
      try {
        const res = await authedFetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(`TTS ${res.status}`);
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve();
        };

        await audio.play().catch(() => resolve());
      } catch {
        resolve(); // fail silently, keep call alive
      }
    });
  }, []);

  // ── STT ───────────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (closedRef.current || mutedRef.current || !SpeechRecognitionAPI) return;

    setCallState('listening');
    setTranscript('');
    setAiText('');

    const rec = new SpeechRecognitionAPI();
    rec.lang = 'ar-SA';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onresult = (e: any) => {
      const text: string = e.results[0][0].transcript.trim();
      if (text) sendToAI(text);
    };

    rec.onerror = (e: any) => {
      if (closedRef.current) return;
      if (e.error === 'no-speech') {
        setTimeout(() => { if (!closedRef.current && !mutedRef.current) startListening(); }, 300);
      }
    };

    rec.onend = () => {
      // If we're still in listening state (no result came), restart
      // but only if sendToAI hasn't already changed state
    };

    recognitionRef.current = rec;
    try { rec.start(); } catch { /* already started */ }
  }, []); // eslint-disable-line

  // ── Send to AI ────────────────────────────────────────────────────────────
  const sendToAI = useCallback(async (text: string) => {
    if (closedRef.current) return;

    setCallState('thinking');
    setTranscript(text);

    const userMsg = { role: 'user', content: text };
    messagesRef.current = [...messagesRef.current, userMsg].slice(-12);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: messagesRef.current }),
      });

      if (!res.ok) throw new Error(`AI ${res.status}`);
      const data2 = await res.json();
      const reply: string = data2.reply ?? '';

      messagesRef.current = [...messagesRef.current, { role: 'assistant', content: reply }];

      if (!closedRef.current) {
        await playTTS(reply);
        if (!closedRef.current && !mutedRef.current) startListening();
      }
    } catch {
      if (!closedRef.current) {
        await playTTS('عذراً، حدث خطأ. تكلّم مجدداً.');
        if (!closedRef.current && !mutedRef.current) startListening();
      }
    }
  }, [playTTS, startListening]);

  // ── Call lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    closedRef.current  = false;
    mutedRef.current   = false;
    setMuted(false);
    setTranscript('');
    setAiText('');
    messagesRef.current = [];

    (async () => {
      await playTTS(GREETING);
      if (!closedRef.current) startListening();
    })();

    return () => {
      closedRef.current = true;
      recognitionRef.current?.stop();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [open]); // eslint-disable-line

  // ── Mute toggle ───────────────────────────────────────────────────────────
  function toggleMute() {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (next) {
      // Muting: stop listening
      recognitionRef.current?.stop();
      setCallState('idle');
    } else {
      // Unmuting: resume
      startListening();
    }
  }

  // ── Hang up ───────────────────────────────────────────────────────────────
  function hangUp() {
    closedRef.current = true;
    recognitionRef.current?.stop();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
          style={{ background: 'radial-gradient(ellipse at center, #1e0a3c 0%, #0a0015 60%, #000 100%)' }}
        >
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 pt-10 pb-4">
            <div>
              <p className="text-white/90 font-semibold text-lg">Wasl AI · سلمى</p>
              <p className="text-violet-300/70 text-sm tabular-nums">{formatDuration(duration)}</p>
            </div>
            <div className={cn(
              'px-3 py-1 rounded-full text-xs font-medium',
              callState === 'listening'
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : callState === 'speaking'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-400/30'
                : callState === 'thinking'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                : 'bg-white/10 text-white/50 border border-white/10'
            )}>
              {stateLabel(callState)}
            </div>
          </div>

          {/* Orb */}
          <div className="flex flex-col items-center gap-8">
            <CallOrb state={callState} />

            {/* Transcript / AI text */}
            <div className="h-16 flex flex-col items-center justify-center gap-1 px-8 text-center">
              <AnimatePresence mode="wait">
                {transcript && (
                  <motion.p
                    key={transcript}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-white/50 text-sm"
                    dir="rtl"
                  >
                    {transcript}
                  </motion.p>
                )}
              </AnimatePresence>
              <AnimatePresence mode="wait">
                {aiText && callState === 'speaking' && (
                  <motion.p
                    key={aiText.slice(0, 40)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-violet-200/80 text-sm line-clamp-2 leading-relaxed"
                    dir="rtl"
                  >
                    {aiText.length > 120 ? aiText.slice(0, 120) + '...' : aiText}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-8 pb-14">
            {/* Mute */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleMute}
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center transition-all',
                muted
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/10 text-white/70 border border-white/10 hover:bg-white/15'
              )}
              aria-label={muted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
            >
              {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </motion.button>

            {/* Hang up */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={hangUp}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-xl shadow-red-500/40 transition-all"
              aria-label="إنهاء المكالمة"
              style={{ boxShadow: '0 0 30px rgba(239,68,68,0.5)' }}
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </motion.button>

            {/* Spacer to center hang-up */}
            <div className="w-14 h-14" />
          </div>

          {/* No STT fallback */}
          {!SpeechRecognitionAPI && (
            <div className="absolute bottom-32 px-6 py-3 bg-red-500/20 border border-red-400/30 rounded-xl text-red-300 text-sm text-center">
              المتصفح لا يدعم التعرف على الصوت. استخدم Chrome أو Edge.
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
