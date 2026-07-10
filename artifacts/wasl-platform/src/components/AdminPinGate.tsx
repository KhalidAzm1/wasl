import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { ShieldCheck } from 'lucide-react';

const TOKEN_KEY = 'wasl_admin_pin_token';
const EXPIRES_KEY = 'wasl_admin_pin_token_expires';

// Second factor gating access to the Admin Panel, independent of Supabase
// login. The server issues a short-lived signed token on successful PIN
// verification; that token (not just a client-side flag) is required by
// every /api/admin/users/* request, so this gate can't be bypassed by
// calling the API directly or by faking sessionStorage.
export function getAdminPinToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expires = Number(sessionStorage.getItem(EXPIRES_KEY) ?? 0);
  if (!token || !expires || Date.now() > expires) return null;
  return token;
}

export function AdminPinGate({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState(() => getAdminPinToken() !== null);
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Error', description: body.error ?? 'Incorrect PIN', variant: 'destructive' });
        return;
      }
      sessionStorage.setItem(TOKEN_KEY, body.token);
      sessionStorage.setItem(EXPIRES_KEY, String(body.expiresAt));
      setVerified(true);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  }

  if (verified) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <Card className="w-full max-w-sm p-8 space-y-6">
        <div className="text-center space-y-2">
          <ShieldCheck className="w-8 h-8 mx-auto text-white/60" />
          <h2 className="text-xl font-bold text-white">Protected Access</h2>
          <p className="text-white/50 text-sm">Enter the PIN to access User Management</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            dir="ltr"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••••"
          />
          <Button type="submit" className="w-full" disabled={checking || !pin}>
            {checking ? 'Verifying...' : 'Enter'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
