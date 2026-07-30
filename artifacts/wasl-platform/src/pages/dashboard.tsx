import React, { useState, useEffect, useRef } from 'react';
import { useGetDashboardSummary, useListBanks, useListProducts, useListProductTypes, useGetBank, useUpdateBank, getGetBankQueryKey, getListBanksQueryKey, useGetImplSummaryV2 } from '@workspace/api-client-react';
import type { Bank, BankSummaryV2 } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Link } from 'wouter';
import { Pencil, Save, Search, SlidersHorizontal, LayoutGrid, List, Columns3, User, Clock, AlertTriangle, FileText, ChevronDown, Check, BarChart3, Bookmark } from 'lucide-react';
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


function CategoryFilter({ categories, value, onChange }: { categories: string[], value: string, onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button 
        onClick={() => setOpen(!open)} 
        className={cn(
          "flex items-center gap-2 h-9 sm:h-[48px] px-3 sm:px-5 rounded-full border text-[13px] sm:text-[15px] transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 glass-panel",
          open 
            ? "bg-white/80 dark:bg-primary/10 border-primary/40 shadow-[0_0_15px_-3px_rgba(47,107,255,0.3)] dark:shadow-[0_0_15px_-3px_rgba(79,50,214,0.3)]" 
            : "hover:bg-white/60 dark:hover:bg-foreground/10 hover:border-primary/30"
        )}
      >
        <span className="max-w-[120px] truncate font-medium">{value === 'All' ? 'All Categories' : value}</span>
        <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-[260px] z-50 bg-background/95 backdrop-blur-3xl border border-foreground/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <Command className="w-full bg-transparent flex flex-col">
               <div className="flex items-center border-b border-foreground/10 px-3" cmdk-input-wrapper="">
                 <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-foreground/50" />
                 <Command.Input 
                   placeholder="Search category..." 
                   className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-foreground/40 disabled:cursor-not-allowed disabled:opacity-50 text-foreground" 
                 />
               </div>
               <Command.List className="max-h-[240px] overflow-y-auto p-1 hide-scrollbar">
                 <Command.Empty className="py-4 text-center text-xs text-foreground/40">No categories found.</Command.Empty>
                 {categories.map(cat => (
                   <Command.Item 
                     key={cat} 
                     value={cat} 
                     onSelect={(v) => { 
                       const original = categories.find(c => c.toLowerCase() === v.toLowerCase()) || cat;
                       onChange(original); 
                       setOpen(false); 
                     }}
                     className={cn(
                       "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none aria-selected:bg-foreground/10 transition-colors",
                       value === cat ? "bg-primary/15 text-primary font-medium" : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
                     )}
                   >
                     {cat === 'All' ? 'All Categories' : cat}
                     {value === cat && <Check className="ml-auto h-4 w-4" />}
                   </Command.Item>
                 ))}
               </Command.List>
             </Command>
          </div>
        </>
      )}
    </div>
  );
}

