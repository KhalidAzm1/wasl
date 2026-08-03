import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, Loader2, RotateCcw, Mic, MicOff,
  ChevronDown, Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

/* ─── CSS ────────────────────────────────────────────────────────────────── */
const injectStyles = () => {
  if (document.getElementById('wa-styles')) return;
  const s = document.createElement('style');
  s.id = 'wa-styles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap');
    @keyframes wa-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
    @keyframes wa-ripple { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(2.2);opacity:0} }
    @keyframes wa-pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
    .wa-float { animation: wa-float 4s ease-in-out infinite; }
    .wa-live  { animation: wa-pulse-dot 2.2s ease-in-out infinite; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(99,102,241,.2); border-radius: 4px; }
  `;
  document.head.appendChild(s);
};

/* ─── Auth ───────────────────────────────────────────────────────────────── */
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
  content: `مرحباً — أنا **وصلاوي**، وكيلك الذكي في منصة وصل.

يمكنني تنفيذ الإجراءات التالية مباشرةً:

- تحليل حالة البنوك وإنشاء التقارير الشاملة
- تحديث البنوك — الحالة، المسؤول، الملخص التنفيذي
- إنشاء البنوك وأرشفتها واستعادتها
- إدارة مراحل التنفيذ وتتبع التقدم
- إضافة الاجتماعات وتعديلها وحذفها
- تسجيل المخاطر ومتابعة حالتها
- متابعة بنود الإجراءات وإغلاقها
- استعراض جهات الاتصال وأرقام الجوال
- البحث في البنوك والمقارنة بالمعايير

