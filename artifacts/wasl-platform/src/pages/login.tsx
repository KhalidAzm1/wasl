import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';

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
      toast({ title: 'خطأ في تسجيل الدخول', description: error?.message ?? 'بيانات الدخول غير صحيحة', variant: 'destructive' });
      return;
    }

    if (data.session.user.user_metadata?.must_change_password) {
      navigate('/change-password');
    } else {
      navigate('/portfolio');
    }
  }

  return (
    <div dir="rtl" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm glass-panel rounded-3xl p-8 space-y-6">
        <div className="flex justify-center">
          <img src={logoUrl} alt="Wasl" className="no-mirror w-72 h-auto" />
        </div>
        <h1 className="text-2xl font-bold text-white text-center">تسجيل الدخول</h1>
        <div className="space-y-2">
          <label className="text-sm text-white/60">البريد الإلكتروني</label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" dir="ltr" />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-white/60">كلمة المرور</label>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'جارٍ الدخول...' : 'دخول'}
        </Button>
      </form>
    </div>
  );
}
