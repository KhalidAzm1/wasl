import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, Loader2, RotateCcw, Mic, MicOff,
  Sparkles, ChevronRight, Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

/* ─── styles ─────────────────────────────────────────────────────────────── */
const injectStyles = () => {
  if (document.getElementById('wa2-styles')) return;
  const s = document.createElement('style');
  s.id = 'wa2-styles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap');
    @keyframes wa-dot  { 0%,100%{opacity:.9} 50%{opacity:.3} }
    @keyframes wa-in   { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:none} }
    @keyframes wa-spin { to{transform:rotate(360deg)} }
    .wa-blink { animation: wa-dot 2s ease-in-out infinite; }
    .wa-in    { animation: wa-in .22s ease both; }
    .wa-spin  { animation: wa-spin .9s linear infinite; }
    .wa-panel * { box-sizing: border-box; }
    .wa-panel ::-webkit-scrollbar { width: 3px; }
    .wa-panel ::-webkit-scrollbar-track { background: transparent; }
    .wa-panel ::-webkit-scrollbar-thumb { background: rgba(99,102,241,.25); border-radius: 3px; }
    .wa-textarea::placeholder { color: rgba(255,255,255,.25); }
    .wa-panel textarea { font-family: Tajawal, sans-serif; }
    .wa-quick:hover { background: rgba(99,102,241,.12) !important; border-color: rgba(99,102,241,.35) !important; color: rgba(255,255,255,.88) !important; }
    .wa-icon-btn:hover { background: rgba(255,255,255,.07) !important; color: rgba(255,255,255,.8) !important; }
  `;
  document.head.appendChild(s);
};

/* ─── auth fetch ─────────────────────────────────────────────────────────── */
async function authedPost(path: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? `HTTP ${res.status}`); }
  return res.json();
}

/* ─── types ──────────────────────────────────────────────────────────────── */
interface Message { role: 'user' | 'assistant'; content: string; isWelcome?: boolean; }

const WELCOME: Message = {
  role: 'assistant', isWelcome: true,
  content: `مرحباً، أنا **وصلاوي** — مساعد البيانات الذكي لمنصة وصل.

لدي صلاحية كاملة لقراءة وتحديث بيانات البنوك في الوقت الفعلي. يمكنني:

- إنشاء التقارير التحليلية الشاملة
- تحديث حالة البنوك ومراحل التنفيذ
- تتبع المخاطر وبنود الإجراءات
- إدارة الاجتماعات والجهات المسؤولة
- البحث والمقارنة بين البنوك

