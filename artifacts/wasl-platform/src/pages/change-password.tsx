import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { WaslLogo } from '@/components/WaslLogo';

export default function ChangePassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setLoading(true);

    // The session in memory can be stale (expired/rotated refresh token,
    // long idle tab, etc.) by the time the form is submitted. Re-check with
    // Supabase first so we can send the user back to /login with a clear
    // message instead of surfacing a raw "Auth session missing!" error.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoading(false);
      toast({
        title: 'Session expired',
        description: 'Your session has expired, please sign in again to set your password.',
        variant: 'destructive',
      });
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
        title: 'Error',
        description: sessionExpired
          ? 'Your session has expired, please sign in again to set your password.'
          : error.message,
        variant: 'destructive',
      });
      if (sessionExpired) {
        navigate('/login');
      }
      return;
    }

    toast({ title: 'Success', description: 'Password updated successfully' });
    navigate('/portfolio');
  }

  return (
    <div dir="ltr" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm glass-panel rounded-3xl p-8 space-y-6">
        <div className="flex justify-center">
          <WaslLogo
            height={72}
            plateClassName="px-6 py-5"
            imgClassName="w-60 h-auto"
            imgStyle={{}}
          />
        </div>
        <h1 className="text-2xl font-bold text-foreground text-center">Set a New Password</h1>
        <p className="text-sm text-foreground/50 text-center">This is your first sign-in. Please set a new password before continuing.</p>
        <div className="space-y-2">
          <label className="text-sm text-foreground/60">New Password</label>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-foreground/60">Confirm Password</label>
          <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving...' : 'Save and Continue'}
        </Button>
      </form>
    </div>
  );
}
