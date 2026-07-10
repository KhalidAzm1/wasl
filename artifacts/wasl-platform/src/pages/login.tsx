import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { WaslLogo } from '@/components/WaslLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error || !data.session) {
      toast({ title: 'Login error', description: error?.message ?? 'Invalid login credentials', variant: 'destructive' });
      return;
    }

    if (data.session.user.user_metadata?.must_change_password) {
      navigate('/change-password');
    } else {
      navigate('/portfolio');
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
          <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" dir="ltr" autoComplete="username" />
        </div>
        <div className="space-y-2">
          <label htmlFor="login-password" className="text-sm text-foreground/60">Password</label>
          <Input id="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
}
