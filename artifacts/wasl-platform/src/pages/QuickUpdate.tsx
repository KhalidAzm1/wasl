/**
 * Quick-Update page — standalone public form (no auth, no sidebar).
 * Opened via QR code or shared link by bank staff.
 *
 * Route: /quick-update/:token
 *
 * Uses explicit colours (not CSS-variable-based) so the dark card
 * looks correct regardless of the app's current light/dark mode.
 */
import React, { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { CheckCircle2, Loader2, AlertTriangle, Building2, ChevronDown } from 'lucide-react';
import { WaslLogo } from '@/components/WaslLogo';

interface BankInfo { id: string; nameEn: string; nameAr: string; status: string }

const STATUSES = [
  { value: 'In Progress',                      label: 'قيد التنفيذ' },
  { value: 'Active - Integration In Progress', label: 'تكامل نشط' },
  { value: 'Completed',                        label: 'مكتمل' },
  { value: 'Delayed',                          label: 'متأخر' },
  { value: 'Not Started',                      label: 'لم يبدأ' },
];

// ─── Shared card wrapper — dark regardless of app theme ─────────────────────
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ background: 'linear-gradient(160deg,#07091a 0%,#0b0f28 60%,#050816 100%)' }}
      className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-8"
    >
      <div
        className="w-full max-w-[480px] rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function QuickUpdate() {
  const [, params] = useRoute('/quick-update/:token');
  const token = params?.token ?? '';

  const [bank, setBank]           = useState<BankInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading]     = useState(true);

  // form state
  const [name, setName]               = useState('');
  const [status, setStatus]           = useState('');
  const [note, setNote]               = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Load bank info ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`/api/quick-update/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setLoadError(data.error); }
        else { setBank(data.bank); setStatus(data.bank.status); }
      })
      .catch(() => setLoadError('تعذّر الاتصال بالخادم — حاول مرة أخرى'))
      .finally(() => setLoading(false));
  }, [token]);

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setSubmitError('الاسم مطلوب'); return; }
    if (!status)      { setSubmitError('اختر الحالة'); return; }
    setSubmitError('');
    setSubmitting(true);
    try {
      const res  = await fetch(`/api/quick-update/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submitterName: name.trim(), status, note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? 'حدث خطأ'); }
      else         { setSubmitted(true); }
    } catch {
      setSubmitError('تعذّر الاتصال بالخادم — حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) return (
    <Page>
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
      </div>
    </Page>
  );

  // ── Error ───────────────────────────────────────────────────────────────
  if (loadError) return (
    <Page>
      <div className="flex flex-col items-center gap-4 py-16 px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
        </div>
        <p className="text-rose-300 text-lg font-bold">{loadError}</p>
        <p className="text-white/30 text-sm">تواصل مع فريق وصل للحصول على رابط جديد</p>
      </div>
    </Page>
  );

  // ── Success ─────────────────────────────────────────────────────────────
  if (submitted) return (
    <Page>
      <div className="flex flex-col items-center gap-6 py-16 px-8 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 0 40px rgba(16,185,129,0.2)' }}
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white mb-2">تم الإرسال ✓</p>
          <p className="text-white/40 text-sm">سيُحدَّث النظام فوراً لدى فريق وصل</p>
        </div>
        <div
          className="w-full rounded-2xl px-6 py-4 text-center mt-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-xs text-white/30 mb-1">البنك</p>
          <p className="text-white font-bold text-lg">{bank?.nameAr}</p>
          <p className="text-xs text-white/30 mt-1">الحالة الجديدة: {STATUSES.find(s => s.value === status)?.label}</p>
        </div>
      </div>
    </Page>
  );

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <Page>
      <div dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <WaslLogo height={28} imgClassName="w-auto" />
          <span className="text-xs text-white/30 uppercase tracking-widest">تحديث سريع</span>
        </div>

        {/* Bank card */}
        <div className="mx-5 mt-5 mb-1 p-4 rounded-2xl flex items-center gap-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Building2 className="w-5 h-5 text-white/40" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white text-base leading-tight truncate">{bank?.nameAr}</p>
            <p className="text-xs text-white/30 mt-0.5 truncate">{bank?.nameEn}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 pt-5 pb-6">

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/60">
              اسمك <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="مثال: أحمد العمري"
              required
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
              }}
              className="w-full rounded-xl px-4 py-3 text-base outline-none transition-all
                         placeholder:text-white/20
                         focus:border-violet-500/60 focus:bg-white/[0.08]"
            />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/60">
              الحالة الحالية <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                required
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: status ? '#fff' : 'rgba(255,255,255,0.2)',
                }}
                className="w-full appearance-none rounded-xl px-4 py-3 text-base outline-none transition-all
                           focus:border-violet-500/60"
              >
                {STATUSES.map(s => (
                  <option key={s.value} value={s.value} style={{ background: '#0b0f28', color: '#fff' }}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            </div>
          </div>

          {/* Note */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/60">
              ملاحظة <span className="text-white/20 font-normal">(اختياري)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="أي تفاصيل إضافية..."
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
              }}
              className="w-full rounded-xl px-4 py-3 text-base outline-none transition-all resize-none
                         placeholder:text-white/20
                         focus:border-violet-500/60 focus:bg-white/[0.08]"
            />
          </div>

          {submitError && (
            <p className="text-rose-300 text-sm text-center rounded-xl px-4 py-2.5"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            style={{
              background: 'linear-gradient(135deg, #6d28d9, #4f32d6)',
              boxShadow: '0 0 30px rgba(109,40,217,0.4), 0 4px 24px rgba(0,0,0,0.3)',
            }}
          >
            {submitting
              ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              : 'إرسال التحديث'}
          </button>

          <p className="text-center text-xs text-white/15 pt-1">
            منصة وصل — التحديثات تنعكس فورياً في النظام
          </p>
        </form>

      </div>
    </Page>
  );
}
