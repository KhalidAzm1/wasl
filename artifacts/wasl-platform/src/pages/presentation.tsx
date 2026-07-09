import React from 'react';
import { useGetBank, useListBanks, getGetBankQueryKey } from '@workspace/api-client-react';
import { BankLogo } from '@/components/BankLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Target, AlertTriangle, CheckSquare, Clock } from 'lucide-react';
import { formatDate, formatPercentage } from '@/lib/utils';
import { NavControls } from '@/components/NavControls';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';

// We fetch full detail for each slide dynamically.
export function BankSlide({ bankId, isActive }: { bankId: string, isActive: boolean }) {
  const { data: bank, isLoading } = useGetBank(bankId, {
    query: { enabled: !!bankId && isActive, queryKey: getGetBankQueryKey(bankId) }
  });

  if (!isActive) return null;

  if (isLoading || !bank) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Calculate average progress from products
  const avgProgress = bank.products?.length 
    ? bank.products.reduce((acc, p) => acc + p.progressPercent, 0) / bank.products.length 
    : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 p-12 flex flex-col gap-8 h-full"
    >
      {/* Background Hero Layer */}
      {bank.heroImageUrl && (
        <div className="absolute inset-0 z-[-1] overflow-hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px] z-10" />
          <img src={bank.heroImageUrl} alt="" className="w-full h-full object-cover opacity-30 mix-blend-luminosity" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 p-2 flex items-center justify-center overflow-hidden shadow-2xl backdrop-blur-md">
            <BankLogo src={bank.logoUrl} alt={bank.nameEn} fallbackText={bank.nameAr.substring(0, 2)} />
          </div>
          <div>
            <h1 className="text-5xl font-black text-white mb-2 tracking-tight">{bank.nameAr}</h1>
            <h2 className="text-xl text-white/50 font-sans tracking-wide uppercase">{bank.nameEn}</h2>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="text-center px-6 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <p className="text-white/40 text-sm mb-1">نسبة الإنجاز</p>
            <p className="text-3xl font-bold text-emerald-400 font-mono">{formatPercentage(avgProgress)}</p>
          </div>
          <div className="text-center px-6 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <p className="text-white/40 text-sm mb-1">الحالة</p>
            <Badge variant={bank.status === 'Completed' ? 'success' : 'default'} className="text-lg py-1">
              {bank.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-12 gap-8 min-h-0">
        
        {/* Left Column (Main Specs) */}
        <div className="col-span-8 flex flex-col gap-6 min-h-0">
          
          <Card className="flex-none bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold text-white/80 mb-4 border-b border-white/10 pb-4">الملخص التنفيذي</h3>
              <p className="text-2xl leading-relaxed text-white/90">
                {bank.executiveSummary || 'لا يوجد ملخص تنفيذي مدخل.'}
              </p>
            </CardContent>
          </Card>

          <Card className="flex-1 min-h-0 flex flex-col bg-white/5 border-white/10 backdrop-blur-md overflow-hidden">
            <CardContent className="p-8 flex-1 overflow-y-auto hide-scrollbar">
              <h3 className="text-xl font-bold text-white/80 mb-6 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" />
                أحدث الإجراءات والقرارات
              </h3>
              <div className="space-y-4">
                {bank.actionItems?.slice(0, 4).map(action => (
                  <div key={action.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-start gap-4">
                    <div className={`w-2 h-2 mt-2 rounded-full ${action.status === 'Completed' ? 'bg-emerald-400' : 'bg-orange-400'}`} />
                    <div className="flex-1">
                      <p className="text-lg text-white/90">{action.description}</p>
                      <div className="flex gap-4 mt-2 text-sm text-white/40">
                        {action.owner && <span>المالك: {action.owner}</span>}
                        {action.dueDate && <span>الموعد: {formatDate(action.dueDate)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {(!bank.actionItems || bank.actionItems.length === 0) && (
                  <div className="text-center text-white/30 py-8 text-lg">لا توجد إجراءات حالية</div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column (Details & Risks) */}
        <div className="col-span-4 flex flex-col gap-6 min-h-0">
          
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="p-8 space-y-6">
              <div>
                <p className="text-white/40 text-sm mb-1 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  المسؤول
                </p>
                <p className="text-xl text-white font-medium">{bank.responsiblePerson || 'غير محدد'}</p>
              </div>
              <div className="h-px w-full bg-white/10" />
              <div>
                <p className="text-white/40 text-sm mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  الاجتماع القادم
                </p>
                <p className="text-xl text-white font-medium">{formatDate(bank.nextMeetingDate)}</p>
                {bank.nextMeetingTopic && <p className="text-white/60 mt-1">{bank.nextMeetingTopic}</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1 min-h-0 bg-white/5 border-white/10 backdrop-blur-md overflow-hidden flex flex-col">
            <CardContent className="p-8 flex-1 overflow-y-auto hide-scrollbar">
              <h3 className="text-xl font-bold text-white/80 mb-6 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                المخاطر الرئيسية
              </h3>
              <div className="space-y-4">
                {bank.risks?.map(risk => (
                  <div key={risk.id} className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="destructive">{risk.level}</Badge>
                      <span className="text-xs text-white/40">{risk.status}</span>
                    </div>
                    <p className="text-white/90">{risk.description}</p>
                  </div>
                ))}
                {(!bank.risks || bank.risks.length === 0) && (
                  <div className="text-center text-white/30 py-8 text-lg">لا توجد مخاطر مسجلة</div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </motion.div>
  );
}

export default function PresentationMode() {
  const { data: banks, isLoading } = useListBanks();
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!banks) return;
      if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => Math.min(prev + 1, banks.length - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [banks]);

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center">جاري التحميل...</div>;
  }

  if (!banks || banks.length === 0) {
    return <div className="h-screen w-full flex items-center justify-center">لا توجد بنوك لعرضها</div>;
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      <AnimatePresence mode="wait">
        <BankSlide key={banks[currentIndex].id} bankId={banks[currentIndex].id} isActive={true} />
      </AnimatePresence>

      {/* Progress / Navigation indicator */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 z-50">
        {banks.map((b, idx) => (
          <button
            key={b.id}
            onClick={() => setCurrentIndex(idx)}
            className={`h-2 rounded-full transition-all duration-300 ${
              idx === currentIndex ? 'w-12 bg-primary' : 'w-2 bg-white/20 hover:bg-white/40'
            }`}
          />
        ))}
      </div>

      {/* Brand + navigation overlay */}
      <img src={logoUrl} alt="Wasl" className="absolute top-6 left-6 w-24 h-auto z-50 opacity-95 drop-shadow-lg" />
      <div className="absolute top-6 right-6 z-50">
        <NavControls variant="overlay" />
      </div>
    </div>
  );
}
