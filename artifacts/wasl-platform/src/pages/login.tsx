import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { WaslLogo } from '@/components/WaslLogo';
import { analytics } from '@/lib/analytics';

/** Map Supabase auth error codes / messages to clear user-facing strings */
function friendlyAuthError(err: { message?: string; status?: number } | null): string {
  if (!err) return 'حدث خطأ غير متوقع. حاول مجدداً.';

  const msg = (err.message ?? '').toLowerCase();

  // Wrong credentials
  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid_credentials') ||
    msg.includes('email not confirmed') ||      // treat unconfirmed as credential issue
    msg.includes('user not found')
  ) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }

  // Rate limiting
  if (
    msg.includes('too many requests') ||
    msg.includes('over_request_rate_limit') ||
    msg.includes('rate limit') ||
    err.status === 429
  ) {
    return 'محاولات كثيرة جداً. انتظر دقيقة ثم حاول مجدداً.';
  }

  // Account disabled / banned
  if (msg.includes('user is banned') || msg.includes('disabled')) {
    return 'هذا الحساب موقوف. تواصل مع المدير.';
  }

  // Network / server unreachable
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    err.status === 0 ||
    err.status === 503
  ) {
    return 'تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مجدداً.';
  }

  // Supabase project paused (free-tier inactivity)
  if (msg.includes('project is paused') || err.status === 503) {
    return 'خدمة المصادقة متوقفة مؤقتاً. تواصل مع المدير.';
  }

  // Fallback: return original message so nothing is ever hidden
  return err.message ?? 'حدث خطأ أثناء تسجيل الدخول. حاول مجدداً.';
}

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [, navigate]            = useLocation();
  const { toast }               = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error || !data.session) {
      toast({
        title: 'تعذّر تسجيل الدخول',
        description: friendlyAuthError(error),
        variant: 'destructive',
      });
      return;
    }

    analytics.userLogin({ email });

    if (data.session.user.user_metadata?.must_change_password) {
      navigate('/change-password');
    } else {
      navigate('/');
    }
  }

  return (
    <div dir="ltr" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md glass-panel rounded-3xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 pb-2">
          <div className="w-full flex justify-center">
            <WaslLogo imgClassName="w-full max-w-[280px] h-auto" imgStyle={{}} />
          </div>
          <p className="text-[11px] text-foreground/40 uppercase tracking-[0.15em] font-medium">Banking Intelligence Platform</p>
        </div>

        <h2 className="text-xl font-bold text-foreground text-center">Sign In</h2>

        <div className="space-y-2">
          <label htmlFor="login-email" className="text-sm text-foreground/60">Email</label>
          <Input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            dir="ltr"
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm text-foreground/60">Password</label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
}