function AdvancedFiltersPanel({ 
  open, 
  onOpenChange, 
  filterCategory, 
  setFilterCategory, 
  categories,
  filterRisk,
  setFilterRisk,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  categories: string[];
  filterRisk: string;
  setFilterRisk: (v: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-background/90 backdrop-blur-3xl border-foreground/10 text-foreground !rounded-3xl shadow-[0_0_50px_-12px_rgba(79,50,214,0.15)]">
        <DialogHeader className="border-b border-foreground/5 pb-4">
          <DialogTitle className="text-xl font-light tracking-wide flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
            </div>
            Advanced Filters
          </DialogTitle>
        </DialogHeader>
        <div className="py-6 flex flex-col gap-8">
          
          {/* Category Filter */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-[0.2em] text-foreground/50 font-bold">Category</label>
              {filterCategory !== 'All' && (
                <button onClick={() => setFilterCategory('All')} className="text-[10px] text-primary hover:text-foreground transition-colors">CLEAR</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
               {categories.slice(0, 8).map(c => (
                 <button
                   key={c}
                   onClick={() => setFilterCategory(c)}
                   className={cn(
                     "px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-center truncate",
                     filterCategory === c 
                       ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_15px_-3px_rgba(79,50,214,0.2)]" 
                       : "bg-foreground/5 text-foreground/70 border border-foreground/5 hover:bg-foreground/10 hover:text-foreground"
                   )}
                 >
                   {c === 'All' ? 'All' : c}
                 </button>
               ))}
            </div>
          </div>

          {/* Risk Level Filter */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-[0.2em] text-foreground/50 font-bold">Risk Level</label>
              {filterRisk !== 'All' && (
                <button onClick={() => setFilterRisk('All')} className="text-[10px] text-primary hover:text-foreground transition-colors">CLEAR</button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
               {['All', 'Low', 'Medium', 'High'].map(r => (
                  <button 
                    key={r}
                    onClick={() => setFilterRisk(r)}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-xs font-medium transition-all",
                      filterRisk === r 
                        ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_15px_-3px_rgba(79,50,214,0.2)]" 
                        : "bg-foreground/5 text-foreground/70 border border-foreground/5 hover:bg-foreground/10 hover:text-foreground"
                    )}
                  >{r}</button>
               ))}
            </div>
          </div>

        </div>
        <div className="pt-4 border-t border-foreground/5 flex justify-end">
          <Button onClick={() => onOpenChange(false)} className="bg-primary text-primary-foreground hover:bg-primary/80 font-semibold rounded-xl px-8 transition-colors shadow-[0_0_15px_-3px_rgba(79,50,214,0.4)]">
            Apply Filters
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KpiChip({
  dot, label, value, active, onClick, suffix, dimmed
}: { dot: string; label: string; value: number | string; active: boolean; onClick: () => void; suffix?: string; dimmed?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 shrink-0 focus:outline-none",
        active
          ? "bg-foreground/10 border-foreground/25 shadow-sm"
          : "border-transparent hover:bg-foreground/[0.04] hover:border-foreground/10",
        dimmed && "opacity-35"
      )}
    >
      <span className={cn("w-2 h-2 rounded-full shrink-0 shadow-[0_0_6px_currentColor]", dot)} />
      <span className={cn("text-[20px] font-black leading-none tracking-tight", active ? "text-foreground" : "text-foreground/80")}>
        {value}{suffix && <span className="text-sm ml-0.5 opacity-50">{suffix}</span>}
      </span>
      <span className={cn("text-[10px] leading-tight font-medium max-w-[52px] text-right", active ? "text-foreground/70" : "text-foreground/35")}>
        {label}
      </span>
    </button>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: banks, isLoading: isLoadingBanks } = useListBanks();
  const { data: products, isLoading: isLoadingProducts } = useListProducts();
  const { data: implSummaries } = useGetImplSummaryV2();
  
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterRisk, setFilterRisk] = useState<string>('All');
  const [kpiFilter, setKpiFilter] = useState<'all' | 'inProgress' | 'completed' | 'delayed' | 'highRisk' | 'implInProduction' | 'implInTesting' | 'implBlocked' | 'implReadyForGoLive'>('all');
  const [implProgressFilter, setImplProgressFilter] = useState<'all' | '0-25' | '26-50' | '51-75' | '76-100'>('all');
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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
        filters_active: filterCategory !== 'All' || filterRisk !== 'All',
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

  // ── Implementation progress map & KPIs ─────────────────────────────────
  const implByBank = new Map<string, BankSummaryV2>();
  for (const s of implSummaries || []) implByBank.set(s.bankId, s);

  const testingKeywords = ['integration', 'testing', 'uat', 'pt', 'penetration'];
  const allImplPct = banks.map(b => implByBank.get(b.id)?.completionPercentage ?? 0);
  const avgImplProgress = Math.round(allImplPct.reduce((a, v) => a + v, 0) / Math.max(banks.length, 1));
  const banksInProduction = banks.filter(b => (implByBank.get(b.id)?.completionPercentage ?? 0) === 100).length;
  const banksInTesting = banks.filter(b => {
    const cs = implByBank.get(b.id)?.currentStageName?.toLowerCase() ?? '';
    return testingKeywords.some(kw => cs.includes(kw));
  }).length;
  const banksBlocked = banks.filter(b => implByBank.get(b.id)?.isBlocked).length;
  const banksReadyForGoLive = banks.filter(b => {
    const pct = implByBank.get(b.id)?.completionPercentage ?? 0;
    return pct >= 87.5 && pct < 100;
  }).length;

  const categories = ["All", ...Array.from(new Set(banks.map(b => b.category).filter(Boolean)))];

  const normalizeStatus = (s: string) => s.toLowerCase();
  const matchesKpi = (bank: Bank) => {
    if (kpiFilter === 'all') return true;
    if (kpiFilter === 'highRisk') return bank.riskLevel === 'High';
    const status = normalizeStatus(bank.status || '');
    if (kpiFilter === 'completed') return status.includes('complet');
    if (kpiFilter === 'delayed') return status.includes('delay');
    if (kpiFilter === 'inProgress') return status.includes('progress');
    // Implementation filters
    const impl = implByBank.get(bank.id);
    if (kpiFilter === 'implInProduction') return (impl?.completionPercentage ?? 0) === 100;
    if (kpiFilter === 'implInTesting') return impl ? testingKeywords.some(kw => (impl.currentStageName ?? '').toLowerCase().includes(kw)) : false;
    if (kpiFilter === 'implBlocked') return impl?.isBlocked ?? false;
    if (kpiFilter === 'implReadyForGoLive') { const pct = impl?.completionPercentage ?? 0; return pct >= 87.5 && pct < 100; }
    return true;
  };

  const matchesImplProgressFilter = (bank: Bank) => {
    if (implProgressFilter === 'all') return true;
    const pct = implByBank.get(bank.id)?.completionPercentage ?? 0;
    if (implProgressFilter === '0-25') return pct <= 25;
    if (implProgressFilter === '26-50') return pct > 25 && pct <= 50;
    if (implProgressFilter === '51-75') return pct > 50 && pct <= 75;
    if (implProgressFilter === '76-100') return pct > 75;
    return true;
  };

  const highRiskBankCount = banks.filter(b => b.riskLevel === 'High').length;

  const filteredBanks = [...banks]
    .filter(b => {
      if (filterCategory !== 'All' && b.category !== filterCategory) return false;
      if (filterRisk !== 'All' && b.riskLevel !== filterRisk) return false;
      if (!matchesKpi(b)) return false;
      if (!matchesImplProgressFilter(b)) return false;
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

  const isImplActive = ['implInProduction','implInTesting','implBlocked','implReadyForGoLive'].includes(kpiFilter);
  const isStatusActive = ['inProgress','completed','delayed','highRisk'].includes(kpiFilter);

  return (
    <div className={cn("min-h-full flex flex-col w-full", viewMode !== 'kanban' && "overflow-x-hidden")}>

      {/* ── Clean Strip Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-3xl border-b border-foreground/[0.06] shadow-2xl">

        {/* Row 1: Logo | KPI chips | Search | View toggle */}
        <div className="flex items-center gap-2 px-4 sm:px-5 pt-2.5 pb-2" dir="rtl">

          {/* Logo – far right in RTL */}
          <div className="shrink-0 pl-2 sm:pl-3 border-l border-foreground/[0.08]">
            <WaslLogo height={24} imgClassName="w-auto" />
          </div>

          <div className="w-px h-5 bg-foreground/[0.08] shrink-0" />

          {/* Status KPI chips — scrollable, takes all flex space */}
          <div className="flex items-center gap-0.5 overflow-x-auto hide-scrollbar flex-1 min-w-0">
            <KpiChip dot="bg-foreground/50" label="All Banks" value={summary.totalBanks} active={kpiFilter === 'all'} onClick={() => setKpiFilter('all')} dimmed={isImplActive} />
            <div className="w-px h-4 bg-foreground/[0.07] mx-0.5 shrink-0" />
            <KpiChip dot="bg-amber-400" label="In Progress" value={summary.inProgress} active={kpiFilter === 'inProgress'} onClick={() => setKpiFilter(kpiFilter === 'inProgress' ? 'all' : 'inProgress')} dimmed={isImplActive} />
            <div className="w-px h-4 bg-foreground/[0.07] mx-0.5 shrink-0" />
            <KpiChip dot="bg-emerald-400" label="Completed" value={summary.completed} active={kpiFilter === 'completed'} onClick={() => setKpiFilter(kpiFilter === 'completed' ? 'all' : 'completed')} dimmed={isImplActive} />
            <div className="w-px h-4 bg-foreground/[0.07] mx-0.5 shrink-0" />
            <KpiChip dot="bg-red-400" label="Delayed" value={summary.delayed} active={kpiFilter === 'delayed'} onClick={() => setKpiFilter(kpiFilter === 'delayed' ? 'all' : 'delayed')} dimmed={isImplActive} />
            <div className="w-px h-4 bg-foreground/[0.07] mx-0.5 shrink-0" />
            <KpiChip dot="bg-rose-500" label="High Risk" value={highRiskBankCount} active={kpiFilter === 'highRisk'} onClick={() => setKpiFilter(kpiFilter === 'highRisk' ? 'all' : 'highRisk')} dimmed={isImplActive} />
          </div>

          {/* Search — grows on desktop, icon-only toggle on mobile */}
          <div className="relative shrink-0 hidden sm:block w-44 md:w-52">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search banks..."
              aria-label="Search banks"
              dir="ltr"
              className="w-full bg-foreground/[0.04] border border-foreground/[0.08] rounded-xl pr-9 pl-3 py-2 text-xs text-foreground/70 placeholder:text-foreground/30 outline-none focus:border-primary/40 focus:bg-foreground/[0.06] transition-all"
            />
          </div>
          {/* Mobile: search icon button — opens inline search row below */}
          <button
            className="sm:hidden shrink-0 p-1.5 rounded-lg border border-foreground/10 text-foreground/50 hover:text-foreground hover:border-foreground/20 transition-colors"
            aria-label="Search"
            onClick={() => setMobileSearchOpen(v => !v)}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 border border-foreground/10 rounded-xl p-1 shrink-0">
            <button onClick={() => setViewMode('grid')} aria-label="Grid view" aria-pressed={viewMode === 'grid'} className={cn("p-1.5 rounded-lg transition-colors focus:outline-none", viewMode === 'grid' ? "bg-primary/20 text-primary" : "text-foreground/30 hover:text-foreground/60")}><LayoutGrid className="w-3.5 h-3.5" /></button>
            <button onClick={() => setViewMode('list')} aria-label="List view" aria-pressed={viewMode === 'list'} className={cn("p-1.5 rounded-lg transition-colors focus:outline-none", viewMode === 'list' ? "bg-primary/20 text-primary" : "text-foreground/30 hover:text-foreground/60")}><List className="w-3.5 h-3.5" /></button>
            <button onClick={() => setViewMode('kanban')} aria-label="Kanban view" aria-pressed={viewMode === 'kanban'} className={cn("p-1.5 rounded-lg transition-colors focus:outline-none hidden sm:block", viewMode === 'kanban' ? "bg-primary/20 text-primary" : "text-foreground/30 hover:text-foreground/60")}><Columns3 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Mobile search row — shown when search icon is tapped */}
        {(mobileSearchOpen || searchQuery) && (
          <div className="sm:hidden px-4 pb-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onBlur={() => { if (!searchQuery) setMobileSearchOpen(false); }}
                placeholder="Search banks..."
                aria-label="Search banks"
                dir="ltr"
                className="w-full bg-foreground/[0.04] border border-foreground/[0.08] rounded-xl pr-9 pl-3 py-2 text-xs text-foreground/70 placeholder:text-foreground/30 outline-none focus:border-primary/40 transition-all"
              />
            </div>
          </div>
        )}

        {/* Row 2: Implementation chips */}
        <div className="flex items-center gap-2 px-4 sm:px-5 pb-2" dir="rtl">
          {/* Label — hidden on very small screens to save space */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <BarChart3 className="w-3 h-3 text-violet-400/60" />
            <span className="text-[9px] text-foreground/25 uppercase tracking-[0.2em] font-bold">Implementation</span>
          </div>
          <BarChart3 className="sm:hidden w-3 h-3 text-violet-400/60 shrink-0" />
          <div className="w-px h-4 bg-foreground/[0.07] shrink-0" />
          <div className="flex items-center gap-0.5 overflow-x-auto hide-scrollbar flex-1 min-w-0">
            <KpiChip dot="bg-violet-400" label="Avg. Progress" value={avgImplProgress} suffix="%" active={false} onClick={() => {}} dimmed={isStatusActive} />
            <div className="w-px h-3 bg-foreground/[0.07] mx-0.5 shrink-0" />
            <KpiChip dot="bg-emerald-400" label="In Production" value={banksInProduction} active={kpiFilter === 'implInProduction'} onClick={() => setKpiFilter(kpiFilter === 'implInProduction' ? 'all' : 'implInProduction')} dimmed={isStatusActive} />
            <div className="w-px h-3 bg-foreground/[0.07] mx-0.5 shrink-0" />
            <KpiChip dot="bg-blue-400" label="In Testing" value={banksInTesting} active={kpiFilter === 'implInTesting'} onClick={() => setKpiFilter(kpiFilter === 'implInTesting' ? 'all' : 'implInTesting')} dimmed={isStatusActive} />
            <div className="w-px h-3 bg-foreground/[0.07] mx-0.5 shrink-0" />
            <KpiChip dot="bg-red-400" label="Blocked" value={banksBlocked} active={kpiFilter === 'implBlocked'} onClick={() => setKpiFilter(kpiFilter === 'implBlocked' ? 'all' : 'implBlocked')} dimmed={isStatusActive} />
            <div className="w-px h-3 bg-foreground/[0.07] mx-0.5 shrink-0" />
            <KpiChip dot="bg-amber-400" label="Ready Go-Live" value={banksReadyForGoLive} active={kpiFilter === 'implReadyForGoLive'} onClick={() => setKpiFilter(kpiFilter === 'implReadyForGoLive' ? 'all' : 'implReadyForGoLive')} dimmed={isStatusActive} />
          </div>
        </div>
      </div>

      {(kpiFilter !== 'all' || filterCategory !== 'All' || filterRisk !== 'All' || searchQuery !== '' || implProgressFilter !== 'all') && (
        <div className="px-8 md:px-10 max-w-[1920px] mx-auto w-full -mb-4 pt-6">
          <div className="flex flex-wrap items-center gap-3">
             <span className="text-[10px] text-foreground/40 uppercase tracking-[0.2em] font-bold">Active Filters:</span>
             {kpiFilter !== 'all' && <span className="text-[11px] font-medium bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full shadow-[0_0_10px_-2px_rgba(79,50,214,0.2)]">KPI: {kpiFilter}</span>}
             {filterCategory !== 'All' && <span className="text-[11px] font-medium bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full shadow-[0_0_10px_-2px_rgba(79,50,214,0.2)]">Category: {filterCategory}</span>}
             {filterRisk !== 'All' && <span className="text-[11px] font-medium bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full shadow-[0_0_10px_-2px_rgba(79,50,214,0.2)]">Risk: {filterRisk}</span>}
             {searchQuery !== '' && <span className="text-[11px] font-medium bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full shadow-[0_0_10px_-2px_rgba(79,50,214,0.2)]">Search: {searchQuery}</span>}
             {implProgressFilter !== 'all' && <span className="text-[11px] font-medium bg-purple-500/10 text-purple-500 border border-purple-500/30 px-3 py-1 rounded-full">Impl: {implProgressFilter}%</span>}

             <button
               onClick={() => { setKpiFilter('all'); setFilterCategory('All'); setFilterRisk('All'); setSearchQuery(''); setImplProgressFilter('all'); }}
               className="text-[11px] font-medium text-foreground/50 hover:text-primary transition-colors ml-1 px-2"
             >
               Clear All
             </button>
          </div>
        </div>
      )}

      <div className="flex-1 p-4 sm:p-8 md:p-10 max-w-[1920px] mx-auto w-full flex flex-col gap-5 sm:gap-8">
        
        {/* Control Bar — Category + Filters + Impl% range */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <CategoryFilter categories={categories} value={filterCategory} onChange={setFilterCategory} />

          <button 
            onClick={() => setIsAdvancedFilterOpen(true)}
            aria-label="Open advanced filters"
            className={cn(
              "flex items-center justify-center w-9 h-9 sm:w-[42px] sm:h-[42px] rounded-xl transition-all backdrop-blur-md shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/50",
              filterRisk !== 'All' 
                ? "bg-primary/20 border border-primary/50 text-primary shadow-[0_0_15px_-3px_rgba(79,50,214,0.3)]" 
                : "bg-foreground/5 border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-primary/40 hover:bg-primary/10"
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <div className="flex items-center gap-0.5 sm:gap-1 p-1 bg-foreground/5 border border-foreground/10 rounded-xl backdrop-blur-md shrink-0 overflow-x-auto hide-scrollbar">
            <span className="hidden sm:inline text-[9px] text-foreground/30 uppercase tracking-wider font-bold px-2">Impl%</span>
            {(['all', '0-25', '26-50', '51-75', '76-100'] as const).map(range => (
              <button
                key={range}
                onClick={() => setImplProgressFilter(range)}
                className={cn(
                  'px-2 sm:px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors focus:outline-none whitespace-nowrap',
                  implProgressFilter === range ? 'bg-purple-500/20 text-purple-400 shadow-sm' : 'text-foreground/40 hover:text-foreground hover:bg-foreground/10'
                )}
              >
                {range === 'all' ? 'All' : `${range}%`}
              </button>
            ))}
          </div>
        </div>

        <AdvancedFiltersPanel 
          open={isAdvancedFilterOpen} 
          onOpenChange={setIsAdvancedFilterOpen} 
          filterCategory={filterCategory} 
          setFilterCategory={setFilterCategory} 
          categories={categories}
          filterRisk={filterRisk}
          setFilterRisk={setFilterRisk}
        />

        {/* Main Content Area */}
        <AnimatePresence mode="wait">
          {filteredBanks.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-32 flex flex-col items-center justify-center gap-4 text-foreground/30 text-center">
               <div className="w-16 h-16 rounded-full bg-foreground/5 border border-foreground/10 flex items-center justify-center shadow-lg"><Search className="w-6 h-6 text-foreground/20" /></div>
               <p className="text-xl font-light tracking-wide mt-2">No matching records found.</p>
               <button onClick={() => { setFilterCategory('All'); setFilterRisk('All'); setSearchQuery(''); setKpiFilter('all'); }} className="text-primary text-sm hover:underline mt-2">Clear all filters</button>
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
  // canEdit: no assignments → normal access; assignments set → only own banks (super_admin always ok)
  const canEdit = assignedBankIds.length === 0 || userRole === 'super_admin' || isMyBank;

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
              <StatusQuickPicker bankId={displayBank.id} status={displayBank.status} />
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
            <div className="w-10 h-10 rounded-xl bg-foreground/5 border border-foreground/10 p-1.5 shrink-0 shadow-inner">
               <BankLogo src={displayBank.logoUrl} alt={displayBank.nameEn} fallbackText={displayBank.nameAr.substring(0, 2)} />
            </div>
            {implProgress !== undefined && (
              <span className="text-sm font-mono font-bold text-foreground/70">
                {Math.round(implProgress.completionPercentage)}%
              </span>
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
            <StatusQuickPicker bankId={displayBank.id} status={displayBank.status} />
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
            <StatusQuickPicker bankId={displayBank.id} status={displayBank.status} />
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