ما الذي تحتاجه؟`,
};

const QUICK = [
  { label: 'تقرير أسبوعي',     text: 'اصنع لي تقريراً أسبوعياً شاملاً' },
  { label: 'بنوك عالية الخطر', text: 'أرني البنوك المتأخرة أو عالية المخاطر' },
  { label: 'مقارنة بنكين',      text: 'قارن بنك الراجحي مع البنك الأهلي' },
  { label: 'إجراءات متأخرة',    text: 'أرني بنود الإجراءات المتأخرة عن موعدها' },
];

/* ─── markdown ───────────────────────────────────────────────────────────── */
function bold(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((p, i) =>
    i % 2 === 1 ? <strong key={i} style={{ color: 'white', fontWeight: 600 }}>{p}</strong> : p
  );
}

type MdBlock = { type: 'table'; rows: string[][] } | { type: 'lines'; lines: string[] };

function parseBlocks(text: string): MdBlock[] {
  const lines = text.split('\n');
  const out: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const tr = lines[i].trim();
    if (tr.startsWith('|') && tr.includes('|', 1)) {
      const tl: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { tl.push(lines[i]); i++; }
      const rows = tl
        .filter(l => !/^\|\s*[-:]+[\s|:-]*$/.test(l.trim()))
        .map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
      if (rows.length) out.push({ type: 'table', rows });
    } else {
      const last = out[out.length - 1];
      if (last?.type === 'lines') last.lines.push(lines[i]);
      else out.push({ type: 'lines', lines: [lines[i]] });
      i++;
    }
  }
  return out;
}

const T = {
  h2:  { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'rgba(165,180,252,.85)', marginTop: 14, marginBottom: 3 },
  li:  { fontSize: 13.5, lineHeight: 1.7, color: 'rgba(255,255,255,.78)' },
  num: { fontSize: 11, fontWeight: 700, color: 'rgba(251,191,36,.8)', width: 16, flexShrink: 0, marginTop: 2 },
  dot: { fontSize: 7, color: 'rgba(99,102,241,.65)', flexShrink: 0, marginTop: 6 },
  p:   { fontSize: 13.5, lineHeight: 1.7, color: 'rgba(255,255,255,.78)' },
};

function renderLine(line: string, key: string | number): React.ReactNode {
  if (/^##\s/.test(line)) return <p key={key} style={T.h2}>{bold(line.replace(/^##\s/, ''))}</p>;
  if (/^#\s/.test(line))  return <p key={key} style={{ ...T.p, fontSize: 14, fontWeight: 700, color: 'white', marginTop: 8 }}>{bold(line.replace(/^#\s/, ''))}</p>;
  if (/^[•\-\*]\s/.test(line.trim())) return (
    <div key={key} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '1.5px 0' }}>
      <span style={T.dot}>◆</span>
      <span style={T.li}>{bold(line.trim().replace(/^[•\-\*]\s/, ''))}</span>
    </div>
  );
  if (/^\d+\.\s/.test(line.trim())) {
    const n = line.trim().match(/^(\d+)\./)?.[1];
    return (
      <div key={key} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '1.5px 0' }}>
        <span style={T.num}>{n}.</span>
        <span style={T.li}>{bold(line.trim().replace(/^\d+\.\s/, ''))}</span>
      </div>
    );
  }
  if (!line.trim()) return <div key={key} style={{ height: 6 }} />;
  return <p key={key} style={T.p}>{bold(line)}</p>;
}

function Md({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {parseBlocks(text).map((b, bi) => {
        if (b.type === 'table') {
          const [hdr, ...rows] = b.rows;
          return (
            <div key={bi} style={{ overflowX: 'auto', margin: '10px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }} dir="rtl">
                <thead>
                  <tr style={{ background: 'rgba(99,102,241,0.12)' }}>
                    {hdr.map((c, ci) => <th key={ci} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'rgba(255,255,255,.85)', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' }}>{bold(c)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 ? 'rgba(255,255,255,0.025)' : 'transparent' }}>
                      {row.map((c, ci) => <td key={ci} style={{ padding: '7px 12px', textAlign: 'right', color: 'rgba(255,255,255,.68)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{bold(c)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return b.lines.map((l, li) => renderLine(l, `${bi}-${li}`));
      })}
    </div>
  );
}

/* ─── speech ─────────────────────────────────────────────────────────────── */
const SpeechAPI = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

/* ─── sub-components ─────────────────────────────────────────────────────── */
function Avatar({ sm }: { sm?: boolean }) {
  const d = sm ? 28 : 34;
  return (
    <div style={{
      width: d, height: d, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(140deg,#1e3a8a,#4c1d95)',
      border: '1px solid rgba(99,102,241,.3)',
      fontSize: sm ? 11 : 13, fontWeight: 800, color: 'white',
      fontFamily: 'Tajawal,sans-serif', letterSpacing: '.02em',
    }}>و</div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="wa-in" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', justifyContent: 'flex-start' }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,.09)',
        fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.45)',
        fontFamily: 'Tajawal,sans-serif',
      }}>أ</div>
      <div style={{
        maxWidth: '80%', padding: '9px 13px', borderRadius: '4px 14px 14px 14px',
        background: 'rgba(99,102,241,.13)', border: '1px solid rgba(99,102,241,.22)',
        fontFamily: 'Tajawal,sans-serif',
      }}>
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'rgba(255,255,255,.85)', margin: 0 }} dir="auto">{text}</p>
      </div>
    </div>
  );
}

function AiBubble({ msg }: { msg: Message }) {
  const hasTable = msg.content.includes('|');
  return (
    <div className="wa-in" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
      <div style={{
        /* Full width when tables are present so overflowX:auto on the table wrapper actually works */
        width: hasTable ? 'calc(100% - 46px)' : undefined,
        maxWidth: hasTable ? undefined : '88%',
        padding: '11px 14px', borderRadius: '14px 4px 14px 14px',
        background: 'transparent',
        borderRight: '2px solid rgba(99,102,241,.35)',
        fontFamily: 'Tajawal,sans-serif',
        minWidth: 0,
        overflow: 'hidden',
      }} dir="rtl">
        <Md text={msg.content} />
      </div>
      <Avatar sm />
    </div>
  );
}

function Dots() {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
      <div style={{
        padding: '13px 16px', borderRadius: '14px 4px 14px 14px',
        borderRight: '2px solid rgba(99,102,241,.3)',
        display: 'flex', gap: 5, alignItems: 'center',
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: '50%', background: 'rgba(165,180,252,.5)',
            animation: `wa-dot 1s ${i*.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>
      <Avatar sm />
    </div>
  );
}

