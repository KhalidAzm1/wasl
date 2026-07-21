import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, User, Loader2, Sparkles, RotateCcw, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

async function authedPost(path: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isWelcome?: boolean;
}

const WELCOME: Message = {
  role: 'assistant',
  isWelcome: true,
  content: `مرحباً! أنا **Wasl AI** 🏦

أنا مساعدك الذكي المتخصص في بيانات البنوك على منصة وصل. يمكنني مساعدتك في:

• 📊 حالة أي بنك وتقدم التنفيذ
• ⚠️ المخاطر والإجراءات المفتوحة
• 📅 الاجتماعات القادمة
• ✏️ تحديث بيانات البنوك مباشرة

اسألني بالعربي أو الإنجليزي — أو اضغط 🎤 وكلمني!`,
};

// ── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, j) =>
    j % 2 === 1 ? <strong key={j}>{part}</strong> : part
  );
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^# /.test(line)) {
      nodes.push(
        <p key={i} className="font-bold text-base mt-2 mb-1 text-foreground">
          {renderInline(line.replace(/^# /, ''))}
        </p>
      );
    } else if (/^## /.test(line)) {
      nodes.push(
        <p key={i} className="font-semibold text-sm mt-3 mb-1 border-b border-foreground/10 pb-0.5 text-foreground">
          {renderInline(line.replace(/^## /, ''))}
        </p>
      );
    } else if (/^### /.test(line)) {
      nodes.push(
        <p key={i} className="font-semibold text-xs mt-2 mb-0.5 text-muted-foreground uppercase tracking-wide">
          {renderInline(line.replace(/^### /, ''))}
        </p>
      );
    } else if (line.trim() === '') {
      nodes.push(<div key={i} className="h-1" />);
    } else {
      nodes.push(
        <p key={i} className="leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }
  return nodes;
}

// ── Strip markdown for TTS ───────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,3} /g, '')         // headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1')     // italic
    .replace(/[-•]\s/g, '')           // bullets
    .replace(/\d+\.\s/g, '')          // numbered lists
    .replace(/\n{2,}/g, '. ')         // blank lines → pause
    .replace(/\n/g, ' ')
    .trim();
}

// ── Speech helpers ───────────────────────────────────────────────────────────

const SpeechRecognitionAPI =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

function pickArabicFemaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  // Prefer Saudi Arabic female, then any Arabic female, then any Arabic
  const arVoices = voices.filter(v => v.lang.startsWith('ar'));
  const female = arVoices.find(v =>
    /hala|fatima|layla|zira|female|woman|نسائي|هلا|ليلى|فاطمة/i.test(v.name)
  );
  return female ?? arVoices[0] ?? null;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex gap-2 items-start', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs',
        isUser ? 'bg-primary' : 'bg-gradient-to-br from-violet-500 to-purple-700'
      )}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div className={cn(
        'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : 'bg-card border border-foreground/10 text-foreground rounded-tl-sm'
      )}>
        {renderMarkdown(msg.content)}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2 items-start">
      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-700">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-card border border-foreground/10 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-foreground/40"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

/** Animated mic pulse rings shown while listening */
function MicPulse() {
  return (
    <div className="relative flex items-center justify-center">
      {[1, 2, 3].map(i => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-red-400/60"
          initial={{ width: 32, height: 32, opacity: 0.8 }}
          animate={{ width: 32 + i * 18, height: 32 + i * 18, opacity: 0 }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3, ease: 'easeOut' }}
        />
      ))}
      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40">
        <Mic className="w-4 h-4 text-white" />
      </div>
    </div>
  );
}

/** Animated sound wave shown while AI is speaking */
function SpeakingWave() {
  return (
    <div className="flex items-center gap-[3px]">
      {[0.4, 0.7, 1, 0.7, 0.4].map((h, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-violet-400"
          animate={{ scaleY: [h, 1, h] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
          style={{ height: 16, transformOrigin: 'center' }}
        />
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function WaslAIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Trigger voices load (Chrome lazy-loads them)
  useEffect(() => {
    const load = () => setVoicesReady(true);
    if (window.speechSynthesis.getVoices().length > 0) {
      setVoicesReady(true);
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', load);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  // Stop speaking when chat closes; auto-greet when it opens
  useEffect(() => {
    if (!open) {
      stopSpeaking();
    } else {
      // Small delay so voices finish loading before we speak
      const timer = setTimeout(() => {
        speak('أهلاً! أنا مساعدك الشخصي في وصل. كيف أقدر أخدمك؟');
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // ── TTS ────────────────────────────────────────────────────────────────────

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    stopSpeaking();

    const clean = stripMarkdown(text);
    if (!clean) return;

    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'ar-SA';
    utter.rate = 0.95;
    utter.pitch = 1.05;

    // Load voice (may need another tick after voiceschanged)
    const voice = pickArabicFemaleVoice();
    if (voice) utter.voice = voice;

    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);

    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [voicesReady]); // re-create when voices become available

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    utteranceRef.current = null;
  }

  // ── STT ────────────────────────────────────────────────────────────────────

  function startListening() {
    if (!SpeechRecognitionAPI) {
      setMicError('المتصفح لا يدعم التعرف على الصوت. استخدم Chrome.');
      return;
    }
    setMicError(null);
    stopSpeaking();

    const rec = new SpeechRecognitionAPI();
    rec.lang = 'ar-SA';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);

    rec.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript.trim();
      setListening(false);
      if (transcript) {
        // Auto-send the recognized text
        sendMessage(transcript);
      }
    };

    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error === 'not-allowed') {
        setMicError('يرجى السماح للمتصفح باستخدام الميكروفون.');
      } else if (e.error !== 'no-speech') {
        setMicError('لم يُتعرف على الكلام، حاول مجدداً.');
      }
    };

    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    rec.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = { role: 'user', content };
    const contextHistory = messages
      .filter((m) => !m.isWelcome)
      .concat(userMsg)
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await authedPost('/api/ai/chat', { messages: contextHistory });
      const replyText: string = data.reply ?? data.error ?? 'حدث خطأ، حاول مرة أخرى.';
      const reply: Message = { role: 'assistant', content: replyText };
      setMessages((prev) => [...prev, reply]);

      // Auto-speak if the user used the mic
      if (text !== undefined) {
        speak(replyText);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'تعذّر الاتصال بالخادم. تحقق من الاتصال وحاول مجدداً.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function reset() {
    stopSpeaking();
    stopListening();
    setMessages([WELCOME]);
    setInput('');
    setMicError(null);
  }

  const hasSpeechRecognition = !!SpeechRecognitionAPI;

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
            aria-label="فتح Wasl AI"
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-gradient-to-br from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 transition-all"
            style={{ boxShadow: '0 0 30px rgba(124,58,237,0.4)' }}
          >
            <Sparkles className="w-6 h-6 text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm md:hidden"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="fixed bottom-6 right-6 z-50 flex flex-col w-[92vw] max-w-[400px] h-[75vh] max-h-[620px] bg-background/95 backdrop-blur-2xl border border-foreground/10 rounded-2xl shadow-2xl overflow-hidden"
              style={{ boxShadow: '0 0 60px rgba(124,58,237,0.15), 0 25px 50px rgba(0,0,0,0.3)' }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-foreground/10 bg-gradient-to-r from-violet-600/20 to-purple-700/10 shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shrink-0">
                  {speaking ? <SpeakingWave /> : <Sparkles className="w-4 h-4 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">Wasl AI</p>
                  <p className="text-xs text-foreground/50">
                    {listening ? '🎤 أستمع إليك...' : speaking ? '🔊 أتحدث...' : 'مساعد بيانات البنوك'}
                  </p>
                </div>
                <div className="flex gap-1">
                  {/* Mute / unmute speaking */}
                  {speaking && (
                    <button
                      onClick={stopSpeaking}
                      aria-label="إيقاف الصوت"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-violet-400 hover:text-foreground hover:bg-foreground/10 transition-colors"
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={reset}
                    aria-label="محادثة جديدة"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="إغلاق"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 hide-scrollbar">
                {messages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} />
                ))}
                {loading && <TypingIndicator />}
                <div ref={bottomRef} />
              </div>

              {/* Listening overlay */}
              <AnimatePresence>
                {listening && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute inset-x-4 bottom-20 flex flex-col items-center gap-3 bg-background/95 border border-red-400/30 rounded-2xl py-6 shadow-xl backdrop-blur-xl"
                  >
                    <MicPulse />
                    <p className="text-sm text-foreground/70 font-medium">أستمع إليك...</p>
                    <button
                      onClick={stopListening}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      اضغط للإيقاف
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mic error */}
              <AnimatePresence>
                {micError && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mx-3 mb-1 px-3 py-1.5 bg-red-500/10 border border-red-400/20 rounded-lg text-xs text-red-400 text-center"
                  >
                    {micError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input row */}
              <div className="px-3 py-3 border-t border-foreground/10 shrink-0">
                <div className="flex gap-2 items-end bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اسألني عن أي بنك..."
                    rows={1}
                    disabled={loading || listening}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/40 resize-none outline-none leading-relaxed max-h-28 disabled:opacity-50"
                    style={{ direction: input && /[\u0600-\u06FF]/.test(input[0]) ? 'rtl' : 'ltr' }}
                  />

                  {/* Mic button */}
                  {hasSpeechRecognition && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={listening ? stopListening : startListening}
                      disabled={loading}
                      aria-label={listening ? 'إيقاف الميكروفون' : 'تحدث'}
                      className={cn(
                        'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30',
                        listening
                          ? 'bg-red-500 text-white shadow-lg shadow-red-500/40'
                          : 'bg-foreground/10 text-foreground/60 hover:bg-foreground/20 hover:text-foreground'
                      )}
                    >
                      {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </motion.button>
                  )}

                  {/* Send button */}
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="shrink-0 w-8 h-8 rounded-lg bg-primary disabled:opacity-30 flex items-center justify-center text-primary-foreground transition-all hover:bg-primary/80 active:scale-95"
                  >
                    {loading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Send className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>

                {/* Status hint */}
                <p className="text-center text-[10px] text-foreground/30 mt-1.5">
                  {hasSpeechRecognition
                    ? 'Wasl AI · اكتب أو اضغط 🎤 وتكلم'
                    : 'Wasl AI · متخصص في بيانات البنوك'}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
