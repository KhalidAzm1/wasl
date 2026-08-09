import React, { useState, useEffect, useRef } from 'react';
import { useGetDashboardSummary, useListBanks, useListProducts, useListProductTypes, useGetBank, useUpdateBank, getGetBankQueryKey, getListBanksQueryKey, useGetImplSummaryV2 } from '@workspace/api-client-react';
import type { Bank, BankSummaryV2 } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Link } from 'wouter';
import { Pencil, Save, Search, LayoutGrid, List, Columns3, User, Clock, AlertTriangle, FileText, BarChart3, Bookmark, Sun, Moon, Settings, Building2, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { BankLogo } from '@/components/BankLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime, getStatusColor, cn } from '@/lib/utils';
import { analytics } from '@/lib/analytics';
import { Command } from 'cmdk';
import { WaslLogo } from '@/components/WaslLogo';
import { useTheme } from '@/components/ThemeProvider';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};



export default function Dashboard() {
  const { theme, setTheme } = useTheme();
  const { role: userRole, assignedBankIds } = useAuth();
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: banks, isLoading: isLoadingBanks } = useListBanks();
  const { data: products, isLoading: isLoadingProducts } = useListProducts();
  const { data: implSummaries } = useGetImplSummaryV2();
  
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [filterProductCode, setFilterProductCode] = useState<string | null>(null);

  // ── Analytics: Dashboard Loaded ─────────────────────────────────────────
  const dashboardLoadedRef = useRef(false);
  useEffect(() => {
    if (isLoadingSummary || isLoadingBanks || !summary || !banks || dashboardLoadedRef.current) return;
    dashboardLoadedRef.current = true;
    analytics.dashboardLoaded({
      total_banks: summary.totalBanks,
      in_progress: summary.inProgress,
      completed: summary.completed,
      delayed: summary.delayed,
      high_risk: banks.filter(b => b.riskLevel === 'High').length,
    });
  }, [isLoadingSummary, isLoadingBanks, summary, banks]);

  // ── Analytics: Search Used (debounced 800 ms) ───────────────────────────
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!searchQuery) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      const q = searchQuery.toLowerCase();
      const count = (banks || []).filter(b =>
        b.nameEn?.toLowerCase().includes(q) ||
        b.nameAr?.toLowerCase().includes(q) ||
        b.responsiblePerson?.toLowerCase().includes(q) ||
        b.relationshipManager?.toLowerCase().includes(q)
      ).length;
      analytics.searchUsed({
        query: searchQuery,
        results_count: count,
        filters_active: false,
      });
    }, 800);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  if (isLoadingSummary || isLoadingBanks || isLoadingProducts) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_15px_-3px_rgba(79,50,214,0.5)]"></div>
        <div className="text-foreground/50 text-xl font-light tracking-widest uppercase">Initializing...</div>
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

  // Build distinct product-code badge list per bank — single pass, zero N+1
  const productCodesByBank = new Map<string, string[]>();
  for (const bank of banks) productCodesByBank.set(bank.id, []);
  for (const p of products || []) {
    const arr = productCodesByBank.get(p.bankId);
    if (arr && p.productCode && !arr.includes(p.productCode)) arr.push(p.productCode);
  }

  // All distinct product codes across all banks (for filter chips)
  const allProductCodes = Array.from(
    new Set((products || []).map(p => p.productCode).filter(Boolean))
  ).sort();

  // ── Implementation progress map & KPIs ─────────────────────────────────
  const implByBank = new Map<string, BankSummaryV2>();
  for (const s of implSummaries || []) implByBank.set(s.bankId, s);

  // Per-bank access restriction: non-admin users with assigned banks see only their own
  const isBankScopeRestricted = userRole !== 'super_admin' && userRole !== 'admin' && assignedBankIds.length > 0;

  const filteredBanks = [...banks]
    .filter(b => {
      if (isBankScopeRestricted && !assignedBankIds.includes(b.id)) return false;
      // Product code filter
      if (filterProductCode) {
        const codes = productCodesByBank.get(b.id) ?? [];
        if (!codes.includes(filterProductCode)) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          b.nameEn?.toLowerCase().includes(q) ||
          b.nameAr?.toLowerCase().includes(q) ||
          b.responsiblePerson?.toLowerCase().includes(q) ||
          b.relationshipManager?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => (progressByBank.get(b.id) || 0) - (progressByBank.get(a.id) || 0));

  const kanbanStatuses = [
    "Not Started",
    "In Progress",
    "Active - Integration In Progress",
    "Delayed",
    "Completed"
  ];
  const existingStatuses = new Set(banks.map(b => b.status).filter(Boolean));
  kanbanStatuses.forEach(s => existingStatuses.delete(s));
  const allKanbanStatuses = [...kanbanStatuses, ...Array.from(existingStatuses)];


  return (
    <div className={cn("min-h-full flex flex-col w-full", viewMode !== 'kanban' && "overflow-x-hidden")}>

      {/* ── Clean Strip Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-3xl border-b border-foreground/[0.06] shadow-2xl">

        {/* Header: 3 balanced sections with logo centered */}
        <div className="relative flex items-center px-4 sm:px-5 py-2" style={{ minHeight: 52 }}>

          {/* ── LEFT: Search ── */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Search desktop */}
            <div className="relative hidden sm:block w-36 md:w-48">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث..."
                aria-label="Search banks"
                dir="rtl"
                className="w-full bg-foreground/[0.04] border border-foreground/[0.08] rounded-xl pr-9 pl-3 py-1.5 text-xs text-foreground/70 placeholder:text-foreground/30 outline-none focus:border-primary/40 focus:bg-foreground/[0.06] transition-all"
              />
            </div>
            {/* Search mobile icon */}
            <button className="sm:hidden p-1.5 rounded-lg border border-foreground/10 text-foreground/50 hover:text-foreground transition-colors" aria-label="Search" onClick={() => setMobileSearchOpen(v => !v)}>
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── CENTER: Logo absolutely centered ── */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none">
            <WaslLogo height={40} imgClassName="w-auto" />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* ── RIGHT: views + theme + settings compact pill ── */}
          <div className="flex items-center shrink-0">
            <div className="flex items-center gap-0 border border-foreground/10 rounded-xl bg-foreground/[0.03] overflow-hidden divide-x divide-foreground/10">
              {/* View toggle */}
              <div className="flex items-center">
                <button onClick={() => setViewMode('grid')} aria-label="Grid view" aria-pressed={viewMode === 'grid'} className={cn("p-1.5 transition-colors focus:outline-none", viewMode === 'grid' ? "bg-primary/15 text-primary" : "text-foreground/30 hover:text-foreground/60")}><LayoutGrid className="w-3.5 h-3.5" /></button>
                <button onClick={() => setViewMode('list')} aria-label="List view" aria-pressed={viewMode === 'list'} className={cn("p-1.5 transition-colors focus:outline-none", viewMode === 'list' ? "bg-primary/15 text-primary" : "text-foreground/30 hover:text-foreground/60")}><List className="w-3.5 h-3.5" /></button>
                <button onClick={() => setViewMode('kanban')} aria-label="Kanban view" aria-pressed={viewMode === 'kanban'} className={cn("p-1.5 transition-colors focus:outline-none hidden sm:block", viewMode === 'kanban' ? "bg-primary/15 text-primary" : "text-foreground/30 hover:text-foreground/60")}><Columns3 className="w-3.5 h-3.5" /></button>
              </div>
              {/* Theme toggle */}
              <button type="button" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="hidden sm:flex p-1.5 text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-all">
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
              {/* Settings */}
              <button type="button" aria-label="Open settings panel" onClick={() => window.dispatchEvent(new CustomEvent('wasl:open-settings'))} className="hidden sm:flex p-1.5 text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-all">
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile search row */}
        {(mobileSearchOpen || searchQuery) && (
          <div className="sm:hidden px-4 pb-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
              <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onBlur={() => { if (!searchQuery) setMobileSearchOpen(false); }} placeholder="بحث..." aria-label="Search banks" dir="rtl" className="w-full bg-foreground/[0.04] border border-foreground/[0.08] rounded-xl pr-9 pl-3 py-2 text-xs text-foreground/70 placeholder:text-foreground/30 outline-none focus:border-primary/40 transition-all" />
            </div>
          </div>
        )}

      </div>


      {/* ── Product filter chips ─────────────────────────────────────────── */}
      {allProductCodes.length > 0 && (
        <div className="border-b border-foreground/[0.05] bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-0 px-4 sm:px-6 py-2 overflow-x-auto hide-scrollbar">
            {/* compact pill wrapping all chips */}
            <div className="flex items-center gap-0 border border-foreground/10 rounded-xl bg-foreground/[0.03] overflow-hidden divide-x divide-foreground/10">
              {allProductCodes.map(code => {
                const n = getProductNeon(code);
                const active = filterProductCode === code;
                return (
                  <button
                    key={code}
                    onClick={() => setFilterProductCode(active ? null : code)}
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black tracking-widest transition-all",
                      active
                        ? cn(n.text, n.bg)
                        : "text-foreground/35 hover:text-foreground/70 hover:bg-foreground/[0.06]"
                    )}
                  >
                    {code}
                    {active && (
                      <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold leading-none bg-white/20 ring-1 ring-white/30">
                        {filteredBanks.length}
                      </span>
                    )}
                  </button>
                );
              })}
              {/* All chip — at the end, next to last code */}
              <button
                onClick={() => setFilterProductCode(null)}
                className={cn(
                  "shrink-0 inline-flex items-center px-3 py-1.5 text-[11px] font-bold transition-all",
                  filterProductCode === null
                    ? "bg-primary/15 text-primary"
                    : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.06]"
                )}
              >
                الكل
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 p-4 sm:p-8 md:p-10 max-w-[1920px] mx-auto w-full flex flex-col gap-5 sm:gap-8">
        
        {/* Assigned-bank scope notice */}
        {isBankScopeRestricted && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-400/20 text-blue-400 text-xs font-medium">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            تعرض بنوكك المحددة فقط ({assignedBankIds.length} {assignedBankIds.length === 1 ? 'بنك' : 'بنوك'})
          </div>
        )}

        {/* Main Content Area */}
        <AnimatePresence mode="wait">
          {filteredBanks.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-32 flex flex-col items-center justify-center gap-4 text-foreground/30 text-center">
               <div className="w-16 h-16 rounded-full bg-foreground/5 border border-foreground/10 flex items-center justify-center shadow-lg"><Search className="w-6 h-6 text-foreground/20" /></div>
               <p className="text-xl font-light tracking-wide mt-2">No matching records found.</p>
               <button onClick={() => setSearchQuery('')} className="text-primary text-sm hover:underline mt-2">مسح البحث</button>
            </motion.div>
          ) : viewMode === 'kanban' ? (
            <motion.div 
              key="kanban"
              variants={containerVariants} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="flex gap-6 overflow-x-auto pb-24 hide-scrollbar snap-x snap-mandatory items-start"
            >
              {allKanbanStatuses.map(status => {
                 const columnBanks = filteredBanks.filter(b => b.status === status);
                 if (columnBanks.length === 0) return null;
                 return (
                   <div key={status} className="w-[320px] xl:w-[340px] flex-shrink-0 snap-center flex flex-col gap-4">
                     <div className="flex items-center justify-between px-2 pb-2 border-b border-foreground/5">
                       <div className="flex items-center gap-2.5">
                         <span className={`w-2 h-2 rounded-full ${getStatusColor(status).dot} shadow-[0_0_8px_currentColor]`} />
                         <h3 className="text-sm font-bold text-foreground tracking-wide">{status}</h3>
                       </div>
                       <span className="text-[10px] font-mono font-bold text-foreground/50 bg-foreground/5 border border-foreground/10 px-2 py-0.5 rounded-full">{columnBanks.length}</span>
                     </div>
                     <div className="flex flex-col gap-3">
                       {columnBanks.map(bank => (
                          <CompactBankCard key={bank.id} bankSummary={bank} hoveredId={hoveredId} setHoveredId={setHoveredId} viewMode="kanban" productCodes={productCodesByBank.get(bank.id) ?? []} implProgress={implByBank.get(bank.id)} onNavigate={searchQuery ? () => analytics.searchResultClicked({ query: searchQuery, bank_id: bank.id, bank_name: bank.nameEn, result_position: filteredBanks.findIndex(b => b.id === bank.id) }) : undefined} />
                       ))}
                     </div>
                   </div>
                 )
              })}
            </motion.div>
          ) : viewMode === 'list' ? (
            <motion.div 
              key="list"
              variants={containerVariants} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="flex flex-col gap-3 pb-24"
            >
              {filteredBanks.map(bank => (
                <CompactBankCard key={bank.id} bankSummary={bank} hoveredId={hoveredId} setHoveredId={setHoveredId} viewMode="list" productCodes={productCodesByBank.get(bank.id) ?? []} implProgress={implByBank.get(bank.id)} onNavigate={searchQuery ? () => analytics.searchResultClicked({ query: searchQuery, bank_id: bank.id, bank_name: bank.nameEn, result_position: filteredBanks.findIndex(b => b.id === bank.id) }) : undefined} />
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="grid"
              variants={containerVariants} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-[24px] pb-[32px]"
            >
              {filteredBanks.map(bank => (
                <CompactBankCard key={bank.id} bankSummary={bank} hoveredId={hoveredId} setHoveredId={setHoveredId} viewMode="grid" productCodes={productCodesByBank.get(bank.id) ?? []} implProgress={implByBank.get(bank.id)} onNavigate={searchQuery ? () => analytics.searchResultClicked({ query: searchQuery, bank_id: bank.id, bank_name: bank.nameEn, result_position: filteredBanks.findIndex(b => b.id === bank.id) }) : undefined} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

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
        analytics.bankUpdated({ bank_id: bank.id, bank_name_en: bank.nameEn });
        queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bank.id) });
        onOpenChange(false);
        toast({ title: 'Saved', description: 'Bank details updated successfully' });
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to save changes', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] bg-background/95 backdrop-blur-3xl border-foreground/10 text-foreground !rounded-3xl shadow-[0_0_50px_-12px_rgba(79,50,214,0.15)]" dir="ltr" onClick={e => e.stopPropagation()}>
        <DialogHeader className="border-b border-foreground/5 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-3 text-xl font-light tracking-wide">
             <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
               <Pencil className="w-4 h-4 text-primary" />
             </div>
             Edit {bank.nameAr}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 min-h-0 -mx-6 px-6">
        <div className="grid gap-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest text-foreground/50 font-semibold">Status</label>
              <select className="flex h-[42px] w-full rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 backdrop-blur-md transition-all"
                value={form.status || ''} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="Not Started" className="bg-background">Not Started</option>
                <option value="In Progress" className="bg-background">In Progress</option>
                <option value="Active - Integration In Progress" className="bg-background">Active - Integration In Progress</option>
                <option value="Delayed" className="bg-background">Delayed</option>
                <option value="Completed" className="bg-background">Completed</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest text-foreground/50 font-semibold">Responsible Person</label>
              <Input value={form.responsiblePerson || ''} onChange={e => setForm({ ...form, responsiblePerson: e.target.value })} className="bg-foreground/5 border-foreground/10 rounded-xl h-[42px] focus-visible:ring-primary/30 focus-visible:border-primary/50" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest text-foreground/50 font-semibold">Relationship Manager</label>
              <Input value={form.relationshipManager || ''} onChange={e => setForm({ ...form, relationshipManager: e.target.value })} className="bg-foreground/5 border-foreground/10 rounded-xl h-[42px] focus-visible:ring-primary/30 focus-visible:border-primary/50" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest text-foreground/50 font-semibold">Email</label>
              <Input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-foreground/5 border-foreground/10 rounded-xl h-[42px] focus-visible:ring-primary/30 focus-visible:border-primary/50" dir="ltr" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest text-foreground/50 font-semibold">Website</label>
              <Input value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })} className="bg-foreground/5 border-foreground/10 rounded-xl h-[42px] focus-visible:ring-primary/30 focus-visible:border-primary/50" dir="ltr" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest text-foreground/50 font-semibold">Last Meeting Date</label>
              <Input value={form.lastMeetingDate || ''} onChange={e => setForm({ ...form, lastMeetingDate: e.target.value })} className="bg-foreground/5 border-foreground/10 rounded-xl h-[42px] focus-visible:ring-primary/30 focus-visible:border-primary/50" placeholder="YYYY-MM-DD" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest text-foreground/50 font-semibold">Next Meeting Date</label>
              <Input value={form.nextMeetingDate || ''} onChange={e => setForm({ ...form, nextMeetingDate: e.target.value })} className="bg-foreground/5 border-foreground/10 rounded-xl h-[42px] focus-visible:ring-primary/30 focus-visible:border-primary/50" placeholder="YYYY-MM-DD" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-widest text-foreground/50 font-semibold">Next Meeting Topic</label>
            <Input value={form.nextMeetingTopic || ''} onChange={e => setForm({ ...form, nextMeetingTopic: e.target.value })} className="bg-foreground/5 border-foreground/10 rounded-xl h-[42px] focus-visible:ring-primary/30 focus-visible:border-primary/50" />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-widest text-foreground/50 font-semibold">Next Action</label>
            <Input value={form.nextAction || ''} onChange={e => setForm({ ...form, nextAction: e.target.value })} className="bg-foreground/5 border-foreground/10 rounded-xl h-[42px] focus-visible:ring-primary/30 focus-visible:border-primary/50" />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-widest text-foreground/50 font-semibold">Description Notes</label>
            <Textarea value={form.descriptionNotes || ''} onChange={e => setForm({ ...form, descriptionNotes: e.target.value })} className="bg-foreground/5 border-foreground/10 rounded-xl h-24 focus-visible:ring-primary/30 focus-visible:border-primary/50" />
          </div>

          <div className="space-y-3 pt-4 border-t border-foreground/5">
            <label className="text-[11px] uppercase tracking-widest text-foreground/50 font-semibold">Product Types</label>
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
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
                      selected ? "bg-primary/20 text-primary border-primary/50 shadow-[0_0_10px_-2px_rgba(79,50,214,0.3)]" : "bg-foreground/5 text-foreground/60 border-foreground/10 hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    {pt.name}
                  </button>
                );
              })}
              {(!productTypes || productTypes.length === 0) && (
                <span className="text-sm text-foreground/30">No product types defined yet (you can add them in Settings)</span>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-foreground/5">
            <label className="text-[11px] uppercase tracking-widest text-foreground/50 font-semibold">Contacts</label>
            {contacts.map((c, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2">
                <Input value={c.name || ''} placeholder="Name" onChange={e => updateContact(idx, 'name', e.target.value)} className="bg-foreground/5 border-foreground/10 rounded-xl focus-visible:ring-primary/30 focus-visible:border-primary/50" />
                <Input value={c.title || ''} placeholder="Job Title" onChange={e => updateContact(idx, 'title', e.target.value)} className="bg-foreground/5 border-foreground/10 rounded-xl focus-visible:ring-primary/30 focus-visible:border-primary/50" />
                <Input value={c.phone || ''} placeholder="Phone" onChange={e => updateContact(idx, 'phone', e.target.value)} className="bg-foreground/5 border-foreground/10 rounded-xl focus-visible:ring-primary/30 focus-visible:border-primary/50" dir="ltr" />
                <Input value={c.email || ''} placeholder="Email Address" onChange={e => updateContact(idx, 'email', e.target.value)} className="bg-foreground/5 border-foreground/10 rounded-xl focus-visible:ring-primary/30 focus-visible:border-primary/50 col-span-3" dir="ltr" />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setForm({ ...form, contacts: [...contacts, { name: '', title: '', phone: '', email: '' }] })} className="border-foreground/10 bg-foreground/5 hover:bg-foreground/10 hover:text-foreground rounded-xl h-10 w-full mt-2 border-dashed">
              + Add Contact
            </Button>
          </div>
        </div>
        </div>
        <DialogFooter className="pt-2 border-t border-foreground/5 shrink-0">
          <Button onClick={handleSave} className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/80 font-bold rounded-xl h-[42px] transition-colors shadow-[0_0_15px_-3px_rgba(79,50,214,0.4)]" disabled={updateBank.isPending}>
            <Save className="w-4 h-4" /> {updateBank.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Neon palette — each product code gets a deterministic slot based on its text
const PRODUCT_NEON = [
  { text: 'text-sky-400',     bg: 'bg-sky-400/[0.12]',     border: 'border-sky-400/40',     glow: '0 0 7px rgba(56,189,248,0.6),0 0 2px rgba(56,189,248,0.35)' },
  { text: 'text-amber-400',   bg: 'bg-amber-400/[0.12]',   border: 'border-amber-400/40',   glow: '0 0 7px rgba(251,191,36,0.6),0 0 2px rgba(251,191,36,0.35)' },
  { text: 'text-emerald-400', bg: 'bg-emerald-400/[0.12]', border: 'border-emerald-400/40', glow: '0 0 7px rgba(52,211,153,0.6),0 0 2px rgba(52,211,153,0.35)' },
  { text: 'text-rose-400',    bg: 'bg-rose-400/[0.12]',    border: 'border-rose-400/40',    glow: '0 0 7px rgba(251,113,133,0.6),0 0 2px rgba(251,113,133,0.35)' },
  { text: 'text-violet-400',  bg: 'bg-violet-400/[0.12]',  border: 'border-violet-400/40',  glow: '0 0 7px rgba(167,139,250,0.6),0 0 2px rgba(167,139,250,0.35)' },
  { text: 'text-orange-400',  bg: 'bg-orange-400/[0.12]',  border: 'border-orange-400/40',  glow: '0 0 7px rgba(251,146,60,0.6),0 0 2px rgba(251,146,60,0.35)' },
  { text: 'text-cyan-400',    bg: 'bg-cyan-400/[0.12]',    border: 'border-cyan-400/40',    glow: '0 0 7px rgba(34,211,238,0.6),0 0 2px rgba(34,211,238,0.35)' },
  { text: 'text-lime-400',    bg: 'bg-lime-400/[0.12]',    border: 'border-lime-400/40',    glow: '0 0 7px rgba(163,230,53,0.6),0 0 2px rgba(163,230,53,0.35)' },
];
function getProductNeon(code: string) {
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return PRODUCT_NEON[h % PRODUCT_NEON.length];
}

function ProductBadges({ codes }: { codes: string[] }) {
  if (codes.length === 0) {
    return <span className="text-[10px] text-foreground/30 italic">No Products</span>;
  }
  const visible = codes.slice(0, 3);
  const overflow = codes.length - 3;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map(code => {
        const n = getProductNeon(code);
        return (
          <span
            key={code}
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black border tracking-widest leading-none",
              n.text, n.bg, n.border
            )}
            style={{ boxShadow: n.glow }}
          >
            {code}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-foreground/5 text-foreground/40 text-[10px] font-medium border border-foreground/10 leading-none">
          +{overflow}
        </span>
      )}
    </div>
  );
}

// Rich brand-inspired gradient palettes — 16 distinct options
const BANK_HERO_PALETTES: Array<{ bg1: string; bg2: string; accent: string }> = [
  { bg1: '#0D1B2E', bg2: '#162844', accent: '#2563EB' }, // sapphire navy
  { bg1: '#0A1F14', bg2: '#112D1E', accent: '#16A34A' }, // forest emerald
  { bg1: '#1A0B2E', bg2: '#280F42', accent: '#9333EA' }, // deep violet
  { bg1: '#1C0A0A', bg2: '#2A1010', accent: '#DC2626' }, // crimson dusk
  { bg1: '#0C1A1A', bg2: '#102828', accent: '#0D9488' }, // dark teal
  { bg1: '#1A1000', bg2: '#2A1A00', accent: '#D97706' }, // amber night
  { bg1: '#0A0D20', bg2: '#0E1530', accent: '#4F46E5' }, // midnight indigo
  { bg1: '#130A1A', bg2: '#1E0F28', accent: '#DB2777' }, // rose plum
  { bg1: '#001A1A', bg2: '#00282A', accent: '#06B6D4' }, // cyan abyss
  { bg1: '#1A1500', bg2: '#2A2000', accent: '#CA8A04' }, // gold noir
  { bg1: '#0A1428', bg2: '#0F1E3A', accent: '#3B82F6' }, // ocean blue
  { bg1: '#1A0F0A', bg2: '#281500', accent: '#EA580C' }, // burnt sienna
  { bg1: '#0A1A0A', bg2: '#102410', accent: '#22C55E' }, // jade grove
  { bg1: '#1A0A1A', bg2: '#280F2A', accent: '#C026D3' }, // magenta storm
  { bg1: '#0F1820', bg2: '#152030', accent: '#0EA5E9' }, // arctic steel
  { bg1: '#1A1818', bg2: '#262222', accent: '#94A3B8' }, // graphite
];

function getBankPalette(nameEn: string) {
  const sum = [...nameEn].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return BANK_HERO_PALETTES[sum % BANK_HERO_PALETTES.length];
}

function getBankGradient(nameEn: string): string {
  const p = getBankPalette(nameEn);
  return `bg-gradient-to-br`; // kept for compat; use getBankPalette inline
  void p;
}

const BANK_STATUSES = [
  'Not Started',
  'In Progress',
  'Active - Integration In Progress',
  'Delayed',
  'Completed',
] as const;

function StatusQuickPicker({ bankId, status }: { bankId: string; status: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const updateBank = useUpdateBank();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const statusColor = getStatusColor(status);

  const handleSelect = (newStatus: string) => {
    setOpen(false);
    if (newStatus === status) return;
    updateBank.mutate(
      { id: bankId, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) });
          toast({ title: 'Status updated', description: `Changed to "${newStatus}"` });
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
        },
      }
    );
  };

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); }}
        disabled={updateBank.isPending}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium shrink-0 transition-all duration-200 cursor-pointer",
          open
            ? "border-primary/40 bg-primary/10 text-primary"
            : [
                "bg-foreground/[0.04] hover:bg-foreground/[0.08]",
                statusColor.text,
                // border tinted to match status colour
                statusColor.dot.includes('emerald') ? "border-emerald-500/30" :
                statusColor.dot.includes('red')     ? "border-red-500/30"     :
                statusColor.dot.includes('yellow')  ? "border-yellow-500/30"  :
                "border-foreground/10"
              ].join(' '),
          updateBank.isPending && "opacity-50 pointer-events-none"
        )}
        aria-label="Change status"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor.dot} shadow-[0_0_8px_currentColor]`} />
        <span className="max-w-[100px] truncate">{status || '—'}</span>
        <ChevronDown className={cn("w-2.5 h-2.5 opacity-50 transition-transform duration-200 shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={e => { e.stopPropagation(); setOpen(false); }} />
          <div className="absolute top-full left-0 mt-1.5 z-50 min-w-[200px] bg-background/97 backdrop-blur-3xl border border-foreground/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {BANK_STATUSES.map(s => {
              const sc = getStatusColor(s);
              return (
                <button
                  key={s}
                  type="button"
                  role="option"
                  aria-selected={s === status}
                  onClick={() => handleSelect(s)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left",
                    s === status
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground/80 hover:bg-foreground/10 hover:text-foreground"
                  )}
                >
                  <span className={`w-2 h-2 rounded-full ${sc.dot} shadow-[0_0_6px_currentColor] shrink-0`} />
                  {s}
                  {s === status && <Check className="ml-auto w-3 h-3 shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CompactBankCard({ 
  bankSummary, 
  hoveredId, 
  setHoveredId,
  viewMode,
  productCodes,
  implProgress,
  onNavigate,
}: { 
  bankSummary: Bank; 
  hoveredId: string | null; 
  setHoveredId: (id: string | null) => void;
  viewMode: 'grid' | 'list' | 'kanban';
  productCodes: string[];
  implProgress?: BankSummaryV2;
  onNavigate?: () => void;
}) {
  const { data: bankDetail } = useGetBank(bankSummary.id, {
    query: { queryKey: getGetBankQueryKey(bankSummary.id) }
  });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { assignedBankIds, role: userRole } = useAuth();
  const isMyBank = assignedBankIds.length > 0 && assignedBankIds.includes(bankSummary.id);
  // canEdit: must be admin+ AND (no bank restrictions OR this is an assigned bank)
  const canEdit = (userRole === 'super_admin' || userRole === 'admin') && (assignedBankIds.length === 0 || isMyBank);

  const displayBank = bankDetail || bankSummary;
  const isHovered = hoveredId === displayBank.id;
  
  const hasRealHero = Boolean(displayBank.heroImageUrl && !displayBank.heroImageUrl.includes('placehold.co'));
  const hasLogo = Boolean(displayBank.logoUrl);

  const risksCount = bankDetail?.risks?.length || 0;
  const docsCount = bankDetail?.documents?.length || 0;

  const EditButton = ({ className }: { className?: string }) => {
    if (!canEdit) return null;
    return (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditOpen(true); }}
        className={cn(
          "z-40 rounded-full flex items-center justify-center transition-all",
          className
        )}
        title="Edit Bank Details"
        aria-label={`Edit ${displayBank.nameEn} details`}
      >
        <Pencil className="w-[1em] h-[1em]" />
      </button>
    );
  };

  // Badge shown when this bank is the user's assigned bank
  const MyBankBadge = ({ className }: { className?: string }) => {
    if (!isMyBank) return null;
    return (
      <span className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
        "bg-blue-500/15 text-blue-400 border border-blue-400/20",
        className
      )}>
        <Bookmark className="w-2.5 h-2.5" />
        بنكك المخصص
      </span>
    );
  };

  const content = () => {
    if (viewMode === 'list') {
      return (
        <motion.div 
          onMouseEnter={() => setHoveredId(displayBank.id)}
          onMouseLeave={() => setHoveredId(null)}
          animate={{ scale: isHovered ? 1.01 : 1, y: isHovered ? -2 : 0 }}
          className="flex flex-col sm:flex-row sm:items-center gap-4 w-full p-4 rounded-2xl bg-card/20 backdrop-blur-2xl border border-foreground/5 group hover:bg-card/40 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#00e5ff]/0 via-[#00e5ff]/0 to-transparent group-hover:from-[#00e5ff]/5 transition-all duration-500 pointer-events-none" />
          <div className="absolute inset-0 z-10 rounded-2xl pointer-events-none group-hover:shadow-[inset_0_0_0_1px_rgba(79,50,214,0.3),0_0_20px_-5px_rgba(79,50,214,0.15)] transition-all duration-500" />
          
          <div className="relative z-20 flex items-center justify-between sm:justify-start gap-4 sm:w-[280px] shrink-0">
            <div className="w-12 h-12 rounded-xl bg-foreground/5 border border-foreground/10 p-2 shrink-0 shadow-inner">
              <BankLogo src={displayBank.logoUrl} alt={displayBank.nameEn} fallbackText={displayBank.nameAr.substring(0, 2)} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold text-foreground truncate">{displayBank.nameAr}</h2>
              <h3 className="text-[11px] text-foreground/50 uppercase tracking-widest truncate">{displayBank.nameEn}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <ProductBadges codes={productCodes} />
                <MyBankBadge />
              </div>
            </div>
          </div>

          <div className="relative z-20 flex items-center gap-6 flex-1 justify-between sm:justify-start overflow-x-auto hide-scrollbar">
            {/* Implementation % — text column */}
            <div className="w-24 shrink-0">
              {implProgress !== undefined ? (
                <span className="text-sm font-mono font-bold text-foreground/80">
                  {Math.round(implProgress.completionPercentage)}%
                </span>
              ) : (
                <span className="text-sm text-foreground/20">—</span>
              )}
              <p className="text-[9px] text-foreground/30 uppercase tracking-widest mt-0.5">Implementation</p>
            </div>

            <div className="w-36 shrink-0">
              {canEdit
              ? <StatusQuickPicker bankId={displayBank.id} status={displayBank.status} />
              : <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', getStatusColor(displayBank.status || '').text)}>{displayBank.status}</span>
            }
            </div>

            <div className="w-32 shrink-0 text-xs text-foreground/70 flex items-center gap-2 truncate">
              <User className="w-3.5 h-3.5 text-primary/70 shrink-0" />
              <span className="truncate">{displayBank.responsiblePerson || '—'}</span>
            </div>

            <div className="w-32 shrink-0 flex items-center gap-4 text-xs">
              <span className={`flex items-center gap-1.5 ${risksCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground/40'}`}>
                <AlertTriangle className="w-3.5 h-3.5" /> {risksCount}
              </span>
              <span className="flex items-center gap-1.5 text-foreground/40">
                <FileText className="w-3.5 h-3.5" /> {docsCount}
              </span>
            </div>

            <div className="hidden lg:block w-28 shrink-0 text-xs text-foreground/40 truncate">
              {formatDateTime((displayBank.lastActivityAt ?? displayBank.updatedAt) as string).split(',')[0]}
            </div>
          </div>

          <div className="relative z-20 sm:ml-auto">
            <EditButton className="w-8 h-8 bg-foreground/5 text-foreground/40 hover:text-primary hover:bg-primary/15 hover:border hover:border-primary/30 text-[14px]" />
          </div>
        </motion.div>
      );
    }

    if (viewMode === 'kanban') {
      return (
        <motion.div 
          onMouseEnter={() => setHoveredId(displayBank.id)}
          onMouseLeave={() => setHoveredId(null)}
          animate={{ scale: isHovered ? 1.02 : 1 }}
          className="relative w-full rounded-2xl bg-card/20 backdrop-blur-2xl border border-foreground/5 p-4 flex flex-col gap-4 group cursor-pointer shadow-lg"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#00e5ff]/0 to-transparent group-hover:from-[#00e5ff]/5 transition-all duration-500 pointer-events-none rounded-2xl" />
          <div className="absolute inset-0 z-10 rounded-2xl pointer-events-none group-hover:shadow-[inset_0_0_0_1px_rgba(79,50,214,0.4),0_0_20px_-5px_rgba(79,50,214,0.15)] transition-all duration-500" />
          
          <div className="relative z-20 flex justify-between items-start gap-2">
            <motion.div
              className="w-10 h-10 rounded-xl bg-foreground/5 border border-foreground/10 p-1.5 shrink-0 shadow-inner"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
            >
               <BankLogo src={displayBank.logoUrl} alt={displayBank.nameEn} fallbackText={displayBank.nameAr.substring(0, 2)} />
            </motion.div>
            {implProgress !== undefined && (
              <motion.div
                className="flex flex-col items-end"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.35 }}
              >
                <span className="text-sm font-mono font-bold text-foreground/70 leading-none">
                  {Math.round(implProgress.completionPercentage)}%
                </span>
                <span className="text-[8px] text-foreground/30 uppercase tracking-widest mt-0.5">impl</span>
              </motion.div>
            )}
          </div>
          
          <div className="relative z-20 min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">{displayBank.nameAr}</h2>
            <h3 className="text-[10px] text-foreground/50 uppercase tracking-widest truncate">{displayBank.nameEn}</h3>
            <div className="mt-1.5 space-y-1">
              <ProductBadges codes={productCodes} />
              <MyBankBadge />
            </div>
          </div>
          
          <div className="relative z-20 pt-3 border-t border-foreground/5 flex flex-col gap-2">
            {canEdit
              ? <StatusQuickPicker bankId={displayBank.id} status={displayBank.status} />
              : <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', getStatusColor(displayBank.status || '').text)}>{displayBank.status}</span>
            }
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground/70 flex items-center gap-1.5 truncate pr-2">
                <User className="w-3 h-3 text-primary/70 shrink-0" /> 
                <span className="truncate">{displayBank.responsiblePerson?.split(' ')[0] || '—'}</span>
              </span>
              <div className="flex items-center gap-3 shrink-0">
                 <span className={`flex items-center gap-1 ${risksCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground/40'}`}><AlertTriangle className="w-3 h-3"/>{risksCount}</span>
                 <span className="flex items-center gap-1 text-foreground/40"><FileText className="w-3 h-3"/>{docsCount}</span>
              </div>
            </div>
          </div>
          
          <EditButton className="absolute top-3 right-3 w-7 h-7 bg-background/60 backdrop-blur-md border border-foreground/10 text-foreground/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 hover:text-primary hover:bg-primary/20 hover:border-primary/40 transition-all text-[12px]" />
        </motion.div>
      );
    }

    // Default GRID — logo-hero card
    return (
      <motion.div
        onMouseEnter={() => setHoveredId(displayBank.id)}
        onMouseLeave={() => setHoveredId(null)}
        animate={{ scale: isHovered ? 1.025 : 1, y: isHovered ? -6 : 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full rounded-[24px] overflow-hidden cursor-pointer group border border-white/6 dark:border-white/6 shadow-xl"
      >
        {/* ── HERO ZONE ── */}
        <div className="relative h-[172px] overflow-hidden">
          {hasRealHero ? (
            /* Full-bleed hero photo */
            <>
              <img
                src={displayBank.heroImageUrl!}
                alt={displayBank.nameEn}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              {/* Logo overlay top-left when hero photo exists */}
              {hasLogo && (
                <div className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 p-1.5 flex items-center justify-center">
                  <BankLogo src={displayBank.logoUrl} alt={displayBank.nameEn} className="w-full h-full object-contain" />
                </div>
              )}
            </>
          ) : (
            /* Logo (or initials) on brand-palette gradient with white elevated card */
            (() => {
              const palette = getBankPalette(displayBank.nameEn);
              return (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${palette.bg1} 0%, ${palette.bg2} 100%)` }}
                >
                  {/* Noise texture overlay */}
                  <div
                    className="absolute inset-0 opacity-[0.035]"
                    style={{
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
                      backgroundSize: '200px',
                    }}
                  />
                  {/* Accent glow blob */}
                  <div
                    className="absolute w-40 h-40 rounded-full blur-3xl opacity-20 transition-opacity duration-500 group-hover:opacity-30"
                    style={{ background: palette.accent }}
                  />
                  {/* White elevated logo card */}
                  <div
                    className="relative z-10 flex items-center justify-center rounded-[18px] transition-all duration-500 group-hover:scale-[1.06]"
                    style={{
                      width: '72%',
                      height: '90px',
                      padding: '10px 18px',
                      background: 'linear-gradient(145deg, #ffffff 0%, #f5f7fa 100%)',
                      boxShadow: '0 10px 36px rgba(0,0,0,0.38), 0 2px 8px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
                      border: '1px solid rgba(255,255,255,0.25)',
                    }}
                  >
                    {hasLogo ? (
                      <BankLogo
                        src={displayBank.logoUrl}
                        alt={displayBank.nameEn}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span
                        className="text-[32px] font-black select-none tracking-tight"
                        style={{ color: palette.accent }}
                      >
                        {displayBank.nameAr.substring(0, 2)}
                      </span>
                    )}
                  </div>
                  {/* Accent bottom stripe */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[3px] opacity-70"
                    style={{ background: `linear-gradient(90deg, transparent 0%, ${palette.accent}cc 40%, ${palette.accent} 50%, ${palette.accent}cc 60%, transparent 100%)` }}
                  />
                </div>
              );
            })()
          )}

          {/* Hover shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:to-transparent transition-all duration-700 pointer-events-none" />

          {/* Edit button */}
          <EditButton className="absolute top-3 left-3 z-20 w-8 h-8 bg-black/50 backdrop-blur-md border border-white/10 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-primary/80 hover:border-primary/50 hover:text-white transition-all text-[13px]" />

          {/* Active-status glow ring on hero */}
          {displayBank.status === 'Active - Integration In Progress' && (
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_0_1.5px_rgba(79,50,214,0.6)]" />
          )}
        </div>

        {/* ── INFO ZONE ── */}
        <div className="relative bg-card/95 dark:bg-card/95 backdrop-blur-xl px-5 py-4 flex flex-col gap-3 border-t border-white/5">
          {/* Name + Status row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-[16px] font-bold text-foreground leading-tight truncate">{displayBank.nameAr}</h2>
              <h3 className="text-[10px] text-foreground/40 tracking-[0.12em] uppercase truncate mt-0.5">{displayBank.nameEn}</h3>
              <MyBankBadge className="mt-1.5" />
            </div>
            {canEdit
              ? <StatusQuickPicker bankId={displayBank.id} status={displayBank.status} />
              : <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', getStatusColor(displayBank.status || '').text)}>{displayBank.status}</span>
            }
          </div>

          {/* Product badges */}
          {productCodes.length > 0 && (
            <div className="-mt-1">
              <ProductBadges codes={productCodes} />
            </div>
          )}

          {/* Implementation progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-foreground/40 uppercase tracking-[0.12em] font-semibold">IMPL.</span>
              <span className="font-mono font-bold text-foreground/80">
                {implProgress !== undefined ? `${Math.round(implProgress.completionPercentage)}%` : '—'}
              </span>
            </div>
            <div className="h-[5px] rounded-full bg-foreground/8 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700',
                  implProgress === undefined ? 'bg-foreground/20' :
                  implProgress.completionPercentage === 100 ? 'bg-emerald-500' :
                  implProgress.isBlocked ? 'bg-red-500' :
                  implProgress.completionPercentage >= 75 ? 'bg-blue-500' :
                  implProgress.completionPercentage >= 50 ? 'bg-yellow-500' :
                  implProgress.completionPercentage > 0 ? 'bg-orange-500' : 'bg-foreground/20'
                )}
                style={{ width: `${implProgress?.completionPercentage ?? 0}%` }}
              />
            </div>
            {implProgress?.currentStageName && implProgress.completionPercentage < 100 && (
              <p className="text-[9px] text-foreground/30 leading-tight truncate">{implProgress.currentStageName}</p>
            )}
          </div>

          {/* Stats footer */}
          <div className="flex items-center justify-between text-[11px] pt-2.5 border-t border-foreground/5">
            <span className="flex items-center gap-1.5 text-foreground/55 truncate max-w-[45%]">
              <User className="w-3 h-3 text-primary/60 shrink-0" />
              <span className="truncate">{displayBank.responsiblePerson?.split(' ').slice(0,2).join(' ') || '—'}</span>
            </span>
            <div className="flex items-center gap-3 shrink-0 text-foreground/35">
              <span className={cn('flex items-center gap-1', risksCount > 0 && 'text-red-500/80')}>
                <AlertTriangle className="w-3 h-3" />{risksCount}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />{docsCount}
              </span>
              <span className="hidden xl:flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDateTime((displayBank.lastActivityAt ?? displayBank.updatedAt) as string).split(',')[0]}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div variants={itemVariants} className="will-change-transform relative w-full">
      <EditBankDialog bank={displayBank} open={isEditOpen} onOpenChange={setIsEditOpen} />
      <Link
        href={`/bank/${displayBank.id}`}
        className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-[24px]"
        onFocus={() => setHoveredId(displayBank.id)}
        onBlur={() => { if (hoveredId === displayBank.id) setHoveredId(null); }}
        onClick={() => onNavigate?.()}
      >
        {content()}
      </Link>
    </motion.div>
  );
}
