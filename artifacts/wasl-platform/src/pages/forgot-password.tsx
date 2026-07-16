import React, { useState } from 'react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { WaslLogo } from '@/components/WaslLogo';
import { ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);
  const { toast }           = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // After clicking the link, Supabase redirects here so the user can set a new password
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      // Never reveal whether the email exists — always show success to prevent enumeration
      // But log the real error for debugging
      console.error('[ForgotPassword]', error.message);
    }

    // Always show success (security best practice: don't reveal if email exists)
    setSent(true);
  }

  if (sent) {
    return (
      <div dir="ltr" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 space-y-6 text-center">
          <CheckCircle className="mx-auto w-12 h-12 text-emerald-500" />
          <h2 className="text-xl font-bold text-foreground">Check your email</h2>
          <p className="text-sm text-foreground/60">
            If <span className="text-foreground font-medium">{email}</span> is registered, you'll receive a
            password reset link shortly. Check your spam folder if you don't see it.
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </Button>
          </Link>
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
          <h2 className="text-xl font-bold text-foreground text-center">Forgot Password</h2>
          <p className="text-sm text-foreground/50 text-center">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="reset-email" className="text-sm text-foreground/60">Email</label>
          <Input
            id="reset-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            dir="ltr"
            autoComplete="email"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Sending…' : 'Send Reset Link'}
        </Button>

        <Link href="/login">
          <Button variant="ghost" className="w-full gap-2 text-foreground/50">
            <ArrowLeft className="w-4 h-4" /> Back to Sign In
          </Button>
        </Link>
      </form>
    </div>
  );
}
