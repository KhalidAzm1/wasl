import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, User, Loader2, Sparkles, RotateCcw } from 'lucide-react';
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
}

const WELCOME: Message = {
  role: 'assistant',
  content: `مرحباً! أنا **Wasl AI** 🏦

أنا مساعدك الذكي المتخصص في بيانات البنوك على منصة وصل. يمكنني مساعدتك في:

• 📊 حالة أي بنك وتقدم التنفيذ
• ⚠️ المخاطر والإجراءات المفتوحة
• 📅 الاجتماعات القادمة
• ✏️ تحديث بيانات البنوك مباشرة

اسألني بالعربي أو الإنجليزي!`,
};

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  // Simple markdown: bold, newlines, bullet points
  const formatted = msg.content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');

  return (
    <div className={cn('flex gap-2 items-start', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs',
        isUser ? 'bg-primary' : 'bg-gradient-to-br from-violet-500 to-purple-700'
      )}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      {/* Bubble */}
      <div className={cn(
        'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : 'bg-card border border-foreground/10 text-foreground rounded-tl-sm'
      )}
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
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

export function WaslAIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const history = [...messages.filter((m) => m !== WELCOME || messages.length === 1), userMsg];
    // Keep non-welcome history for context (last 10 turns)
    const contextHistory = messages
      .filter((m) => m.content !== WELCOME.content)
      .concat(userMsg)
      .slice(-10);

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await authedPost('/api/ai/chat', { messages: contextHistory });
      const reply: Message = {
        role: 'assistant',
        content: data.reply ?? data.error ?? 'حدث خطأ، حاول مرة أخرى.',
      };
      setMessages((prev) => [...prev, reply]);
    } catch (err: any) {
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
    setMessages([WELCOME]);
    setInput('');
  }

  return (
    <>
      {/* Floating trigger button */}
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
            {/* Backdrop (mobile) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm md:hidden"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
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
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">Wasl AI</p>
                  <p className="text-xs text-foreground/50">مساعد بيانات البنوك</p>
                </div>
                <div className="flex gap-1">
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

              {/* Input */}
              <div className="px-3 py-3 border-t border-foreground/10 shrink-0">
                <div className="flex gap-2 items-end bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اسألني عن أي بنك..."
                    rows={1}
                    disabled={loading}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/40 resize-none outline-none leading-relaxed max-h-28 disabled:opacity-50"
                    style={{ direction: input && /[\u0600-\u06FF]/.test(input[0]) ? 'rtl' : 'ltr' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || loading}
                    className="shrink-0 w-8 h-8 rounded-lg bg-primary disabled:opacity-30 flex items-center justify-center text-primary-foreground transition-all hover:bg-primary/80 active:scale-95"
                  >
                    {loading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Send className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>
                <p className="text-center text-[10px] text-foreground/30 mt-1.5">
                  Wasl AI · متخصص في بيانات البنوك فقط
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
