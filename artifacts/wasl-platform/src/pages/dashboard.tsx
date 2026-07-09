import React, { useState } from 'react';
import { useGetDashboardSummary, useListBanks, useListProducts, useGetBank, useUpdateBank, getGetBankQueryKey, getListBanksQueryKey } from '@workspace/api-client-react';
import type { Bank, BankDetail } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { Pencil, Save } from 'lucide-react';
import { BankLogo } from '@/components/BankLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatDateTime, formatPercentage, getStatusColor } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } }
};

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: banks, isLoading: isLoadingBanks } = useListBanks();
  const { data: products, isLoading: isLoadingProducts } = useListProducts();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('الكل');

  if (isLoadingSummary || isLoadingBanks || isLoadingProducts) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="text-white/50 text-xl font-light tracking-widest uppercase">جاري التحميل...</div>
      </div>
    );
  }

  if (!summary || !banks) return null;

  const progressTotals = new Map<string, { sum: number; count: number }>();
  for (const p of products || []) {
    const entry = progressTotals.get(p.bankId) || { sum: 0, count: 0 };
    entry.sum += p.progressPercent;
    entry.count += 1;
    progressTotals.set(p.bankId, entry);
  }
  const progressByBank = new Map<string, number>();
  for (const bank of banks) {
    const entry = progressTotals.get(bank.id);
    progressByBank.set(bank.id, entry && entry.count ? entry.sum / entry.count : 0);
  }

  const categories = ["الكل", ...Array.from(new Set(banks.map(b => b.category).filter(Boolean)))];
  const filteredBanks = [...(filter === 'الكل' ? banks : banks.filter(b => b.category === filter))]
    .sort((a, b) => (progressByBank.get(b.id) || 0) - (progressByBank.get(a.id) || 0));

  return (
    <div className="min-h-full flex flex-col w-full overflow-x-hidden">
      
      {/* Executive Summary Top Strip */}
      <div className="sticky top-0 z-40 bg-background/85 backdrop-blur-2xl border-b border-white/5 px-8 py-5 flex flex-col xl:flex-row xl:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
           <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight drop-shadow-md">
             المحفظة <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">الاستراتيجية</span>
           </h1>
        </div>
        
        {/* KPI Strip */}
        <div className="flex flex-wrap items-center gap-6 md:gap-10">
          <div className="flex flex-col">
            <span className="text-white/50 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1">إجمالي البنوك</span>
            <span className="text-2xl md:text-3xl font-mono font-bold text-white">{summary.totalBanks}</span>
          </div>
          <div className="w-px h-8 md:h-10 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-white/50 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1">قيد التنفيذ</span>
            <span className="text-2xl md:text-3xl font-mono font-bold text-purple-400">{summary.inProgress}</span>
          </div>
          <div className="w-px h-8 md:h-10 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-white/50 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1">مكتمل</span>
            <span className="text-2xl md:text-3xl font-mono font-bold text-emerald-400">{summary.completed}</span>
          </div>
          <div className="w-px h-8 md:h-10 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-white/50 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1">متأخر</span>
            <span className="text-2xl md:text-3xl font-mono font-bold text-orange-400">{summary.delayed}</span>
          </div>
          <div className="w-px h-8 md:h-10 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-white/50 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1">مخاطر عالية</span>
            <span className="text-2xl md:text-3xl font-mono font-bold text-red-400">{summary.highRisks}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 md:p-10 max-w-[1920px] mx-auto w-full flex flex-col gap-8">
        
        {/* Filter Strip */}
        {categories.length > 2 && (
          <div className="flex flex-wrap items-center gap-2">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  filter === cat 
                    ? 'bg-primary text-white shadow-[0_0_20px_rgba(79,50,214,0.4)]' 
                    : 'text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Gallery Grid */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={filter}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: 20, transition: { duration: 0.3 } }}
            className="grid grid-cols-1 2xl:grid-cols-2 gap-10 md:gap-14 pb-24"
          >
            {filteredBanks.map(bank => (
              <HorizontalBankCard 
                key={bank.id} 
                bankSummary={bank} 
                hoveredId={hoveredId} 
                setHoveredId={setHoveredId} 
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredBanks.length === 0 && (
          <div className="py-32 text-center text-white/30 text-2xl font-light">لا توجد بنوك مطابقة</div>
        )}
      </div>
    </div>
  );
}

function EditBankDialog({ bank, open, onOpenChange }: { bank: Bank, open: boolean, onOpenChange: (v: boolean) => void }) {
  const [form, setForm] = useState<Partial<Bank> & { contacts?: any[] }>(bank);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateBank = useUpdateBank();

  React.useEffect(() => {
    if (open) setForm(bank);
  }, [open, bank]);

  const contacts = form.contacts || [];

  const updateContact = (idx: number, field: 'name' | 'title' | 'phone', value: string) => {
    const next = contacts.map((c, i) => i === idx ? { ...c, [field]: value } : c);
    setForm({ ...form, contacts: next });
  };

  const handleSave = () => {
    const payload = {
      status: form.status,
      responsiblePerson: form.responsiblePerson || undefined,
      lastMeetingDate: form.lastMeetingDate || undefined,
      lastMeetingSummary: form.lastMeetingSummary || undefined,
      nextMeetingDate: form.nextMeetingDate || undefined,
      nextMeetingTopic: form.nextMeetingTopic || undefined,
      nextAction: form.nextAction || undefined,
      executiveSummary: form.executiveSummary || undefined,
      descriptionNotes: form.descriptionNotes || undefined,
      contacts: contacts.filter(c => c.name?.trim()),
    };
    updateBank.mutate({ id: bank.id, data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bank.id) });
        onOpenChange(false);
        toast({ title: 'تم الحفظ', description: 'تم تحديث بيانات البنك بنجاح' });
      },
      onError: () => {
        toast({ title: 'خطأ', description: 'فشل حفظ التعديلات', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-white/10 text-white max-h-[85vh] overflow-y-auto" dir="rtl" onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>تعديل {bank.nameAr}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70">الحالة</label>
              <select className="flex h-10 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-white focus:ring-2 focus:ring-primary"
                value={form.status || ''} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="Not Started">لم يبدأ</option>
                <option value="In Progress">قيد التنفيذ</option>
                <option value="Active - Integration In Progress">نشط - جاري التكامل</option>
                <option value="Delayed">متأخر</option>
                <option value="Completed">مكتمل</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">المسؤول</label>
              <Input value={form.responsiblePerson || ''} onChange={e => setForm({ ...form, responsiblePerson: e.target.value })} className="bg-white/5 border-white/10" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">تاريخ آخر اجتماع</label>
              <Input value={form.lastMeetingDate || ''} onChange={e => setForm({ ...form, lastMeetingDate: e.target.value })} className="bg-white/5 border-white/10" placeholder="YYYY-MM-DD" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">تاريخ الاجتماع القادم</label>
              <Input value={form.nextMeetingDate || ''} onChange={e => setForm({ ...form, nextMeetingDate: e.target.value })} className="bg-white/5 border-white/10" placeholder="YYYY-MM-DD" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/70">موضوع الاجتماع القادم</label>
            <Input value={form.nextMeetingTopic || ''} onChange={e => setForm({ ...form, nextMeetingTopic: e.target.value })} className="bg-white/5 border-white/10" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/70">الخطوة القادمة</label>
            <Input value={form.nextAction || ''} onChange={e => setForm({ ...form, nextAction: e.target.value })} className="bg-white/5 border-white/10" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/70">ملاحظات الوصف</label>
            <Textarea value={form.descriptionNotes || ''} onChange={e => setForm({ ...form, descriptionNotes: e.target.value })} className="bg-white/5 border-white/10 h-24" />
          </div>

          <div className="space-y-2 pt-2 border-t border-white/10">
            <label className="text-sm text-white/70">جهات الاتصال</label>
            {contacts.map((c, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2">
                <Input value={c.name || ''} placeholder="الاسم" onChange={e => updateContact(idx, 'name', e.target.value)} className="bg-white/5 border-white/10" />
                <Input value={c.title || ''} placeholder="المسمى" onChange={e => updateContact(idx, 'title', e.target.value)} className="bg-white/5 border-white/10" />
                <Input value={c.phone || ''} placeholder="الجوال" onChange={e => updateContact(idx, 'phone', e.target.value)} className="bg-white/5 border-white/10" dir="ltr" />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setForm({ ...form, contacts: [...contacts, { name: '', title: '', phone: '' }] })}>
              + إضافة جهة اتصال
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} className="w-full gap-2" disabled={updateBank.isPending}>
            <Save className="w-4 h-4" /> {updateBank.isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HorizontalBankCard({ bankSummary, hoveredId, setHoveredId }: { bankSummary: Bank, hoveredId: string | null, setHoveredId: (id: string | null) => void }) {
  const { data: bankDetail } = useGetBank(bankSummary.id, {
    query: { queryKey: getGetBankQueryKey(bankSummary.id) }
  });
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isHovered = hoveredId === bankSummary.id;
  const isDimmed = hoveredId !== null && hoveredId !== bankSummary.id;

  const displayBank = bankDetail || bankSummary;
  const products = (displayBank as BankDetail).products;
  const avgProgress = products?.length 
    ? products.reduce((acc, p) => acc + p.progressPercent, 0) / products.length 
    : 0;

  return (
    <motion.div variants={itemVariants} className="will-change-transform h-full relative">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditOpen(true); }}
        className="absolute top-6 left-6 z-40 w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/70 hover:text-white hover:bg-primary/60 hover:border-primary transition-all"
        title="تعديل بيانات البنك"
      >
        <Pencil className="w-4 h-4" />
      </button>
      <EditBankDialog bank={displayBank} open={isEditOpen} onOpenChange={setIsEditOpen} />
      <Link
        href={`/bank/${displayBank.id}`}
        className="block relative group rounded-[2.5rem] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/70 h-full"
        onFocus={() => setHoveredId(displayBank.id)}
        onBlur={() => { if (hoveredId === displayBank.id) setHoveredId(null); }}
      >
        <motion.div
          onMouseEnter={() => setHoveredId(displayBank.id)}
          onMouseLeave={() => setHoveredId(null)}
          animate={{
            scale: isHovered ? 1.02 : isDimmed ? 0.98 : 1,
            opacity: isDimmed ? 0.4 : 1,
            filter: isDimmed ? "blur(8px) brightness(0.7)" : "blur(0px) brightness(1)",
            y: isHovered ? -8 : 0,
          }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full h-full min-h-[300px] md:min-h-[340px] rounded-[2.5rem] overflow-hidden bg-card border border-white/5 cursor-pointer shadow-2xl"
        >
          {/* Background Image / Gradient */}
          <div className="absolute inset-0 z-0">
            {displayBank.heroImageUrl ? (
              <motion.img 
                src={displayBank.heroImageUrl} 
                alt="" 
                className="w-full h-full object-cover mix-blend-luminosity opacity-40"
                animate={{ scale: isHovered ? 1.1 : 1.05 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/5 opacity-40" />
            )}
          </div>
          
          {/* Gradients: RTL -> From Right to Left */}
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-background/95 via-background/60 to-transparent opacity-95 md:bg-gradient-to-l md:from-background md:via-background/80 md:to-transparent" />
          
          <motion.div 
            className="absolute inset-0 z-10 bg-gradient-to-br from-primary/30 via-primary/5 to-transparent mix-blend-screen"
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.5 }}
          />

          {/* Dynamic Glare Effect */}
          <motion.div 
            className="absolute inset-0 z-30 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none"
            animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? '100%' : '-100%' }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />

          {/* Content Container */}
          <div className="relative z-20 w-full h-full p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            
            {/* Logo Section */}
            <motion.div 
              className="shrink-0"
              animate={{ scale: isHovered ? 1.05 : 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
               <div className="w-32 h-32 md:w-44 md:h-44 rounded-[2rem] bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-8 flex items-center justify-center shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                 <BankLogo src={displayBank.logoUrl} alt={displayBank.nameEn} fallbackText={displayBank.nameAr.substring(0, 2)} />
               </div>
            </motion.div>

            {/* Info Section */}
            <div className="flex-1 w-full flex flex-col justify-center gap-6">
              
              {/* Headers */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                 <div>
                   <h2 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight drop-shadow-xl leading-tight">{displayBank.nameAr}</h2>
                   <h3 className="text-base md:text-xl text-white/50 font-sans tracking-[0.2em] uppercase">{displayBank.nameEn}</h3>
                 </div>
                 {displayBank.priorityImpact === 'HOT' && (
                   <div className="shrink-0 px-5 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full font-bold tracking-widest text-sm backdrop-blur-md self-start mt-2">
                     أولوية قصوى
                   </div>
                 )}
              </div>

              <div className="h-px w-full bg-white/10 my-2" />

              {/* Stats Row */}
              <div className="flex flex-wrap gap-8 md:gap-14 items-end justify-start">
                 
                 <div className="shrink-0 group-hover:drop-shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all duration-500">
                    <div className="text-3xl md:text-4xl font-mono font-bold text-emerald-400">{formatPercentage(avgProgress)}</div>
                    <div className="text-white/50 text-[11px] md:text-xs uppercase tracking-widest mt-2 font-medium">نسبة الإنجاز</div>
                 </div>
                 
                 <div className="shrink-0">
                    <div className={`flex items-center gap-2 text-xl md:text-2xl font-bold drop-shadow-xl ${getStatusColor(displayBank.status).text}`}>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${getStatusColor(displayBank.status).dot}`} />
                      {displayBank.status}
                    </div>
                    <div className="text-white/50 text-[11px] md:text-xs uppercase tracking-widest mt-2 font-medium">الحالة</div>
                 </div>

                 <div className="shrink-0 max-w-[180px]">
                    <div className="text-lg md:text-xl text-white font-medium truncate drop-shadow-xl">{displayBank.responsiblePerson || 'غير محدد'}</div>
                    <div className="text-white/50 text-[11px] md:text-xs uppercase tracking-widest mt-2 font-medium">المسؤول</div>
                 </div>

                 <div className="shrink-0">
                    <div className="text-lg md:text-xl text-white font-medium drop-shadow-xl">{formatDate(displayBank.lastMeetingDate)}</div>
                    <div className="text-white/50 text-[11px] md:text-xs uppercase tracking-widest mt-2 font-medium">آخر اجتماع</div>
                 </div>

                 <div className="shrink-0 hidden sm:block">
                    <div className="text-lg md:text-xl text-white font-medium drop-shadow-xl">{formatDate(displayBank.nextMeetingDate)}</div>
                    <div className="text-white/50 text-[11px] md:text-xs uppercase tracking-widest mt-2 font-medium">الاجتماع القادم</div>
                 </div>

              </div>

              <div className="text-white/30 text-xs">آخر تحديث: {formatDateTime(displayBank.updatedAt)}</div>
            </div>

          </div>
          
          {/* Cinematic Glow Border */}
          <motion.div 
            className="absolute inset-0 z-30 rounded-[2.5rem] border-2 border-primary/60 pointer-events-none mix-blend-overlay"
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.5 }}
          />
          <motion.div 
            className="absolute inset-0 z-[-1] rounded-[2.5rem] pointer-events-none"
            animate={{ boxShadow: isHovered ? "0 0 80px -20px rgba(79,50,214,0.6)" : "0 0 0px rgba(79,50,214,0)" }}
            transition={{ duration: 0.5 }}
          />
        </motion.div>
      </Link>
    </motion.div>
  );
}
