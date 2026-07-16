import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { WaslLogo } from '@/components/WaslLogo';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null); // null = checking
  const [, navigate]                = useLocation();
  const { toast }                   = useToast();

  // Supabase embeds the recovery token in the URL hash.
  // onAuthStateChange fires with event=PASSWORD_RECOVERY once it's consumed.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setTokenValid(true);
      }
    });

    // If we land here without a recovery token the URL won't contain it,
    // give Supabase 3s to detect it before showing an error.
    const timeout = setTimeout(() => {
      setTokenValid((prev) => (prev === null ? false : prev));
    }, 3000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      toast({ title: 'كلمة المرور قصيرة', description: 'يجب أن تكون 8 أحرف على الأقل.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'كلمات المرور غير متطابقة', description: 'تأكد من تطابق كلمتي المرور.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ title: 'فشل تغيير كلمة المرور', description: error.message, variant: 'destructive' });
      return;
    }

    setDone(true);
    // Auto-redirect after 3 seconds
    setTimeout(() => navigate('/'), 3000);
  }

  // Still checking for the token
  if (tokenValid === null) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-foreground/50 text-sm animate-pulse">Verifying reset link…</div>
      </div>
    );
  }

  // Invalid / expired link
  if (tokenValid === false) {
    return (
      <div dir="ltr" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 space-y-6 text-center">
          <AlertCircle className="mx-auto w-12 h-12 text-red-500" />
          <h2 className="text-xl font-bold text-foreground">رابط منتهي الصلاحية</h2>
          <p className="text-sm text-foreground/60">
            رابط إعادة تعيين كلمة المرور غير صالح أو انتهت صلاحيته.
            طلب رابطاً جديداً من صفحة تسجيل الدخول.
          </p>
          <Button className="w-full" onClick={() => navigate('/forgot-password')}>
            طلب رابط جديد
          </Button>
        </div>
      </div>
    );
  }

  // Success
  if (done) {
    return (
      <div dir="ltr" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 space-y-6 text-center">
          <CheckCircle className="mx-auto w-12 h-12 text-emerald-500" />
          <h2 className="text-xl font-bold text-foreground">تم تغيير كلمة المرور</h2>
          <p className="text-sm text-foreground/60">سيتم توجيهك تلقائياً…</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="ltr" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md glass-panel rounded-3xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 pb-2">
          <div className="w-full flex justify-center">
            <WaslLogo imgClassName="w-full max-w-[280px] h-auto" imgStyle={{}} />
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground text-center">New Password</h2>
          <p className="text-sm text-foreground/50 text-center">Choose a strong password (min. 8 characters).</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="rp-password" className="text-sm text-foreground/60">New Password</label>
          <Input
            id="rp-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="rp-confirm" className="text-sm text-foreground/60">Confirm Password</label>
          <Input
            id="rp-confirm"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            dir="ltr"
            autoComplete="new-password"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving…' : 'Set New Password'}
        </Button>
      </form>
    </div>
  );
}
