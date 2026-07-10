import React, { useState } from 'react';
import { useGetDashboardSummary, useListBanks, useListProducts, useListProductTypes, useGetBank, useUpdateBank, getGetBankQueryKey, getListBanksQueryKey } from '@workspace/api-client-react';
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

function KpiButton({ label, value, colorClass, active, onClick }: { label: string; value: number; colorClass: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col text-right rounded-xl px-3 py-1.5 shrink-0 w-[140px] md:w-auto transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
        active ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'
      }`}
    >
      <span className="text-white/50 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1">{label}</span>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.3 }}
          className={`text-2xl md:text-3xl font-mono font-bold ${colorClass}`}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

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
  const [kpiFilter, setKpiFilter] = useState<'all' | 'inProgress' | 'completed' | 'delayed' | 'highRisk'>('all');

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

  // Mirrors the exact substring predicates used by the /dashboard/summary API
  // route, so the KPI counters and the filtered results always agree.
  const normalizeStatus = (s: string) => s.toLowerCase();
  const matchesKpi = (bank: Bank) => {
    if (kpiFilter === 'all') return true;
    if (kpiFilter === 'highRisk') return bank.riskLevel === 'High';
    const status = normalizeStatus(bank.status);
    if (kpiFilter === 'completed') return status.includes('complet');
    if (kpiFilter === 'delayed') return status.includes('delay');
    if (kpiFilter === 'inProgress') return status.includes('progress');
    return true;
  };

  const highRiskBankCount = banks.filter(b => b.riskLevel === 'High').length;

  const filteredBanks = [...banks]
    .filter(b => (filter === 'الكل' || b.category === filter) && matchesKpi(b))
    .sort((a, b) => (progressByBank.get(b.id) || 0) - (progressByBank.get(a.id) || 0));

  return (
    <div className="min-h-full flex flex-col w-full overflow-x-hidden">
      
      {/* Executive Summary Top Strip */}
      <div className="sticky top-0 z-40 bg-background/85 backdrop-blur-2xl border-b border-white/5 px-8 py-5 flex flex-col xl:flex-row xl:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
           <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight drop-shadow-md">
             WASL <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">AI HUB</span>
           </h1>
        </div>
        
        {/* KPI Strip. Horizontal scroll (snap) on mobile so 5 KPIs never
            wrap/overlap on narrow screens; normal wrapping row from md up. */}
        <div className="flex md:flex-wrap items-center gap-4 md:gap-10 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none hide-scrollbar -mx-8 px-8 md:mx-0 md:px-0">
          <KpiButton label="إجمالي البنوك" value={summary.totalBanks} colorClass="text-white" active={kpiFilter === 'all'} onClick={() => setKpiFilter('all')} />
          <div className="hidden md:block w-px h-8 md:h-10 bg-white/10 shrink-0" />
          <KpiButton label="قيد التنفيذ" value={summary.inProgress} colorClass="text-yellow-400" active={kpiFilter === 'inProgress'} onClick={() => setKpiFilter(kpiFilter === 'inProgress' ? 'all' : 'inProgress')} />
          <div className="hidden md:block w-px h-8 md:h-10 bg-white/10 shrink-0" />
          <KpiButton label="مكتمل" value={summary.completed} colorClass="text-emerald-400" active={kpiFilter === 'completed'} onClick={() => setKpiFilter(kpiFilter === 'completed' ? 'all' : 'completed')} />
          <div className="hidden md:block w-px h-8 md:h-10 bg-white/10 shrink-0" />
          <KpiButton label="متأخر" value={summary.delayed} colorClass="text-red-400" active={kpiFilter === 'delayed'} onClick={() => setKpiFilter(kpiFilter === 'delayed' ? 'all' : 'delayed')} />
          <div className="hidden md:block w-px h-8 md:h-10 bg-white/10 shrink-0" />
          <KpiButton label="مخاطر عالية" value={highRiskBankCount} colorClass="text-red-400" active={kpiFilter === 'highRisk'} onClick={() => setKpiFilter(kpiFilter === 'highRisk' ? 'all' : 'highRisk')} />
        </div>
      </div>

      {kpiFilter !== 'all' && (
        <div className="px-8 md:px-10 max-w-[1920px] mx-auto w-full -mb-4 pt-4">
          <button
            onClick={() => setKpiFilter('all')}
            className="text-sm text-primary hover:text-white bg-primary/10 hover:bg-primary/30 border border-primary/30 rounded-full px-4 py-1.5 transition-colors"
          >
            ✕ إزالة الفلتر
          </button>
        </div>
      )}

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
            key={`${filter}-${kpiFilter}`}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: 20, transition: { duration: 0.3 } }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24"
          >
            {filteredBanks.map(bank => (
              <CompactBankCard
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
  const { data: productTypes } = useListProductTypes();

  React.useEffect(() => {
    if (open) setForm(bank);
  }, [open, bank]);

  const contacts = form.contacts || [];

  const updateContact = (idx: number, field: 'name' | 'title' | 'phone' | 'email', value: string) => {
    const next = contacts.map((c, i) => i === idx ? { ...c, [field]: value } : c);
    setForm({ ...form, contacts: next });
  };

  const handleSave = () => {
    const payload = {
      status: form.status,
      responsiblePerson: form.responsiblePerson?.trim() ? form.responsiblePerson : null,
      relationshipManager: form.relationshipManager?.trim() ? form.relationshipManager : null,
      email: form.email?.trim() ? form.email : null,
      website: form.website?.trim() ? form.website : null,
      lastMeetingDate: form.lastMeetingDate || undefined,
      lastMeetingSummary: form.lastMeetingSummary || undefined,
      nextMeetingDate: form.nextMeetingDate || undefined,
      nextMeetingTopic: form.nextMeetingTopic || undefined,
      nextAction: form.nextAction || undefined,
      executiveSummary: form.executiveSummary || undefined,
      descriptionNotes: form.descriptionNotes || undefined,
      contacts: contacts.filter(c => c.name?.trim()),
      productTypeIds: form.productTypeIds || [],
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
              <label className="text-sm text-white/70">مدير العلاقة</label>
              <Input value={form.relationshipManager || ''} onChange={e => setForm({ ...form, relationshipManager: e.target.value })} className="bg-white/5 border-white/10" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">البريد الإلكتروني</label>
              <Input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-white/5 border-white/10" dir="ltr" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">الموقع الإلكتروني</label>
              <Input value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })} className="bg-white/5 border-white/10" dir="ltr" />
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
            <label className="text-sm text-white/70">أنواع المنتجات</label>
            <div className="flex flex-wrap gap-2">
              {(productTypes || []).filter(pt => pt.isActive).map(pt => {
                const selected = (form.productTypeIds || []).includes(pt.id);
                return (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => {
                      const current = form.productTypeIds || [];
                      const next = selected ? current.filter(id => id !== pt.id) : [...current, pt.id];
                      setForm({ ...form, productTypeIds: next });
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selected ? 'bg-primary text-white border-primary' : 'bg-white/5 text-white/60 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {pt.name}
                  </button>
                );
              })}
              {(!productTypes || productTypes.length === 0) && (
                <span className="text-sm text-white/30">لا توجد أنواع منتجات معرّفة بعد (يمكن إضافتها من الإعدادات)</span>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/10">
            <label className="text-sm text-white/70">جهات الاتصال</label>
            {contacts.map((c, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2">
                <Input value={c.name || ''} placeholder="الاسم" onChange={e => updateContact(idx, 'name', e.target.value)} className="bg-white/5 border-white/10" />
                <Input value={c.title || ''} placeholder="المسمى" onChange={e => updateContact(idx, 'title', e.target.value)} className="bg-white/5 border-white/10" />
                <Input value={c.phone || ''} placeholder="الجوال" onChange={e => updateContact(idx, 'phone', e.target.value)} className="bg-white/5 border-white/10" dir="ltr" />
                <Input value={c.email || ''} placeholder="البريد الإلكتروني" onChange={e => updateContact(idx, 'email', e.target.value)} className="bg-white/5 border-white/10 col-span-3" dir="ltr" />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setForm({ ...form, contacts: [...contacts, { name: '', title: '', phone: '', email: '' }] })}>
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

function CompactBankCard({ bankSummary, hoveredId, setHoveredId }: { bankSummary: Bank, hoveredId: string | null, setHoveredId: (id: string | null) => void }) {
  const { data: bankDetail } = useGetBank(bankSummary.id, {
    query: { queryKey: getGetBankQueryKey(bankSummary.id) }
  });
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isHovered = hoveredId === bankSummary.id;

  const displayBank = bankDetail || bankSummary;
  const products = (displayBank as BankDetail).products;
  const avgProgress = products?.length 
    ? products.reduce((acc, p) => acc + p.progressPercent, 0) / products.length 
    : 0;

  return (
    <motion.div variants={itemVariants} className="will-change-transform relative">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditOpen(true); }}
        className="absolute top-3 left-3 z-40 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/70 hover:text-white hover:bg-primary/60 hover:border-primary transition-all"
        title="تعديل بيانات البنك"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <EditBankDialog bank={displayBank} open={isEditOpen} onOpenChange={setIsEditOpen} />
      <Link
        href={`/bank/${displayBank.id}`}
        className="block relative group rounded-3xl focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/70"
        onFocus={() => setHoveredId(displayBank.id)}
        onBlur={() => { if (hoveredId === displayBank.id) setHoveredId(null); }}
      >
        <motion.div
          onMouseEnter={() => setHoveredId(displayBank.id)}
          onMouseLeave={() => setHoveredId(null)}
          animate={{
            scale: isHovered ? 1.03 : 1,
            y: isHovered ? -6 : 0,
          }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full h-[340px] rounded-3xl overflow-hidden bg-card/60 backdrop-blur-xl border border-white/10 cursor-pointer shadow-xl"
        >
          {/* Watermark logo, 10% opacity */}
          {displayBank.logoUrl && (
            <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden pointer-events-none">
              <img src={displayBank.logoUrl} alt="" className="w-3/4 h-3/4 object-contain opacity-10 blur-[1px]" />
            </div>
          )}
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-background/40 via-background/70 to-background/95" />

          {/* Premium hover glow */}
          <motion.div
            className="absolute inset-0 z-10 rounded-3xl pointer-events-none"
            animate={{ boxShadow: isHovered ? "inset 0 0 0 1.5px rgba(139,92,246,0.6), 0 20px 60px -15px rgba(79,50,214,0.55)" : "inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 0px rgba(79,50,214,0)" }}
            transition={{ duration: 0.35 }}
          />

          {/* Content Container */}
          <div className="relative z-20 w-full h-full p-5 flex flex-col gap-3">

            {/* Logo */}
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-2.5 flex items-center justify-center shadow-lg shrink-0">
                <BankLogo src={displayBank.logoUrl} alt={displayBank.nameEn} fallbackText={displayBank.nameAr.substring(0, 2)} />
              </div>
            </div>

            {/* Name */}
            <div className="min-w-0">
              <h2 className="text-lg font-black text-white leading-tight truncate">{displayBank.nameAr}</h2>
              <h3 className="text-[11px] text-white/45 font-sans tracking-[0.15em] uppercase truncate">{displayBank.nameEn}</h3>
            </div>

            {/* Status + Progress */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className={`flex items-center gap-1.5 text-xs font-bold truncate ${getStatusColor(displayBank.status).text}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(displayBank.status).dot}`} />
                <span className="truncate">{displayBank.status}</span>
              </div>
              <div className="text-base font-mono font-bold text-emerald-400 shrink-0">{formatPercentage(avgProgress)}</div>
            </div>

            <div className="h-px w-full bg-white/10" />

            {/* Meta grid: responsible, next meeting, last updated */}
            <div className="mt-auto grid grid-cols-1 gap-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/40">المسؤول</span>
                <span className="text-white/85 font-medium truncate max-w-[65%]">{displayBank.responsiblePerson || 'غير محدد'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/40">الاجتماع القادم</span>
                <span className="text-white/85 font-medium truncate max-w-[65%]">{formatDate(displayBank.nextMeetingDate)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/30">آخر تحديث</span>
                <span className="text-white/50 truncate max-w-[65%]">
                  {formatDateTime(displayBank.updatedAt)}
                  {displayBank.updatedBy && <span className="text-white/30"> · {displayBank.updatedBy}</span>}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
