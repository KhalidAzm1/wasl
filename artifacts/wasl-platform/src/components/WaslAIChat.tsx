import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, RotateCcw, Mic, MicOff, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

/* ─── global animation styles injected once ─────────────────────────────── */
const injectStyles = () => {
  if (document.getElementById('waslaawi-styles')) return;
  const s = document.createElement('style');
  s.id = 'waslaawi-styles';
  s.textContent = `
    @property --wa-angle {
      syntax: '<angle>';
      initial-value: 0deg;
      inherits: false;
    }
    @keyframes wa-spin   { to { --wa-angle: 360deg } }
    @keyframes wa-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
    @keyframes wa-ripple { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.4);opacity:0} }
    @keyframes wa-shimmer{
      0%  { background-position: -200% 0 }
      100%{ background-position:  200% 0 }
    }
    .wa-border-wrap {
      --wa-angle: 0deg;
      background: conic-gradient(from var(--wa-angle),
        #3B82F6 0%, #818CF8 20%, #A78BFA 40%,
        #F59E0B 55%, #A78BFA 70%, #818CF8 85%, #3B82F6 100%);
      animation: wa-spin 6s linear infinite;
      border-radius: 22px;
      padding: 1.5px;
    }
    .wa-fab-float { animation: wa-float 3.5s ease-in-out infinite; }
    .wa-shimmer-text {
      background: linear-gradient(90deg,
        rgba(255,255,255,0.5) 0%,
        #fff 40%,
        rgba(255,255,255,0.5) 100%);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: wa-shimmer 3s linear infinite;
    }
  `;
  document.head.appendChild(s);
};

/* ─── Auth fetch ─────────────────────────────────────────────────────────── */
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
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? `HTTP ${res.status}`); }
  return res.json();
}

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Message { role: 'user' | 'assistant'; content: string; isWelcome?: boolean; }

const WELCOME: Message = {
  role: 'assistant', isWelcome: true,
  content: `أهلاً بك! أنا **وصلاوي**، وكيلك الذكي في منصة وصل 🏦

يسعدني أنفّذ أي إجراء مباشرةً:

• 📊 تحليل وتقارير شاملة لجميع البنوك
• ✏️ تحديث البنوك — الحالة، المسؤول، الملخص
• 🏦 إنشاء / أرشفة / استعادة البنوك
• ✅ إدارة مراحل التنفيذ والتقدم
• 📅 إضافة وتعديل وحذف الاجتماعات
• ⚠️ تسجيل المخاطر ومتابعتها
• 📋 متابعة بنود الإجراءات
• 📇 جهات الاتصال والجوالات
• 🔍 بحث ومقارنة البنوك بالمعايير

ما الذي تريد إنجازه اليوم؟`,
};

const QUICK_PROMPTS = [
  { label: '📋 تقرير أسبوعي',      text: 'اصنع لي تقريراً أسبوعياً شاملاً' },
  { label: '🚨 بنوك عالية الخطر',  text: 'أرني البنوك المتأخرة أو عالية المخاطر' },
  { label: '📊 مقارنة بنكين',       text: 'قارن بنك الراجحي مع البنك الأهلي' },
  { label: '🔍 بحث متقدم',          text: 'أرني البنوك التي لم تبدأ بعد وخطرها عالٍ' },
  { label: '📇 جهات الاتصال',       text: 'أرني جهات الاتصال وأرقام الجوال لبنك الراجحي' },
  { label: '✅ إجراءات متأخرة',     text: 'أرني بنود الإجراءات المتأخرة عن موعدها' },
];

