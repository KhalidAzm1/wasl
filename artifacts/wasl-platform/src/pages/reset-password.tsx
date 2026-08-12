import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { WaslLogo } from '@/components/WaslLogo';
import { CheckCircle, AlertCircle, Check, X } from 'lucide-react';

/* ── Password rules (shared with change-password) ───────────────────────── */
const RULES = [
  { id: 'len',     label: '٨ أحرف على الأقل',                test: (p: string) => p.length >= 8 },
  { id: 'upper',   label: 'حرف كبير (A-Z)',                  test: (p: string) => /[A-Z]/.test(p) },
  { id: 'special', label: 'رمز خاص (!@#$%^&*…)',             test: (p: string) => /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/.test(p) },
];

function RuleRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {ok
        ? <Check size={13} style={{ color: '#34d399', flexShrink: 0 }} />
        : <X     size={13} style={{ color: '#6b7280', flexShrink: 0 }} />}
      <span style={{ fontSize: 12, color: ok ? '#34d399' : '#9ca3af', fontFamily: 'Tajawal, sans-serif' }}>
        {label}
      </span>
    </div>
  );
}

export default function ResetPassword() {
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [, navigate]                = useLocation();
  const { toast }                   = useToast();

  const ruleResults = RULES.map(r => ({ ...r, ok: r.test(password) }));
  const allPassed   = ruleResults.every(r => r.ok);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setTokenValid(true);
    });
    const timeout = setTimeout(() => {
      setTokenValid(prev => (prev === null ? false : prev));
    }, 3000);
    return () => { listener.subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!allPassed) {
      toast({ title: 'كلمة المرور لا تستوفي المتطلبات', description: 'يرجى استيفاء جميع الشروط الموضحة أدناه', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'كلمة المرور غير متطابقة', description: 'تأكد من تطابق كلمتَي المرور', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ title: 'فشل تعيين كلمة المرور', description: error.message, variant: 'destructive' });
      return;
    }

    setDone(true);
    setTimeout(() => navigate('/'), 3000);
  }

  if (tokenValid === null) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-foreground/50 text-sm animate-pulse">جارٍ التحقق من الرابط…</div>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div dir="rtl" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 space-y-6 text-center">
          <AlertCircle className="mx-auto w-12 h-12 text-red-500" />
          <h2 className="text-xl font-bold text-foreground">الرابط منتهي الصلاحية</h2>
          <p className="text-sm text-foreground/60">رابط إعادة تعيين كلمة المرور غير صالح أو منتهي. اطلب رابطاً جديداً.</p>
          <Button className="w-full" onClick={() => navigate('/forgot-password')}>طلب رابط جديد</Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div dir="rtl" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 space-y-6 text-center">
          <CheckCircle className="mx-auto w-12 h-12 text-emerald-500" />
          <h2 className="text-xl font-bold text-foreground">تم تحديث كلمة المرور</h2>
          <p className="text-sm text-foreground/60">سيتم توجيهك تلقائياً…</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md glass-panel rounded-3xl p-8 space-y-5">
        <div className="flex flex-col items-center gap-3 pb-2">
          <WaslLogo imgClassName="w-full max-w-[280px] h-auto" imgStyle={{}} />
        </div>

        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold text-foreground">كلمة مرور جديدة</h2>
          <p className="text-sm text-foreground/50">اختر كلمة مرور قوية تستوفي الشروط أدناه</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="rp-password" className="text-sm text-foreground/60">كلمة المرور الجديدة</label>
          <Input
            id="rp-password"
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            dir="ltr"
            autoComplete="new-password"
          />
          {password.length > 0 && (
            <div className="space-y-1 pt-1">
              {ruleResults.map(r => <RuleRow key={r.id} ok={r.ok} label={r.label} />)}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="rp-confirm" className="text-sm text-foreground/60">تأكيد كلمة المرور</label>
          <Input
            id="rp-confirm"
            type="password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            dir="ltr"
            autoComplete="new-password"
          />
          {confirm.length > 0 && password !== confirm && (
            <p className="text-xs" style={{ color: '#f87171' }}>كلمتا المرور غير متطابقتين</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading || !allPassed || password !== confirm}>
          {loading ? 'جارٍ الحفظ…' : 'تعيين كلمة المرور'}
        </Button>
      </form>
    </div>
  );
}
