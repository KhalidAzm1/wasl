import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, RotateCcw, Mic, MicOff, MessageCircle, ChevronDown } from 'lucide-react';
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
  content: `مرحباً! أنا **نور**، وكيلتك التنفيذية في منصة وصل 🏦

أقدر أنفّذ أي إجراء في النظام مباشرةً:

• 📊 استعراض وتحليل حالة البنوك والتقارير
• ✏️ تحديث البنوك — الحالة، المسؤول، الملخص
• 🏦 إنشاء بنك / أرشفته / استعادته
• ✅ تحديث مراحل التنفيذ
• 📅 إدارة الاجتماعات — إضافة، تعديل، حذف
• ⚠️ إدارة المخاطر — تسجيل وإغلاق
• 📋 إدارة بنود الإجراءات
• 📇 جهات الاتصال وأرقام الجوال
• 🔍 البحث بمعايير ومقارنة البنوك

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

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, j) =>
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
        <div key={i} className="mt-4 mb-2 pb-1 border-b border-white/10 first:mt-1">
          <span className="font-bold text-sm text-blue-200">{renderInline(line.replace(/^## /, ''))}</span>
        </div>
      );
    } else if (/^# /.test(line)) {
      nodes.push(
        <p key={i} className="font-bold text-base mt-2 mb-1 text-white">
          {renderInline(line.replace(/^# /, ''))}
        </p>
      );
    } else if (/^[•\-\*] /.test(line.trim())) {
      nodes.push(
        <div key={i} className="flex gap-2 items-start py-[2px]">
          <span className="text-blue-300 mt-[3px] shrink-0 text-xs">•</span>
          <span className="leading-relaxed text-[13.5px] text-white/90">
            {renderInline(line.trim().replace(/^[•\-\*] /, ''))}
          </span>
        </div>
      );
    } else if (/^\d+\. /.test(line.trim())) {
      const num = line.trim().match(/^(\d+)\./)?.[1];
      nodes.push(
        <div key={i} className="flex gap-2 items-start py-[2px]">
          <span className="text-blue-300 shrink-0 font-mono text-xs mt-[3px] w-4 text-left">{num}.</span>
          <span className="leading-relaxed text-[13.5px] text-white/90">
            {renderInline(line.trim().replace(/^\d+\. /, ''))}
          </span>
        </div>
      );
    } else if (line.trim() === '') {
      nodes.push(<div key={i} className="h-[5px]" />);
    } else {
      nodes.push(
        <p key={i} className="leading-relaxed text-[13.5px] text-white/90">
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }
  return <div className="space-y-[1px]">{nodes}</div>;
}

// ── Speech Recognition ─────────────────────────────────────────────────────────
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

// ── Noor Avatar ───────────────────────────────────────────────────────────────
function NoorAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={cn(
      'shrink-0 rounded-full flex items-center justify-center font-bold text-white shadow-lg ring-2 ring-blue-500/30',
      'bg-gradient-to-br from-blue-500 to-indigo-700',
      cls
    )}>ن</div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2 items-end justify-start"
      >
        {/* user avatar */}
        <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white font-bold text-xs shadow ring-2 ring-white/10">
          أ
        </div>
        <div
          className="max-w-[76%] rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-md"
          style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
        >
          <p className="text-[13.5px] leading-relaxed text-white" dir="auto">{msg.content}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2 items-end justify-end"
    >
      <div
        className="max-w-[82%] rounded-2xl rounded-br-sm px-4 py-3 shadow-sm"
        style={{
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.10)',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
        }}
        dir="rtl"
      >
        {renderMarkdown(msg.content)}
      </div>
      <NoorAvatar size="sm" />
    </motion.div>
  );
}

// ── Typing Indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-2 items-end justify-end">
      <div
        className="rounded-2xl rounded-br-sm px-4 py-3 flex gap-1.5 items-center"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-blue-400"
            animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <NoorAvatar size="sm" />
    </div>
  );
}

// ── Mic Pulse ─────────────────────────────────────────────────────────────────
function MicPulse() {
  return (
    <div className="relative flex items-center justify-center">
      {[1, 2, 3].map(i => (
        <motion.div key={i} className="absolute rounded-full border border-red-400/40"
          initial={{ width: 38, height: 38, opacity: 0.7 }}
          animate={{ width: 38 + i * 18, height: 38 + i * 18, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}
      <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  // auto-grow textarea
  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  // ── STT ──────────────────────────────────────────────────────────────────────
  function startListening() {
    if (!SpeechRecognitionAPI) { setMicError('المتصفح لا يدعم التعرف على الصوت.'); return; }
    setMicError(null);
    const rec = new SpeechRecognitionAPI();
    rec.lang = 'ar-SA'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart  = () => setListening(true);
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript.trim(); setListening(false); if (t) sendMessage(t); };
    rec.onerror  = (e: any) => { setListening(false); if (e.error === 'not-allowed') setMicError('يرجى السماح بالوصول للميكروفون.'); };
    rec.onend    = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
  }
  function stopListening() { recognitionRef.current?.stop(); setListening(false); }

  // ── Send ──────────────────────────────────────────────────────────────────────
  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setShowQuick(false);

    const userMsg: Message = { role: 'user', content };
    const contextHistory = messages
      .filter(m => !m.isWelcome).concat(userMsg).slice(-12)
      .map(({ role, content }) => ({ role, content }));

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }
    setLoading(true);

    try {
      const data = await authedPost('/api/ai/chat', { messages: contextHistory });
      const replyText: string = data.reply ?? data.error ?? 'حدث خطأ، يرجى المحاولة مجدداً.';
      setMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً.' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function reset() { stopListening(); setMessages([WELCOME]); setInput(''); setMicError(null); setShowQuick(true); }

  const hasSpeech = !!SpeechRecognitionAPI;

  return (
    <>
      {/* ── FAB ──────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setOpen(true)}
            aria-label="افتح مساعد نور"
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 240 }}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #4338ca 100%)',
              boxShadow: '0 0 30px rgba(59,130,246,0.45), 0 8px 20px rgba(0,0,0,0.3)',
            }}
          >
            <div className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center font-bold text-white text-sm shrink-0">ن</div>
            <div className="text-right leading-snug">
              <p className="text-white font-bold text-sm">نور</p>
              <p className="text-white/60 text-[11px]">وكيلة وصل الذكية</p>
            </div>
            <MessageCircle className="w-4 h-4 text-white/50 shrink-0" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Chat Panel ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setOpen(false)}
            />

            <motion.div
              dir="rtl"
              initial={{ opacity: 0, y: 28, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 28, scale: 0.94 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden"
              style={{
                width: 'min(92vw, 460px)',
                height: 'min(82vh, 660px)',
                background: 'linear-gradient(170deg, #0c1229 0%, #0f0f2e 55%, #0c1229 100%)',
                border: '1px solid rgba(99,102,241,0.2)',
                boxShadow: '0 0 90px rgba(59,130,246,0.10), 0 30px 70px rgba(0,0,0,0.55)',
              }}
            >

              {/* ── Header ─────────────────────────────────────────────────── */}
              <div
                className="flex items-center gap-3 px-4 py-3 shrink-0"
                style={{ background: 'rgba(15,15,50,0.9)', borderBottom: '1px solid rgba(99,102,241,0.18)' }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-base shadow-lg ring-2 ring-blue-500/40 shrink-0"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
                >ن</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">نور</span>
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full font-medium">● متصلة</span>
                  </div>
                  <p className="text-[11px] text-white/40">{listening ? '🎤 جاري الاستماع…' : 'وكيلة وصل الذكية · 20 إجراء'}</p>
                </div>
                <button onClick={reset} title="محادثة جديدة"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setOpen(false)} title="إغلاق"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── Messages ───────────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

                {/* Quick prompts */}
                <AnimatePresence>
                  {showQuick && !loading && messages.length === 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex flex-wrap gap-2 justify-end pt-1"
                    >
                      {QUICK_PROMPTS.map(q => (
                        <button key={q.text} onClick={() => sendMessage(q.text)}
                          className="text-[12px] px-3 py-1.5 rounded-full font-medium transition-all"
                          style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.28)', color: '#93c5fd' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.22)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.12)')}
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
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="absolute inset-x-4 bottom-24 flex flex-col items-center gap-3 rounded-2xl py-7 z-10"
                    style={{ background: 'rgba(10,12,30,0.97)', border: '1px solid rgba(239,68,68,0.25)' }}
                  >
                    <MicPulse />
                    <p className="text-sm text-white/70 font-medium">جاري الاستماع…</p>
                    <button onClick={stopListening} className="text-xs text-red-400 hover:text-red-300">اضغط للإيقاف</button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mic error */}
              <AnimatePresence>
                {micError && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="mx-3 mb-1 px-3 py-1.5 rounded-lg text-xs text-red-400 text-center"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}
                  >
                    {micError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Input ──────────────────────────────────────────────────── */}
              <div
                className="px-3 py-3 shrink-0"
                style={{ borderTop: '1px solid rgba(99,102,241,0.15)', background: 'rgba(8,10,25,0.7)' }}
              >
                {/* Row: RTL → visually RIGHT = first child */}
                <div
                  dir="rtl"
                  className="flex items-end gap-2 rounded-xl px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
                >
                  {/* Send — first in RTL = appears on RIGHT */}
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
                    style={{ background: (!input.trim() || loading) ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
                  >
                    {loading
                      ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                      : <Send className="w-4 h-4 text-white" style={{ transform: 'scaleX(-1)' }} />
                    }
                  </button>

                  {/* Textarea — middle */}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => { setInput(e.target.value); autoGrow(e.target); }}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب رسالتك لنور…"
                    rows={1}
                    disabled={loading || listening}
                    dir="auto"
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 resize-none outline-none leading-relaxed disabled:opacity-50"
                    style={{ minHeight: '36px', maxHeight: '120px', paddingTop: '8px', paddingBottom: '8px' }}
                  />

                  {/* Mic — last in RTL = appears on LEFT */}
                  {hasSpeech && (
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={listening ? stopListening : startListening}
                      disabled={loading}
                      className={cn(
                        'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30',
                        listening ? 'bg-red-500 shadow-lg shadow-red-500/30' : 'text-white/40 hover:text-white hover:bg-white/8'
                      )}
                    >
                      {listening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4" />}
                    </motion.button>
                  )}
                </div>

                <p className="text-center text-[10px] text-white/20 mt-2">
                  نور AI · اضغط Enter للإرسال · Shift+Enter لسطر جديد
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