/* ─── Markdown ───────────────────────────────────────────────────────────── */
function renderInline(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((p, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-white">{p}</strong> : p
  );
}
function renderMarkdown(text: string): React.ReactNode {
  return (
    <div className="space-y-[2px]">
      {text.split('\n').map((line, i) => {
        if (/^##\s/.test(line)) return (
          <p key={i} className="font-bold text-[13px] text-blue-300 mt-3 mb-1 first:mt-0 tracking-wide uppercase">{renderInline(line.replace(/^##\s/, ''))}</p>
        );
        if (/^#\s/.test(line))  return (
          <p key={i} className="font-extrabold text-base text-white mt-2 mb-1">{renderInline(line.replace(/^#\s/, ''))}</p>
        );
        if (/^[•\-\*]\s/.test(line.trim())) return (
          <div key={i} className="flex gap-2 items-start py-[1px]">
            <span className="text-blue-400 mt-[4px] shrink-0 text-[10px]">◆</span>
            <span className="leading-relaxed text-[13.5px] text-white/85">{renderInline(line.trim().replace(/^[•\-\*]\s/, ''))}</span>
          </div>
        );
        if (/^\d+\.\s/.test(line.trim())) {
          const num = line.trim().match(/^(\d+)\./)?.[1];
          return (
            <div key={i} className="flex gap-2 items-start py-[1px]">
              <span className="text-amber-400 shrink-0 font-bold text-xs mt-[3px] w-4">{num}.</span>
              <span className="leading-relaxed text-[13.5px] text-white/85">{renderInline(line.trim().replace(/^\d+\.\s/, ''))}</span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-[4px]" />;
        return <p key={i} className="leading-relaxed text-[13.5px] text-white/85">{renderInline(line)}</p>;
      })}
    </div>
  );
}

/* ─── Speech ─────────────────────────────────────────────────────────────── */
const SpeechAPI = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

/* ─── Waslaawi Avatar ────────────────────────────────────────────────────── */
function WaslaawiAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-14 h-14 text-xl' };
  return (
    <div
      className={cn('shrink-0 rounded-full flex items-center justify-center font-black text-white shadow-xl', sizes[size])}
      style={{
        background: 'linear-gradient(135deg, #1D4ED8 0%, #7C3AED 50%, #D97706 100%)',
        boxShadow: '0 0 16px rgba(124,58,237,0.5), 0 4px 12px rgba(0,0,0,0.4)',
        fontFamily: 'Tajawal, sans-serif',
      }}
    >
      و
    </div>
  );
}

/* ─── Message Bubble ─────────────────────────────────────────────────────── */
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  if (isUser) return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', damping: 20 }}
      className="flex gap-2 items-end justify-start">
      <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-xs shadow"
        style={{ background: 'linear-gradient(135deg,#334155,#1e293b)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'Tajawal,sans-serif' }}>
        أ
      </div>
      <div className="max-w-[76%] px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-lg"
        style={{
          background: 'linear-gradient(135deg,#1D4ED8 0%,#5B21B6 100%)',
          boxShadow: '0 4px 20px rgba(29,78,216,0.35)',
          wordBreak: 'break-word', overflowWrap: 'anywhere',
          fontFamily: 'Tajawal, sans-serif',
        }}>
        <p className="text-[14px] leading-relaxed text-white" dir="auto">{msg.content}</p>
      </div>
    </motion.div>
  );

  return (
    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', damping: 20 }}
      className="flex gap-2 items-end justify-end">
      <div
        className="max-w-[82%] px-4 py-3 rounded-2xl rounded-br-sm"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
          wordBreak: 'break-word', overflowWrap: 'anywhere',
          fontFamily: 'Tajawal, sans-serif',
        }}
        dir="rtl"
      >
        {renderMarkdown(msg.content)}
      </div>
      <WaslaawiAvatar size="sm" />
    </motion.div>
  );
}

/* ─── Typing indicator ───────────────────────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex gap-2 items-end justify-end">
      <div className="px-5 py-3.5 rounded-2xl rounded-br-sm flex gap-[5px] items-center"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
        {[0,1,2].map(i => (
          <motion.div key={i} className="w-2 h-2 rounded-full"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' }}
            animate={{ y:[0,-6,0], opacity:[0.4,1,0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i*0.16 }} />
        ))}
      </div>
      <WaslaawiAvatar size="sm" />
    </div>
  );
}

/* ─── Mic ripple ─────────────────────────────────────────────────────────── */
function MicRipple() {
  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      {[1,2,3].map(i => (
        <div key={i} className="absolute rounded-full border border-red-400/30"
          style={{ width: 56 + i*18, height: 56 + i*18, animation: `wa-ripple 1.8s ease-out ${i*0.3}s infinite` }} />
      ))}
      <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
        style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)', boxShadow: '0 0 20px rgba(239,68,68,0.5)' }}>
        <Mic className="w-5 h-5 text-white" />
      </div>
    </div>
  );
}

/* ─── Stars background ───────────────────────────────────────────────────── */
function StarsBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: 18 }}>
      {Array.from({ length: 28 }).map((_, i) => (
        <div key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() > 0.7 ? 2 : 1,
            height: Math.random() > 0.7 ? 2 : 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: Math.random() > 0.5 ? 'rgba(139,92,246,0.6)' : 'rgba(59,130,246,0.5)',
            opacity: 0.3 + Math.random() * 0.5,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export function WaslAIChat() {
  useEffect(() => { injectStyles(); }, []);

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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 350); }, [open]);

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function startListening() {
    if (!SpeechAPI) { setMicError('المتصفح لا يدعم التعرف على الصوت.'); return; }
    setMicError(null);
    const rec = new SpeechAPI();
    rec.lang = 'ar-SA'; rec.interimResults = false;
    rec.onstart  = () => setListening(true);
    rec.onresult = (e: any) => { setListening(false); const t = e.results[0][0].transcript.trim(); if (t) sendMessage(t); };
    rec.onerror  = (e: any) => { setListening(false); if (e.error === 'not-allowed') setMicError('يرجى السماح بالوصول للميكروفون.'); };
    rec.onend    = () => setListening(false);
    recognitionRef.current = rec; rec.start();
  }
  function stopListening() { recognitionRef.current?.stop(); setListening(false); }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setShowQuick(false);
    const userMsg: Message = { role: 'user', content };
    const history = messages.filter(m => !m.isWelcome).concat(userMsg).slice(-12).map(({ role, content }) => ({ role, content }));
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setLoading(true);
    try {
      const data = await authedPost('/api/ai/chat', { messages: history });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? data.error ?? 'حدث خطأ.' }]);
    } catch (err: any) {
      // err.message contains the Arabic error text returned by the API (via authedPost)
      const msg = err?.message && !err.message.startsWith('HTTP ')
        ? err.message
        : 'تعذّر الاتصال بالخادم، يرجى المحاولة مجدداً.';
      setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    } finally { setLoading(false); }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }
  function reset() { stopListening(); setMessages([WELCOME]); setInput(''); setMicError(null); setShowQuick(true); }

  const canSend = !!input.trim() && !loading;

  /* ── FAB ── */
  const FAB = (
    <motion.button
      key="fab"
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 200 }}
      onClick={() => setOpen(true)}
      aria-label="افتح وصلاوي"
      className="fixed bottom-6 right-6 z-40 wa-fab-float"
    >
      {/* outer glow ring */}
      <div className="absolute -inset-[3px] rounded-[22px] opacity-70"
        style={{ background: 'conic-gradient(from 0deg, #3B82F6, #8B5CF6, #F59E0B, #3B82F6)', filter: 'blur(8px)', zIndex: -1 }} />
      
      <div className="relative flex items-center gap-3 px-4 py-[10px] rounded-[18px] overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0D1F3C 0%, #1a0f3c 50%, #1a1200 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          fontFamily: 'Tajawal, sans-serif',
        }}>
        {/* shimmer strip */}
        <div className="absolute inset-0 opacity-20"
          style={{ background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.15) 50%, transparent 65%)', animation: 'wa-shimmer 3s linear infinite', backgroundSize: '200% auto' }} />
        
        <WaslaawiAvatar size="md" />
        
        <div className="text-right leading-tight">
          <p className="font-black text-[15px] tracking-wide wa-shimmer-text" style={{ fontFamily: 'Tajawal, sans-serif' }}>وصلاوي</p>
          <p className="text-[11px] text-white/50">منصة وصل الذكية</p>
        </div>
        
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
      </div>
    </motion.button>
  );

  /* ── Panel ── */
  return (
    <>
      <AnimatePresence>{!open && FAB}</AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            {/* mobile backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
              onClick={() => setOpen(false)} />

            <motion.div
              dir="rtl"
              initial={{ opacity: 0, y: 32, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.92 }}
              transition={{ type: 'spring', damping: 24, stiffness: 260 }}
              className="fixed bottom-6 right-6 z-50"
            >
              {/* animated gradient border wrap */}
              <div className="wa-border-wrap" style={{ boxShadow: '0 0 60px rgba(59,130,246,0.15), 0 24px 60px rgba(0,0,0,0.6)' }}>
                <div className="flex flex-col overflow-hidden" style={{
                  width: 'min(90vw, 460px)',
                  height: 'min(80vh, 650px)',
                  borderRadius: '20px',
                  background: 'linear-gradient(160deg, #070F22 0%, #0A0A22 40%, #070F1E 100%)',
                  position: 'relative',
                }}>
                  <StarsBackground />

                  {/* ── Header ─────────────────────────────────────────── */}
                  <div className="relative shrink-0 overflow-hidden" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {/* gold top line */}
                    <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #D97706, #7C3AED, #3B82F6, transparent)' }} />
                    
                    <div className="flex items-center gap-3 px-4 py-3"
                      style={{ background: 'linear-gradient(180deg, rgba(13,31,60,0.9) 0%, rgba(7,15,34,0.8) 100%)' }}>
                      
                      <WaslaawiAvatar size="md" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-[16px] text-white tracking-wide" style={{ fontFamily: 'Tajawal, sans-serif' }}>وصلاوي</span>
                          <span className="text-[10px] px-2 py-[2px] rounded-full font-bold"
                            style={{ background: 'rgba(16,185,129,0.12)', color: '#34D399', border: '1px solid rgba(52,211,153,0.25)' }}>
                            ● نشط
                          </span>
                          <span className="text-[10px] px-2 py-[2px] rounded-full"
                            style={{ background: 'rgba(217,119,6,0.12)', color: '#FCD34D', border: '1px solid rgba(252,211,77,0.2)', fontFamily: 'Tajawal, sans-serif' }}>
                            AI منصة وصل
                          </span>
                        </div>
                        <p className="text-[11px] mt-[1px]" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Tajawal, sans-serif' }}>
                          {listening ? '🎤 يستمع الآن…' : '20 إجراء · جاهز للمساعدة'}
                        </p>
                      </div>

                      <button onClick={reset} title="محادثة جديدة"
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                        style={{ color: 'rgba(255,255,255,0.3)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}>
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setOpen(false)} title="إغلاق"
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                        style={{ color: 'rgba(255,255,255,0.3)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#FCA5A5'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* ── Messages ───────────────────────────────────────── */}
                  <div className="relative flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.2) transparent' }}>
                    
                    {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

                    {/* Quick chips */}
                    <AnimatePresence>
                      {showQuick && !loading && messages.length === 1 && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="flex flex-wrap gap-2 justify-end pt-1">
                          {QUICK_PROMPTS.map(q => (
                            <button key={q.text} onClick={() => sendMessage(q.text)}
                              className="text-[12px] px-3 py-1.5 rounded-full font-medium transition-all"
                              style={{
                                background: 'rgba(99,102,241,0.1)',
                                border: '1px solid rgba(99,102,241,0.28)',
                                color: '#A5B4FC',
                                fontFamily: 'Tajawal, sans-serif',
                              }}
                              onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.22)';
                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(165,180,252,0.5)';
                                (e.currentTarget as HTMLElement).style.color = '#E0E7FF';
                              }}
                              onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.1)';
                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.28)';
                                (e.currentTarget as HTMLElement).style.color = '#A5B4FC';
                              }}>
                              {q.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {loading && <TypingDots />}
                    <div ref={bottomRef} />
                  </div>

                  {/* Mic overlay */}
                  <AnimatePresence>
                    {listening && (
                      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                        className="absolute inset-x-4 bottom-24 rounded-2xl py-8 flex flex-col items-center gap-4 z-20"
                        style={{ background: 'rgba(5,10,25,0.97)', border: '1px solid rgba(239,68,68,0.2)', backdropFilter: 'blur(16px)' }}>
                        <MicRipple />
                        <p className="text-sm text-white/70 font-medium" style={{ fontFamily: 'Tajawal, sans-serif' }}>يستمع إليك الآن…</p>
                        <button onClick={stopListening} className="text-xs text-red-400 hover:text-red-300 transition-colors" style={{ fontFamily: 'Tajawal, sans-serif' }}>اضغط للإيقاف</button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Mic error */}
                  <AnimatePresence>
                    {micError && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="mx-3 mb-1 px-3 py-1.5 rounded-lg text-xs text-center"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#FCA5A5', fontFamily: 'Tajawal, sans-serif' }}>
                        {micError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Input ──────────────────────────────────────────── */}
                  <div className="relative shrink-0 px-3 pb-3 pt-2"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(4,8,18,0.8)' }}>
                    
                    {/* decorative gradient line above input */}
                    <div style={{ height: 1, marginBottom: 8, background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)' }} />

                    <div
                      dir="rtl"
                      className="flex items-end gap-2 rounded-xl px-3 py-2 transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        boxShadow: '0 0 0 0px rgba(99,102,241,0)',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                      onFocus={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = 'rgba(139,92,246,0.5)';
                        el.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
                      }}
                      onBlur={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = 'rgba(99,102,241,0.2)';
                        el.style.boxShadow = '0 0 0 0px rgba(99,102,241,0)';
                      }}
                    >
                      {/* Send — RIGHT in RTL (first child) */}
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => sendMessage()}
                        disabled={!canSend}
                        className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-25"
                        style={{
                          background: canSend
                            ? 'linear-gradient(135deg, #4F46E5, #7C3AED)'
                            : 'rgba(255,255,255,0.06)',
                          boxShadow: canSend ? '0 0 16px rgba(99,102,241,0.4)' : 'none',
                        }}
                      >
                        {loading
                          ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                          : <Send className="w-4 h-4 text-white" style={{ transform: 'scaleX(-1)' }} />
                        }
                      </motion.button>

                      {/* Textarea */}
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => { setInput(e.target.value); autoGrow(e.target); }}
                        onKeyDown={handleKey}
                        placeholder="اكتب رسالتك لوصلاوي…"
                        rows={1}
                        disabled={loading || listening}
                        dir="auto"
                        className="flex-1 bg-transparent outline-none resize-none disabled:opacity-40 leading-relaxed"
                        style={{
                          fontSize: 14, color: 'white', minHeight: 36, maxHeight: 120,
                          paddingTop: 8, paddingBottom: 8,
                          fontFamily: 'Tajawal, sans-serif',
                          caretColor: '#8B5CF6',
                        }}
                        style-placeholder-color="rgba(255,255,255,0.25)"
                      />

                      {/* Mic — LEFT in RTL (last child) */}
                      {!!SpeechAPI && (
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={listening ? stopListening : startListening}
                          disabled={loading}
                          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-25"
                          style={{
                            background: listening ? 'linear-gradient(135deg,#EF4444,#DC2626)' : 'transparent',
                            color: listening ? 'white' : 'rgba(255,255,255,0.35)',
                            boxShadow: listening ? '0 0 16px rgba(239,68,68,0.4)' : 'none',
                          }}
                        >
                          {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </motion.button>
                      )}
                    </div>

                    <p className="text-center text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.18)', fontFamily: 'Tajawal, sans-serif' }}>
                      وصلاوي · Enter للإرسال · Shift+Enter لسطر جديد
                    </p>
                  </div>

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
