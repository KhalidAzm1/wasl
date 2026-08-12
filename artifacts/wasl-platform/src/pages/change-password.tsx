import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { WaslLogo } from '@/components/WaslLogo';
import { Check, X } from 'lucide-react';

/* ── Password rules ─────────────────────────────────────────────────────── */
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

export default function ChangePassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [, navigate]            = useLocation();
  const { toast }               = useToast();

  const ruleResults = RULES.map(r => ({ ...r, ok: r.test(password) }));
  const allPassed   = ruleResults.every(r => r.ok);

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

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoading(false);
      toast({ title: 'انتهت صلاحية الجلسة', description: 'يرجى تسجيل الدخول مجدداً لتعيين كلمة المرور', variant: 'destructive' });
      navigate('/login');
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setLoading(false);

    if (error) {
      const sessionExpired = /session/i.test(error.message);
      toast({
        title: 'خطأ',
        description: sessionExpired
          ? 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً'
          : error.message,
        variant: 'destructive',
      });
      if (sessionExpired) navigate('/login');
      return;
    }

    toast({ title: 'تم بنجاح', description: 'تم تحديث كلمة المرور' });
    navigate('/portfolio');
  }

  return (
    <div dir="rtl" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm glass-panel rounded-3xl p-8 space-y-5">
        <div className="flex justify-center">
          <WaslLogo imgClassName="w-60 h-auto" imgStyle={{}} />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-foreground">تعيين كلمة مرور جديدة</h1>
          <p className="text-sm text-foreground/50">هذا أول دخول لك — يرجى تعيين كلمة مرور قبل المتابعة</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-foreground/60">كلمة المرور الجديدة</label>
          <Input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            dir="ltr"
            autoComplete="new-password"
          />
          {/* Live rules checklist */}
          {password.length > 0 && (
            <div className="space-y-1 pt-1">
              {ruleResults.map(r => <RuleRow key={r.id} ok={r.ok} label={r.label} />)}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm text-foreground/60">تأكيد كلمة المرور</label>
          <Input
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
          {loading ? 'جارٍ الحفظ…' : 'حفظ ومتابعة'}
        </Button>
      </form>
    </div>
  );
}
