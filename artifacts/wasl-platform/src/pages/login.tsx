import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

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
      <form onSubmit={handleSubmit} className="w-full max-w-sm glass-panel rounded-3xl p-8 space-y-6">
        <div className="flex justify-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow-md">
            WASL <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#00e5ff] to-secondary">AI HUB</span>
          </h1>
        </div>
        <h2 className="text-xl font-bold text-white text-center">Sign In</h2>
        <div className="space-y-2">
          <label className="text-sm text-white/60">Email</label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" dir="ltr" />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-white/60">Password</label>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
}
