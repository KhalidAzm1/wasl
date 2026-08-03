import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, RotateCcw, Mic, MicOff, MessageCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { applyMutationInvalidations } from '@/lib/mutation-invalidations';

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
  content: `مرحباً! أنا **نور**، وكيلتك التنفيذية الذكية في منصة وصل 🏦

أقدر أنفّذ **أي إجراء** في النظام مباشرةً:

• 📊 استعراض حالة أي بنك والتقارير الشاملة
• ✏️ تحديث البنوك — الحالة، المسؤول، الملخص، وأكثر
• 🏦 إنشاء بنك جديد أو أرشفته أو استعادته
• 📅 إضافة اجتماعات وتعديلها وحذفها
• ⚠️ تسجيل المخاطر وإغلاقها
• ✅ إدارة بنود الإجراءات — إضافة، تعديل، إغلاق
• 📋 التقرير الأسبوعي التنفيذي الكامل

فقط أخبرني بما تريد وأنا أنفّذ.`,
};

const QUICK_PROMPTS = [
  { label: '📋 تقرير أسبوعي', text: 'اصنعي لي تقريراً أسبوعياً كاملاً' },
  { label: '🚨 بنوك عالية الخطر', text: 'أريني البنوك المتأخرة أو عالية المخاطر' },
  { label: '📊 مقارنة بنكين', text: 'قارني بنك الراجحي مع البنك الأهلي' },
  { label: '🔍 بحث متقدم', text: 'أريني البنوك التي لم تبدأ بعد وخطرها عالي' },
  { label: '📇 جهات الاتصال', text: 'أريني جهات الاتصال وأرقام الجوال لبنك الراجحي' },
  { label: '✅ إجراءات متأخرة', text: 'أرني بنود الإجراءات المتأخرة عن موعدها' },
];

// ── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, j) =>
    j % 2 === 1 ? <strong key={j} className="font-semibold">{part}</strong> : part
  );
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^## /.test(line)) {
      nodes.push(
        <div key={i} className="flex items-center gap-2 mt-4 mb-1.5 pt-3 border-t border-white/10 first:pt-0 first:mt-2 first:border-t-0">
          <span className="font-bold text-sm text-white/90">{renderInline(line.replace(/^## /, ''))}</span>
        </div>
      );
    } else if (/^# /.test(line)) {
      nodes.push(
        <p key={i} className="font-bold text-base mt-2 mb-1">
          {renderInline(line.replace(/^# /, ''))}
        </p>
      );
    } else if (/^[•\-\*] /.test(line.trim())) {
      nodes.push(
        <div key={i} className="flex gap-2 items-start py-0.5">
          <span className="text-blue-300 mt-0.5 shrink-0">•</span>
          <span className="leading-relaxed text-sm">{renderInline(line.trim().replace(/^[•\-\*] /, ''))}</span>
        </div>
      );
    } else if (/^\d+\. /.test(line.trim())) {
      const num = line.trim().match(/^(\d+)\./)?.[1];
      nodes.push(
        <div key={i} className="flex gap-2 items-start py-0.5">
          <span className="text-blue-300 shrink-0 font-mono text-xs mt-0.5 w-4 text-right">{num}.</span>
          <span className="leading-relaxed text-sm">{renderInline(line.trim().replace(/^\d+\. /, ''))}</span>
        </div>
      );
    } else if (line.trim() === '') {
      nodes.push(<div key={i} className="h-1" />);
    } else {
      nodes.push(
        <p key={i} className="leading-relaxed text-sm">
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }

  return <div className="space-y-0.5">{nodes}</div>;
}

// ── Speech Recognition ───────────────────────────────────────────────────────
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

// ── Avatar ───────────────────────────────────────────────────────────────────
function NoorAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-11 h-11 text-base' : 'w-9 h-9 text-sm';
  return (
    <div className={cn(
      'shrink-0 rounded-full flex items-center justify-center font-bold text-white shadow-lg',
      'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700',
      dims
    )}>
      ن
    </div>
  );
}

function UserAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={cn(
      'shrink-0 rounded-full flex items-center justify-center font-bold text-white shadow-md',
      'bg-gradient-to-br from-slate-500 to-slate-700',
      dims
    )}>
      أ
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex gap-2 items-end justify-end"
      >
        <div className="max-w-[78%] bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-md">
          <p className="text-sm leading-relaxed" dir="auto">{msg.content}</p>
        </div>
        <UserAvatar size="sm" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-2 items-end"
    >
      <NoorAvatar size="sm" />
      <div className="max-w-[82%] bg-white/8 border border-white/10 text-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm backdrop-blur-sm">
        <div dir="rtl">{renderMarkdown(msg.content)}</div>
      </div>
    </motion.div>
  );
}

// ── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-2 items-end">
      <NoorAvatar size="sm" />
      <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3.5 flex gap-1.5 items-center">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-blue-400"
            animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Mic Pulse ─────────────────────────────────────────────────────────────────
function MicPulse() {
  return (
    <div className="relative flex items-center justify-center">
      {[1, 2, 3].map(i => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-red-400/50"
          initial={{ width: 36, height: 36, opacity: 0.8 }}
          animate={{ width: 36 + i * 20, height: 36 + i * 20, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}
      <div className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
        <Mic className="w-4 h-4 text-white" />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function WaslAIChat() {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([WELCOME]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError]   = useState<string | null>(null);
  const [showQuick, setShowQuick] = useState(true);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  // ── STT ────────────────────────────────────────────────────────────────────
  function startListening() {
    if (!SpeechRecognitionAPI) {
      setMicError('المتصفح لا يدعم التعرف على الصوت. جرّب Chrome.');
      return;
    }
    setMicError(null);
    const rec = new SpeechRecognitionAPI();
    rec.lang = 'ar-SA';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart  = () => setListening(true);
    rec.onresult = (e: any) => {
      const t: string = e.results[0][0].transcript.trim();
      setListening(false);
      if (t) sendMessage(t);
    };
    rec.onerror  = (e: any) => {
      setListening(false);
      if (e.error === 'not-allowed') setMicError('يرجى السماح بالوصول للميكروفون.');
      else if (e.error !== 'no-speech') setMicError('لم يُتعرف على الكلام، حاول مجدداً.');
    };
    rec.onend    = () => setListening(false);
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

    setShowQuick(false);
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
      const replyText: string = data.reply ?? data.error ?? 'حدث خطأ، يرجى المحاولة مجدداً.';
      setMessages((prev) => [...prev, { role: 'assistant', content: replyText }]);

      // ── Invalidate stale queries after any write action ──────────────────────
      const mut = data.mutations as { banks?: boolean; meetings?: boolean; risks?: boolean; mutatedBankIds?: string[] } | undefined;
      if (mut) {
        await applyMutationInvalidations(queryClient, mut);
      }
      if (mut?.banks || mut?.meetings || mut?.risks) {
        toast({
          title: 'تم تحديث البيانات',
          description: 'تم حفظ التغييرات وتحديث لوحة التحكم تلقائياً.',
        });
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً.',
      }]);
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
    stopListening();
    setMessages([WELCOME]);
    setInput('');
    setMicError(null);
    setShowQuick(true);
  }

  const hasSpeechRecognition = !!SpeechRecognitionAPI;
  const isMultiLine = messages.length > 1;

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setOpen(true)}
            aria-label="افتح مساعد نور"
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full shadow-2xl px-4 py-3 bg-gradient-to-l from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 transition-colors"
            style={{ boxShadow: '0 0 32px rgba(59,130,246,0.5)' }}
          >
            {/* Avatar circle */}
            <div className="w-8 h-8 rounded-full bg-white/15 border border-white/30 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">ن</span>
            </div>
            {/* Label */}
            <div className="text-right leading-tight">
              <p className="text-white font-semibold text-sm">نور</p>
              <p className="text-white/60 text-[10px]">مساعدة وصل AI</p>
            </div>
            {/* Chat icon */}
            <MessageCircle className="w-4 h-4 text-white/50 shrink-0" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              dir="rtl"
              className="fixed bottom-6 right-6 z-50 flex flex-col w-[93vw] max-w-[420px] h-[78vh] max-h-[640px] rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
                border: '1px solid rgba(99,102,241,0.25)',
                boxShadow: '0 0 80px rgba(59,130,246,0.12), 0 30px 60px rgba(0,0,0,0.5)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center gap-3 px-4 py-3 shrink-0 border-b"
                style={{ borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(30,27,75,0.8)' }}
              >
                <NoorAvatar size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-white">نور</p>
                    <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full">
                      متصلة
                    </span>
                  </div>
                  <p className="text-xs text-white/40">
                    {listening ? '🎤 جاري الاستماع...' : 'مساعدة ذكاء اصطناعي · منصة وصل'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={reset}
                    title="محادثة جديدة"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    title="إغلاق"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-white/10">
                {messages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} />
                ))}

                {/* Quick prompts — shown only after welcome */}
                <AnimatePresence>
                  {showQuick && !loading && messages.length === 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="flex flex-wrap gap-2 mt-1"
                    >
                      {QUICK_PROMPTS.map((q) => (
                        <button
                          key={q.text}
                          onClick={() => sendMessage(q.text)}
                          className="text-xs px-3 py-1.5 rounded-full border border-blue-500/30 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-200 transition-all"
                        >
                          {q.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

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
                    className="absolute inset-x-4 bottom-24 flex flex-col items-center gap-3 rounded-2xl py-6 shadow-xl"
                    style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(239,68,68,0.3)' }}
                  >
                    <MicPulse />
                    <p className="text-sm text-white/70 font-medium">جاري الاستماع...</p>
                    <button onClick={stopListening} className="text-xs text-red-400 hover:text-red-300">
                      اضغط للإيقاف
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mic error */}
              <AnimatePresence>
                {micError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mx-3 mb-1 px-3 py-1.5 rounded-lg text-xs text-red-400 text-center"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    {micError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input */}
              <div
                className="px-3 py-3 shrink-0 border-t"
                style={{ borderColor: 'rgba(99,102,241,0.15)', background: 'rgba(15,23,42,0.6)' }}
              >
                <div
                  className="flex gap-2 items-end rounded-xl px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اسأل نور عن أي بنك..."
                    rows={1}
                    disabled={loading || listening}
                    dir="auto"
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 resize-none outline-none leading-relaxed max-h-28 disabled:opacity-50"
                  />

                  {hasSpeechRecognition && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={listening ? stopListening : startListening}
                      disabled={loading}
                      className={cn(
                        'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30',
                        listening
                          ? 'bg-red-500 text-white'
                          : 'text-white/40 hover:text-white hover:bg-white/10'
                      )}
                    >
                      {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </motion.button>
                  )}

                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
                  >
                    {loading
                      ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                      : <Send className="w-3.5 h-3.5 text-white" />
                    }
                  </button>
                </div>

                <p className="text-center text-[10px] text-white/20 mt-1.5">
                  نور AI · اضغط Enter للإرسال أو 🎤 للتحدث
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
