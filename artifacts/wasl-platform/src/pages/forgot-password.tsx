import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { WaslLogo } from '@/components/WaslLogo';
import { ArrowLeft, Headphones } from 'lucide-react';

export default function ForgotPassword() {
  return (
    <div dir="rtl" className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md glass-panel rounded-3xl p-8 space-y-6 text-center">

        {/* Logo */}
        <div className="flex justify-center pb-1">
          <WaslLogo imgClassName="w-full max-w-[200px] h-auto" imgStyle={{}} />
        </div>

        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}>
          <Headphones className="w-8 h-8 text-indigo-400" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">هل نسيت كلمة المرور؟</h2>
          <p className="text-sm text-foreground/60 leading-relaxed">
            الرجاء التواصل مع الدعم الفني للمساعدة في إعادة تعيين كلمة المرور.
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
