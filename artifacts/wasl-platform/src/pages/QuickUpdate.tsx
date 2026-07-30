/**
 * Quick-Update page — standalone mobile form (no auth, no sidebar).
 * Opened via a QR code scanned by bank staff.
 *
 * Route: /quick-update/:token
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

export default function QuickUpdate() {
  const [, params] = useRoute('/quick-update/:token');
  const token = params?.token ?? '';

  const [bank, setBank] = useState<BankInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  // form state
  const [name, setName]     = useState('');
  const [status, setStatus] = useState('');
  const [note, setNote]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Load bank info ────────────────────────────────────────────────────────
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

  // ── Submit ────────────────────────────────────────────────────────────────
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

  // ── Render helpers ────────────────────────────────────────────────────────
  const baseCard = 'min-h-[100dvh] w-full flex flex-col items-center justify-center bg-[#050816] p-6';

  if (loading) return (
    <div className={baseCard}>
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
    </div>
  );

  if (loadError) return (
    <div className={baseCard + ' gap-4 text-center'}>
      <AlertTriangle className="w-12 h-12 text-rose-400" />
      <p className="text-rose-300 text-lg font-semibold">{loadError}</p>
      <p className="text-foreground/40 text-sm">تواصل مع فريق وصل للحصول على رابط جديد</p>
    </div>
  );

  if (submitted) return (
    <div className={baseCard + ' gap-6 text-center'}>
      <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-in zoom-in-50 duration-500">
        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground mb-1">تم الإرسال ✓</p>
        <p className="text-foreground/50">سيُحدَّث النظام فوراً لدى فريق وصل</p>
      </div>
      <div className="mt-4 px-6 py-3 rounded-2xl bg-foreground/5 border border-foreground/10 text-center">
        <p className="text-xs text-foreground/40 mb-1">البنك</p>
        <p className="text-foreground font-bold text-lg">{bank?.nameAr}</p>
        <p className="text-xs text-foreground/30 mt-1">الحالة الجديدة: {STATUSES.find(s => s.value === status)?.label}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] w-full bg-[#050816] text-white flex flex-col" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-8 pb-4">
        <WaslLogo height={32} imgClassName="w-auto" />
        <span className="text-xs text-foreground/30 uppercase tracking-widest">تحديث سريع</span>
      </div>

      {/* Bank card */}
      <div className="mx-6 mt-2 mb-6 p-4 rounded-2xl bg-foreground/5 border border-foreground/10 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-foreground/10 border border-foreground/10 flex items-center justify-center shrink-0">
          <Building2 className="w-6 h-6 text-foreground/50" />
        </div>
        <div>
          <p className="font-bold text-foreground text-lg leading-tight">{bank?.nameAr}</p>
          <p className="text-xs text-foreground/40 mt-0.5">{bank?.nameEn}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5 px-6 pb-10">

        {/* Name */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-foreground/70">اسمك <span className="text-rose-400">*</span></label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="مثال: أحمد العمري"
            required
            className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3.5 text-base text-foreground placeholder:text-foreground/25 outline-none focus:border-primary/50 focus:bg-foreground/[0.07] transition-all"
          />
        </div>

        {/* Status */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-foreground/70">الحالة الحالية <span className="text-rose-400">*</span></label>
          <div className="relative">
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              required
              className="w-full appearance-none bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3.5 text-base text-foreground outline-none focus:border-primary/50 transition-all"
            >
              {STATUSES.map(s => (
                <option key={s.value} value={s.value} className="bg-[#050816]">{s.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          </div>
        </div>

        {/* Note */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-foreground/70">ملاحظة <span className="text-foreground/30 font-normal">(اختياري)</span></label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="أي تفاصيل إضافية..."
            className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 text-base text-foreground placeholder:text-foreground/25 outline-none focus:border-primary/50 transition-all resize-none"
          />
        </div>

        {submitError && (
          <p className="text-rose-400 text-sm text-center bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-auto w-full py-4 rounded-2xl text-white font-bold text-lg bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_30px_-5px_rgba(79,50,214,0.5)] active:scale-[0.98]"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'إرسال التحديث'}
        </button>

        <p className="text-center text-xs text-foreground/20 pb-2">
          منصة وصل — التحديثات تنعكس فورياً في النظام
        </p>
      </form>
    </div>
  );
}
