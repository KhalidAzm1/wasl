import React, { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { WaslLogo } from '@/components/WaslLogo';
import { ArrowLeft, CheckCircle, Mail } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const { toast }             = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error ?? `HTTP ${res.status}`);
      }

      setSent(true);
    } catch (err: any) {
      toast({
        title:       'تعذّر إرسال الإيميل',
        description: err?.message ?? 'يرجى المحاولة مجدداً.',
        variant:     'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  /* ── Success state ── */
  if (sent) {
    return (
      <div dir="rtl" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}>
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">تحقّق من بريدك الإلكتروني</h2>
            <p className="text-sm text-foreground/55 leading-relaxed">
              أرسلنا رابط إعادة التعيين إلى{' '}
              <span className="text-foreground font-medium">{email}</span>.
              <br />
              الرابط صالح لمدة ساعة واحدة. تحقّق من مجلد الـ spam إذا لم يصل.
            </p>
          </div>

          <Link href="/login">
            <Button variant="outline" className="w-full gap-2">
              <ArrowLeft className="w-4 h-4" />
              العودة إلى تسجيل الدخول
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div dir="rtl" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md glass-panel rounded-3xl p-8 space-y-6">

        {/* Logo */}
        <div className="flex justify-center pb-1">
          <WaslLogo imgClassName="w-full max-w-[240px] h-auto" imgStyle={{}} />
        </div>

        {/* Heading */}
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold text-foreground">نسيت كلمة المرور؟</h2>
          <p className="text-sm text-foreground/50 leading-relaxed">
            أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين فوراً.
          </p>
        </div>

        {/* Email field */}
        <div className="space-y-2">
          <label htmlFor="reset-email" className="text-sm text-foreground/60">
            البريد الإلكتروني
          </label>
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 pointer-events-none" />
            <Input
              id="reset-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              dir="ltr"
              autoComplete="email"
              className="pr-9"
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
          {loading ? 'جارٍ الإرسال…' : 'إرسال رابط إعادة التعيين'}
        </Button>

        <Link href="/login">
          <Button variant="ghost" className="w-full gap-2 text-foreground/50">
            <ArrowLeft className="w-4 h-4" />
            العودة إلى تسجيل الدخول
          </Button>
        </Link>
      </form>
    </div>
  );
}
