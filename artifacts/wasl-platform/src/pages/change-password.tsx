import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';

export default function ChangePassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: 'خطأ', description: 'يجب ألا تقل كلمة المرور عن 8 أحرف', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'خطأ', description: 'كلمتا المرور غير متطابقتين', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setLoading(false);

    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'تم', description: 'تم تحديث كلمة المرور بنجاح' });
    navigate('/portfolio');
  }

  return (
    <div dir="rtl" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm glass-panel rounded-3xl p-8 space-y-6">
        <div className="flex justify-center">
          <img src={logoUrl} alt="Wasl" className="no-mirror w-32 h-auto" />
        </div>
        <h1 className="text-2xl font-bold text-white text-center">تعيين كلمة مرور جديدة</h1>
        <p className="text-sm text-white/50 text-center">هذا أول تسجيل دخول لك، يرجى تعيين كلمة مرور جديدة قبل المتابعة.</p>
        <div className="space-y-2">
          <label className="text-sm text-white/60">كلمة المرور الجديدة</label>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-white/60">تأكيد كلمة المرور</label>
          <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'جارٍ الحفظ...' : 'حفظ ومتابعة'}
        </Button>
      </form>
    </div>
  );
}