ما الذي تريد إنجازه؟`,
};

const QUICK_PROMPTS = [
  { label: 'تقرير أسبوعي',      text: 'اصنع لي تقريراً أسبوعياً شاملاً' },
  { label: 'بنوك عالية الخطر',  text: 'أرني البنوك المتأخرة أو عالية المخاطر' },
  { label: 'مقارنة بنكين',       text: 'قارن بنك الراجحي مع البنك الأهلي' },
  { label: 'إجراءات متأخرة',     text: 'أرني بنود الإجراءات المتأخرة عن موعدها' },
  { label: 'جهات الاتصال',       text: 'أرني جهات الاتصال وأرقام الجوال لبنك الراجحي' },
  { label: 'بحث متقدم',          text: 'أرني البنوك التي لم تبدأ بعد وخطرها عالٍ' },
];

/* ─── Markdown ───────────────────────────────────────────────────────────── */
function renderInline(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((p, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>{p}</strong>
      : p
  );
}

type MdBlock =
  | { type: 'table'; rows: string[][] }
  | { type: 'lines'; lines: string[] };

function parseBlocks(text: string): MdBlock[] {
  const lines = text.split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('|') && trimmed.includes('|', 1)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines
        .filter(l => !/^\|\s*[-:]+[\s|:-]*$/.test(l.trim()))
        .map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
      if (rows.length > 0) blocks.push({ type: 'table', rows });
    } else {
      const last = blocks[blocks.length - 1];
      if (last?.type === 'lines') { last.lines.push(lines[i]); }
      else { blocks.push({ type: 'lines', lines: [lines[i]] }); }
      i++;
    }
  }
  return blocks;
}

function renderLine(line: string, key: string | number): React.ReactNode {
  if (/^##\s/.test(line)) return (
    <p key={key} style={{ color: 'rgba(165,180,252,0.9)', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 14, marginBottom: 4 }}>
      {renderInline(line.replace(/^##\s/, ''))}
    </p>
  );
  if (/^#\s/.test(line)) return (
    <p key={key} style={{ color: 'white', fontSize: 14, fontWeight: 700, marginTop: 10, marginBottom: 4 }}>
      {renderInline(line.replace(/^#\s/, ''))}
    </p>
  );
  if (/^[•\-\*]\s/.test(line.trim())) return (
    <div key={key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '2px 0' }}>
      <span style={{ color: 'rgba(99,102,241,0.7)', marginTop: 5, fontSize: 7, flexShrink: 0 }}>◆</span>
      <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13.5, lineHeight: 1.65 }}>
        {renderInline(line.trim().replace(/^[•\-\*]\s/, ''))}
      </span>
    </div>
  );
  if (/^\d+\.\s/.test(line.trim())) {
    const num = line.trim().match(/^(\d+)\./)?.[1];
    return (
      <div key={key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '2px 0' }}>
        <span style={{ color: 'rgba(251,191,36,0.8)', fontSize: 11, fontWeight: 700, marginTop: 3, width: 16, flexShrink: 0 }}>{num}.</span>
        <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13.5, lineHeight: 1.65 }}>
          {renderInline(line.trim().replace(/^\d+\.\s/, ''))}
        </span>
      </div>
    );
  }
  if (line.trim() === '') return <div key={key} style={{ height: 5 }} />;
  return <p key={key} style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13.5, lineHeight: 1.65 }}>{renderInline(line)}</p>;
}

function renderMarkdown(text: string): React.ReactNode {
  const blocks = parseBlocks(text);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {blocks.map((block, bi) => {
        if (block.type === 'table') {
          const [header, ...body] = block.rows;
          return (
            <div key={bi} style={{ overflowX: 'auto', margin: '8px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.09)' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }} dir="rtl">
                <thead>
                  <tr style={{ background: 'rgba(99,102,241,0.14)' }}>
                    {header.map((cell, ci) => (
                      <th key={ci} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'rgba(255,255,255,0.88)', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
                        {renderInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)' }}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{ padding: '7px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.72)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return block.lines.map((line, li) => renderLine(line, `${bi}-${li}`));
      })}
    </div>
  );
}

/* ─── Speech ─────────────────────────────────────────────────────────────── */
const SpeechAPI = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

/* ─── Avatar ─────────────────────────────────────────────────────────────── */
function WaslaawiAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 30 : 36;
  const fs  = size === 'sm' ? 13  : 15;
  return (
    <div style={{
      width: dim, height: dim, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #4c1d95 100%)',
      border: '1px solid rgba(99,102,241,0.35)',
      fontSize: fs, fontWeight: 800, color: 'white',
      fontFamily: 'Tajawal, sans-serif',
      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
    }}>
      و
    </div>
  );
}

/* ─── Bubbles ────────────────────────────────────────────────────────────── */
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  if (isUser) return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 280 }}
      style={{ display: 'flex', gap: 8, alignItems: 'flex-end', justifyContent: 'flex-start' }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
        fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
        fontFamily: 'Tajawal, sans-serif',
      }}>أ</div>
      <div style={{
        maxWidth: '75%', padding: '9px 14px', borderRadius: '16px 16px 16px 4px',
        background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.28)',
        wordBreak: 'break-word', overflowWrap: 'anywhere', fontFamily: 'Tajawal, sans-serif',
      }}>
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.88)' }} dir="auto">{msg.content}</p>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 280 }}
      style={{ display: 'flex', gap: 8, alignItems: 'flex-end', justifyContent: 'flex-end' }}
    >
      <div style={{
        maxWidth: '84%', padding: '10px 14px', borderRadius: '16px 16px 4px 16px',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        wordBreak: 'break-word', overflowWrap: 'anywhere', fontFamily: 'Tajawal, sans-serif',
      }} dir="rtl">
        {renderMarkdown(msg.content)}
      </div>
      <WaslaawiAvatar size="sm" />
    </motion.div>
  );
}

/* ─── Typing ─────────────────────────────────────────────────────────────── */
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
      <div style={{
        padding: '12px 16px', borderRadius: '16px 16px 4px 16px',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', gap: 5, alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i}
            style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(165,180,252,0.6)' }}
            animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
      <WaslaawiAvatar size="sm" />
    </div>
  );
}

/* ─── Mic overlay ────────────────────────────────────────────────────────── */
function MicRipple() {
  return (
    <div style={{ position: 'relative', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {[1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%', border: '1px solid rgba(239,68,68,0.25)',
          width: 56 + i * 20, height: 56 + i * 20,
          animation: `wa-ripple 1.8s ease-out ${i * 0.35}s infinite`,
        }} />
      ))}
      <div style={{
        width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
      }}>
        <Mic style={{ width: 20, height: 20, color: '#FCA5A5' }} />
      </div>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────────── */
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

  /* FAB */
  const FAB = (
    <motion.button
      key="fab"
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 16, opacity: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 240 }}
      onClick={() => setOpen(true)}
      aria-label="افتح وصلاوي"
      className="wa-float"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 40,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 18px 10px 14px',
        borderRadius: 14,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        border: '1px solid rgba(99,102,241,0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(99,102,241,0.1)',
        cursor: 'pointer', fontFamily: 'Tajawal, sans-serif',
      }}
    >
      <WaslaawiAvatar size="md" />
      <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0 }}>وصلاوي</p>
        <p style={{ fontSize: 10.5, color: 'rgba(165,180,252,0.7)', margin: 0 }}>المساعد الذكي</p>
      </div>
      <ChevronDown style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.3)', marginRight: 2 }} />
    </motion.button>
  );

  /* Panel */
  return (
    <>
      <AnimatePresence>{!open && FAB}</AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            {/* backdrop mobile */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
              className="md:hidden"
              onClick={() => setOpen(false)}
            />

            <motion.div
              dir="rtl"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50 }}
            >
              <div style={{
                display: 'flex', flexDirection: 'column',
                width: 'min(92vw, 448px)',
                height: 'min(82vh, 640px)',
                borderRadius: 18,
                background: '#080f1e',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.12)',
                overflow: 'hidden',
                fontFamily: 'Tajawal, sans-serif',
              }}>

                {/* ── Header ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  background: 'rgba(255,255,255,0.02)',
                  flexShrink: 0,
                }}>
                  <WaslaawiAvatar size="md" />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>وصلاوي</span>
                      <span className="wa-live" style={{
                        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                        background: '#34d399',
                      }} />
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
                      {listening ? 'يستمع الآن…' : 'مساعد منصة وصل الذكي'}
                    </p>
                  </div>

                  <button onClick={reset} title="محادثة جديدة" style={{
                    width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'transparent', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background .15s, color .15s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}
                  >
                    <RotateCcw style={{ width: 13, height: 13 }} />
                  </button>
                  <button onClick={() => setOpen(false)} title="إغلاق" style={{
                    width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'transparent', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background .15s, color .15s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#fca5a5'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}
                  >
                    <X style={{ width: 15, height: 15 }} />
                  </button>
                </div>

                {/* ── Messages ── */}
                <div style={{
                  flex: 1, overflowY: 'auto', padding: '16px 14px',
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

                  {/* Quick prompts */}
                  <AnimatePresence>
                    {showQuick && !loading && messages.length === 1 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', paddingTop: 4 }}
                      >
                        {QUICK_PROMPTS.map(q => (
                          <button key={q.text} onClick={() => sendMessage(q.text)} style={{
                            fontSize: 12, padding: '5px 12px', borderRadius: 8,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.65)',
                            cursor: 'pointer', fontFamily: 'Tajawal, sans-serif',
                            transition: 'background .15s, border-color .15s, color .15s',
                          }}
                            onMouseEnter={e => {
                              const el = e.currentTarget as HTMLElement;
                              el.style.background = 'rgba(99,102,241,0.14)';
                              el.style.borderColor = 'rgba(99,102,241,0.4)';
                              el.style.color = 'rgba(255,255,255,0.9)';
                            }}
                            onMouseLeave={e => {
                              const el = e.currentTarget as HTMLElement;
                              el.style.background = 'rgba(255,255,255,0.04)';
                              el.style.borderColor = 'rgba(255,255,255,0.1)';
                              el.style.color = 'rgba(255,255,255,0.65)';
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
                    <motion.div
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
                      style={{
                        position: 'absolute', insetInline: 14, bottom: 80,
                        borderRadius: 14, padding: '24px 20px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                        background: 'rgba(8,15,30,0.97)', border: '1px solid rgba(239,68,68,0.18)',
                        backdropFilter: 'blur(12px)', zIndex: 20,
                      }}
                    >
                      <MicRipple />
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0, fontFamily: 'Tajawal, sans-serif' }}>يستمع إليك الآن…</p>
                      <button onClick={stopListening} style={{
                        fontSize: 12, color: '#fca5a5', background: 'none', border: 'none',
                        cursor: 'pointer', fontFamily: 'Tajawal, sans-serif',
                      }}>اضغط للإيقاف</button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mic error */}
                <AnimatePresence>
                  {micError && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{
                        margin: '0 12px 6px', padding: '8px 12px', borderRadius: 8,
                        fontSize: 12, textAlign: 'center',
                        background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.16)',
                        color: '#fca5a5', fontFamily: 'Tajawal, sans-serif',
                      }}>
                      {micError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Input ── */}
                <div style={{
                  flexShrink: 0, padding: '10px 12px 12px',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(4,8,18,0.6)',
                }}>
                  <div dir="rtl" style={{
                    display: 'flex', alignItems: 'flex-end', gap: 8,
                    padding: '8px 10px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    transition: 'border-color .2s',
                  }}
                    onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)'}
                    onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)'}
                  >
                    {/* Send */}
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => sendMessage()}
                      disabled={!canSend}
                      style={{
                        flexShrink: 0, width: 34, height: 34, borderRadius: 9, border: 'none', cursor: canSend ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: canSend ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'rgba(255,255,255,0.05)',
                        opacity: canSend ? 1 : 0.4,
                        transition: 'background .2s',
                        boxShadow: canSend ? '0 0 14px rgba(99,102,241,0.35)' : 'none',
                      }}
                    >
                      {loading
                        ? <Loader2 style={{ width: 14, height: 14, color: 'white', animation: 'spin 1s linear infinite' }} />
                        : <Send style={{ width: 14, height: 14, color: 'white', transform: 'scaleX(-1)' }} />
                      }
                    </motion.button>

                    {/* Textarea */}
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => { setInput(e.target.value); autoGrow(e.target); }}
                      onKeyDown={handleKey}
                      placeholder="اكتب رسالتك…"
                      rows={1}
                      disabled={loading || listening}
                      dir="auto"
                      style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        resize: 'none', fontSize: 13.5, color: 'white', minHeight: 34, maxHeight: 120,
                        paddingTop: 7, paddingBottom: 7,
                        fontFamily: 'Tajawal, sans-serif', caretColor: '#818cf8',
                        opacity: loading || listening ? 0.4 : 1,
                      }}
                    />

                    {/* Mic */}
                    {!!SpeechAPI && (
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={listening ? stopListening : startListening}
                        disabled={loading}
                        style={{
                          flexShrink: 0, width: 34, height: 34, borderRadius: 9, border: 'none',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: listening ? 'rgba(239,68,68,0.15)' : 'transparent',
                          color: listening ? '#fca5a5' : 'rgba(255,255,255,0.3)',
                          transition: 'background .2s, color .2s',
                          opacity: loading ? 0.35 : 1,
                        }}
                      >
                        {listening ? <MicOff style={{ width: 14, height: 14 }} /> : <Mic style={{ width: 14, height: 14 }} />}
                      </motion.button>
                    )}
                  </div>

                  <p style={{
                    textAlign: 'center', fontSize: 10, marginTop: 7,
                    color: 'rgba(255,255,255,0.16)', fontFamily: 'Tajawal, sans-serif',
                  }}>
                    Enter للإرسال · Shift+Enter لسطر جديد
                  </p>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