/* ─── trigger button ─────────────────────────────────────────────────────── */
function Trigger({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', damping: 22 }}
      onClick={onClick}
      title="وصلاوي — المساعد الذكي"
      style={{
        position: 'fixed', bottom: 28, right: 0, zIndex: 40,
        display: 'flex', alignItems: 'center', gap: 0,
        padding: 0, border: 'none', cursor: 'pointer', background: 'transparent',
      }}
    >
      {/* Pull tab */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: 36, paddingBlock: 14, gap: 8,
        background: '#0d1526',
        border: '1px solid rgba(99,102,241,.3)',
        borderRight: 'none',
        borderRadius: '12px 0 0 12px',
        boxShadow: '-4px 4px 24px rgba(0,0,0,.5)',
      }}>
        <Zap style={{ width: 14, height: 14, color: 'rgba(165,180,252,.8)' }} />
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'rgba(165,180,252,.7)',
          writingMode: 'vertical-lr', transform: 'rotate(180deg)',
          fontFamily: 'Tajawal,sans-serif', letterSpacing: '.06em',
        }}>وصلاوي</span>
        <ChevronRight style={{ width: 12, height: 12, color: 'rgba(255,255,255,.25)' }} />
      </div>
    </motion.button>
  );
}

/* ─── main ───────────────────────────────────────────────────────────────── */
export function WaslAIChat() {
  useEffect(() => { injectStyles(); }, []);

  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([WELCOME]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError]   = useState<string | null>(null);
  const [showQuick, setShowQuick] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const recRef    = useRef<any>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 300); }, [open]);

  function grow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  function startMic() {
    if (!SpeechAPI) { setMicError('المتصفح لا يدعم التعرف على الصوت'); return; }
    setMicError(null);
    const r = new SpeechAPI();
    r.lang = 'ar-SA'; r.interimResults = false;
    r.onstart  = () => setListening(true);
    r.onresult = (e: any) => { setListening(false); const t = e.results[0][0].transcript.trim(); if (t) send(t); };
    r.onerror  = (e: any) => { setListening(false); if (e.error === 'not-allowed') setMicError('يرجى السماح بالوصول للميكروفون'); };
    r.onend    = () => setListening(false);
    recRef.current = r; r.start();
  }
  function stopMic() { recRef.current?.stop(); setListening(false); }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setShowQuick(false);
    const userMsg: Message = { role: 'user', content };
    const hist = messages.filter(m => !m.isWelcome).concat(userMsg).slice(-12).map(({ role, content }) => ({ role, content }));
    setMessages(p => [...p, userMsg]);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setLoading(true);
    try {
      const data = await authedPost('/api/ai/chat', { messages: hist });
      setMessages(p => [...p, { role: 'assistant', content: data.reply ?? data.error ?? 'حدث خطأ.' }]);
    } catch (err: any) {
      const msg = err?.message && !err.message.startsWith('HTTP ') ? err.message : 'تعذّر الاتصال، يرجى المحاولة مجدداً.';
      setMessages(p => [...p, { role: 'assistant', content: msg }]);
    } finally { setLoading(false); }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }
  function reset() { stopMic(); setMessages([WELCOME]); setInput(''); setMicError(null); setShowQuick(true); }

  const canSend = !!input.trim() && !loading;
  const W = 400; // panel width

  return (
    <>
      {/* Trigger tab */}
      <AnimatePresence>{!open && <Trigger onClick={() => setOpen(true)} />}</AnimatePresence>

      {/* Backdrop (mobile only) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
            }}
            className="md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Side panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            dir="rtl"
            className="wa-panel"
            initial={{ x: W }} animate={{ x: 0 }} exit={{ x: W }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: `min(${W}px, 100vw)`,
              zIndex: 50,
              display: 'flex', flexDirection: 'column',
              background: '#080f1c',
              borderLeft: '1px solid rgba(99,102,241,.18)',
              boxShadow: '-20px 0 60px rgba(0,0,0,.55)',
              fontFamily: 'Tajawal, sans-serif',
            }}
          >
            {/* ── header ─────────────────────────────────────────────────── */}
            <div style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,.07)',
              background: 'rgba(255,255,255,.02)',
            }}>
              <Avatar />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>وصلاوي</span>
                  <span className="wa-blink" style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 10.5, color: 'rgba(165,180,252,.55)', fontWeight: 500 }}>
                    {listening ? 'يستمع…' : 'متصل · بيانات حية'}
                  </span>
                </div>
                <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,.3)', margin: 0, marginTop: 1 }}>
                  مساعد منصة وصل الذكي
                </p>
              </div>

              {/* model badge */}
              <div style={{
                fontSize: 9.5, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.22)',
                color: 'rgba(165,180,252,.7)', letterSpacing: '.04em',
              }}>GPT-4o</div>

              <button className="wa-icon-btn" onClick={reset} title="محادثة جديدة" style={{
                width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'transparent', color: 'rgba(255,255,255,.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s, color .15s',
              }}>
                <RotateCcw style={{ width: 13, height: 13 }} />
              </button>
              <button className="wa-icon-btn" onClick={() => setOpen(false)} title="إغلاق" style={{
                width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'transparent', color: 'rgba(255,255,255,.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s, color .15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.1)'; (e.currentTarget as HTMLElement).style.color = '#fca5a5'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.28)'; }}
              >
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>

            {/* ── context strip ──────────────────────────────────────────── */}
            <div style={{
              flexShrink: 0, padding: '7px 16px',
              borderBottom: '1px solid rgba(255,255,255,.05)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Sparkles style={{ width: 11, height: 11, color: 'rgba(165,180,252,.45)', flexShrink: 0 }} />
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,.28)' }}>
                وصول مباشر لبيانات البنوك · الاجتماعات · المخاطر · الإجراءات
              </span>
            </div>

            {/* ── messages ───────────────────────────────────────────────── */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '20px 16px 8px',
              display: 'flex', flexDirection: 'column', gap: 18,
            }}>
              {messages.map((msg, i) =>
                msg.role === 'user'
                  ? <UserBubble key={i} text={msg.content} />
                  : <AiBubble key={i} msg={msg} />
              )}

              {/* quick chips */}
              {showQuick && !loading && messages.length === 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-end', paddingTop: 6 }}>
                  <p style={{ width: '100%', textAlign: 'right', fontSize: 10.5, color: 'rgba(255,255,255,.28)', marginBottom: 2 }}>اقتراحات سريعة</p>
                  {QUICK.map(q => (
                    <button key={q.text} className="wa-quick" onClick={() => send(q.text)} style={{
                      fontSize: 12, padding: '6px 13px', borderRadius: 8,
                      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)',
                      color: 'rgba(255,255,255,.58)', cursor: 'pointer',
                      fontFamily: 'Tajawal,sans-serif', transition: 'all .15s',
                    }}>
                      {q.label}
                    </button>
                  ))}
                </div>
              )}

              {loading && <Dots />}
              <div ref={bottomRef} />
            </div>

            {/* ── mic overlay ─────────────────────────────────────────────── */}
            <AnimatePresence>
              {listening && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute', inset: '0 0 80px', zIndex: 10,
                    background: 'rgba(8,15,28,.95)', backdropFilter: 'blur(10px)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
                  }}
                >
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Mic style={{ width: 22, height: 22, color: '#fca5a5' }} />
                  </div>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', fontFamily: 'Tajawal,sans-serif' }}>يستمع إليك الآن…</p>
                  <button onClick={stopMic} style={{
                    fontSize: 12, color: '#fca5a5', background: 'none', border: '1px solid rgba(239,68,68,.25)',
                    padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Tajawal,sans-serif',
                  }}>إيقاف</button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── input area ──────────────────────────────────────────────── */}
            <div style={{
              flexShrink: 0, padding: '12px 14px 16px',
              borderTop: '1px solid rgba(255,255,255,.07)',
              background: 'rgba(4,8,18,.7)',
            }}>
              {/* mic error */}
              {micError && (
                <div style={{
                  marginBottom: 8, padding: '7px 12px', borderRadius: 8,
                  background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.15)',
                  fontSize: 12, color: '#fca5a5', fontFamily: 'Tajawal,sans-serif', textAlign: 'center',
                }}>
                  {micError}
                </div>
              )}

              {/* input box */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                padding: '12px 14px', borderRadius: 14,
                background: 'rgba(255,255,255,.035)',
                border: '1px solid rgba(255,255,255,.09)',
                transition: 'border-color .2s',
              }}
                onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,.4)'}
                onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.09)'}
              >
                <textarea
                  ref={inputRef}
                  className="wa-textarea"
                  value={input}
                  onChange={e => { setInput(e.target.value); grow(e.target); }}
                  onKeyDown={onKey}
                  placeholder="اكتب رسالتك لوصلاوي…"
                  rows={1}
                  disabled={loading || listening}
                  dir="auto"
                  style={{
                    width: '100%', background: 'transparent', border: 'none', outline: 'none',
                    resize: 'none', fontSize: 14, color: 'white',
                    minHeight: 24, maxHeight: 140,
                    fontFamily: 'Tajawal,sans-serif', caretColor: '#818cf8',
                    opacity: loading || listening ? 0.4 : 1,
                    lineHeight: 1.6,
                  }}
                />

                {/* actions row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', fontFamily: 'Tajawal,sans-serif' }}>
                    Enter للإرسال · Shift+Enter لسطر جديد
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!!SpeechAPI && (
                      <button onClick={listening ? stopMic : startMic} disabled={loading} style={{
                        width: 32, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: listening ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.05)',
                        color: listening ? '#fca5a5' : 'rgba(255,255,255,.38)',
                        transition: 'background .15s, color .15s',
                        opacity: loading ? 0.35 : 1,
                      }}>
                        {listening ? <MicOff style={{ width: 13, height: 13 }} /> : <Mic style={{ width: 13, height: 13 }} />}
                      </button>
                    )}

                    <button onClick={() => send()} disabled={!canSend} style={{
                      height: 32, padding: '0 14px', borderRadius: 9, border: 'none', cursor: canSend ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: canSend ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'rgba(255,255,255,.05)',
                      color: canSend ? 'white' : 'rgba(255,255,255,.25)',
                      fontSize: 12, fontWeight: 600, fontFamily: 'Tajawal,sans-serif',
                      transition: 'background .2s, color .2s',
                      boxShadow: canSend ? '0 0 18px rgba(99,102,241,.4)' : 'none',
                    }}>
                      {loading
                        ? <Loader2 className="wa-spin" style={{ width: 13, height: 13 }} />
                        : <><Send style={{ width: 13, height: 13, transform: 'scaleX(-1)' }} /><span>إرسال</span></>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
