import React, { useState } from 'react';
import { useGetDashboardSummary, useListBanks, useListProducts, useListProductTypes, useGetBank, useUpdateBank, getGetBankQueryKey, getListBanksQueryKey } from '@workspace/api-client-react';
import type { Bank } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Link } from 'wouter';
import { Pencil, Save, Search, SlidersHorizontal, LayoutGrid, List, Columns3, User, Clock, AlertTriangle, FileText, ChevronDown, Check } from 'lucide-react';
import { BankLogo } from '@/components/BankLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime, getStatusColor, cn } from '@/lib/utils';
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

function ProgressRing({ progress, size = 48, strokeWidth = 4 }: { progress: number, size?: number, strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-foreground/10"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.1 }}
          strokeLinecap="round"
          className="text-primary drop-shadow-[0_0_6px_rgba(79,50,214,0.6)]"
        />
      </svg>
      <div className="absolute text-[10px] font-mono font-bold text-foreground drop-shadow-md flex items-baseline">
        {Math.round(progress)}<span className="text-[8px] text-foreground/60 ml-[1px]">%</span>
      </div>
    </div>
  );
}

function CategoryFilter({ categories, value, onChange }: { categories: string[], value: string, onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button 
        onClick={() => setOpen(!open)} 
        className={cn(
          "flex items-center gap-2 h-[48px] px-5 rounded-full border text-[15px] transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 glass-panel",
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

function KpiButton({ label, value, colorClass, active, onClick }: { label: string; value: number; colorClass: string; active: boolean; onClick: () => void }) {
  const [displayValue, setDisplayValue] = useState(0);
  const prefersReducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  React.useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    let startTimestamp: number | null = null;
    let rafId: number;
    const duration = 1000;
    const startValue = displayValue;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(Math.floor(startValue + (value - startValue) * easeProgress));

      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, prefersReducedMotion]);

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative overflow-hidden flex flex-col text-left px-5 py-3.5 shrink-0 min-w-[140px] md:w-auto transition-all duration-300 focus:outline-none glass-card group outline-none",
        active 
          ? "border-primary/50 shadow-[0_0_30px_-5px_rgba(47,107,255,0.4)] transform -translate-y-1 bg-white/80 dark:bg-foreground/10 dark:border-primary/40 dark:shadow-[0_0_30px_-5px_rgba(79,50,214,0.25)]" 
          : "hover:border-primary/30 dark:bg-foreground/5 dark:border-foreground/5 dark:hover:bg-foreground/10 dark:hover:border-foreground/10"
      )}
    >
      {active && <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-b from-white/50 to-transparent pointer-events-none transition-opacity duration-300 dark:hidden" />
      <span className="relative z-10 text-foreground/50 text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] mb-1.5">{label}</span>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value} // The actual value changing triggers the pop, but displayValue is what renders
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "relative z-10 text-2xl md:text-3xl font-mono font-light tracking-tight",
            active ? "text-primary drop-shadow-[0_0_8px_rgba(47,107,255,0.4)] dark:drop-shadow-[0_0_8px_rgba(79,50,214,0.6)]" : colorClass
          )}
        >
          {displayValue}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: banks, isLoading: isLoadingBanks } = useListBanks();
  const { data: products, isLoading: isLoadingProducts } = useListProducts();
  
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterRisk, setFilterRisk] = useState<string>('All');
  const [kpiFilter, setKpiFilter] = useState<'all' | 'inProgress' | 'completed' | 'delayed' | 'highRisk'>('all');
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);

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

  const categories = ["All", ...Array.from(new Set(banks.map(b => b.category).filter(Boolean)))];

  const normalizeStatus = (s: string) => s.toLowerCase();
  const matchesKpi = (bank: Bank) => {
    if (kpiFilter === 'all') return true;
    if (kpiFilter === 'highRisk') return bank.riskLevel === 'High';
    const status = normalizeStatus(bank.status || '');
    if (kpiFilter === 'completed') return status.includes('complet');
    if (kpiFilter === 'delayed') return status.includes('delay');
    if (kpiFilter === 'inProgress') return status.includes('progress');
    return true;
  };

  const highRiskBankCount = banks.filter(b => b.riskLevel === 'High').length;

  const filteredBanks = [...banks]
    .filter(b => {
      if (filterCategory !== 'All' && b.category !== filterCategory) return false;
      if (filterRisk !== 'All' && b.riskLevel !== filterRisk) return false;
      if (!matchesKpi(b)) return false;
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
    <div className="min-h-full flex flex-col w-full overflow-x-hidden">
      
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-3xl border-b border-foreground/5 px-8 py-8 flex flex-col items-center gap-7 shadow-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
           <WaslLogo height={90} imgClassName="w-auto" />
           <p className="text-[11px] text-foreground/40 uppercase tracking-[0.2em] font-medium">Banking Intelligence Platform</p>
        </div>

        <div className="flex md:flex-wrap items-center justify-center gap-3 md:gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none hide-scrollbar -mx-8 px-8 md:mx-0 md:px-0 pb-2 md:pb-0 w-full">
          <KpiButton label="Total Banks" value={summary.totalBanks} colorClass="text-foreground" active={kpiFilter === 'all'} onClick={() => setKpiFilter('all')} />
          <div className="hidden md:block w-px h-8 md:h-10 bg-foreground/10 shrink-0" />
          <KpiButton label="In Progress" value={summary.inProgress} colorClass="text-yellow-600 dark:text-yellow-400" active={kpiFilter === 'inProgress'} onClick={() => setKpiFilter(kpiFilter === 'inProgress' ? 'all' : 'inProgress')} />
          <div className="hidden md:block w-px h-8 md:h-10 bg-foreground/10 shrink-0" />
          <KpiButton label="Completed" value={summary.completed} colorClass="text-emerald-600 dark:text-emerald-400" active={kpiFilter === 'completed'} onClick={() => setKpiFilter(kpiFilter === 'completed' ? 'all' : 'completed')} />
          <div className="hidden md:block w-px h-8 md:h-10 bg-foreground/10 shrink-0" />
          <KpiButton label="Delayed" value={summary.delayed} colorClass="text-red-600 dark:text-red-400" active={kpiFilter === 'delayed'} onClick={() => setKpiFilter(kpiFilter === 'delayed' ? 'all' : 'delayed')} />
          <div className="hidden md:block w-px h-8 md:h-10 bg-foreground/10 shrink-0" />
          <KpiButton label="High Risk" value={highRiskBankCount} colorClass="text-red-600 dark:text-red-400" active={kpiFilter === 'highRisk'} onClick={() => setKpiFilter(kpiFilter === 'highRisk' ? 'all' : 'highRisk')} />
        </div>
      </div>

      {(kpiFilter !== 'all' || filterCategory !== 'All' || filterRisk !== 'All' || searchQuery !== '') && (
        <div className="px-8 md:px-10 max-w-[1920px] mx-auto w-full -mb-4 pt-6">
          <div className="flex flex-wrap items-center gap-3">
             <span className="text-[10px] text-foreground/40 uppercase tracking-[0.2em] font-bold">Active Filters:</span>
             {kpiFilter !== 'all' && <span className="text-[11px] font-medium bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full shadow-[0_0_10px_-2px_rgba(79,50,214,0.2)]">Status: {kpiFilter}</span>}
             {filterCategory !== 'All' && <span className="text-[11px] font-medium bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full shadow-[0_0_10px_-2px_rgba(79,50,214,0.2)]">Category: {filterCategory}</span>}
             {filterRisk !== 'All' && <span className="text-[11px] font-medium bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full shadow-[0_0_10px_-2px_rgba(79,50,214,0.2)]">Risk: {filterRisk}</span>}
             {searchQuery !== '' && <span className="text-[11px] font-medium bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full shadow-[0_0_10px_-2px_rgba(79,50,214,0.2)]">Search: {searchQuery}</span>}

             <button
               onClick={() => { setKpiFilter('all'); setFilterCategory('All'); setFilterRisk('All'); setSearchQuery(''); }}
               className="text-[11px] font-medium text-foreground/50 hover:text-primary transition-colors ml-1 px-2"
             >
               Clear All
             </button>
          </div>
        </div>
      )}

      <div className="flex-1 p-8 md:p-10 max-w-[1920px] mx-auto w-full flex flex-col gap-8">
        
        {/* Control Bar */}
        <div className="flex flex-col xl:flex-row gap-4 xl:items-center justify-between">
          <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full xl:w-auto">
            {/* Search */}
            <div className="relative group w-full md:w-[320px] shrink-0">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-foreground/40 group-focus-within:text-primary transition-colors" />
              </div>
              <input 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search banks, people..."
                aria-label="Search banks, people..."
                className="w-full glass-panel !rounded-full pl-11 pr-4 h-[48px] text-[15px] text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:bg-white/80 dark:focus:bg-card/60 transition-all shadow-inner"
              />
            </div>

            {/* Category Dropdown */}
            <CategoryFilter categories={categories} value={filterCategory} onChange={setFilterCategory} />

            {/* Advanced Filters Button */}
            <button 
              onClick={() => setIsAdvancedFilterOpen(true)}
              aria-label="Open advanced filters"
              className={cn(
                "flex items-center justify-center w-[42px] h-[42px] rounded-xl transition-all backdrop-blur-md shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/50",
                filterRisk !== 'All' 
                  ? "bg-primary/20 border border-primary/50 text-primary shadow-[0_0_15px_-3px_rgba(79,50,214,0.3)]" 
                  : "bg-foreground/5 border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-primary/40 hover:bg-primary/10"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center p-1 bg-foreground/5 border border-foreground/10 rounded-xl backdrop-blur-md shrink-0 w-max xl:w-auto">
            <button onClick={() => setViewMode('grid')} aria-label="Grid view" aria-pressed={viewMode === 'grid'} className={cn("p-2 rounded-lg transition-colors focus:outline-none", viewMode === 'grid' ? "bg-primary/20 text-primary shadow-sm" : "text-foreground/50 hover:text-foreground hover:bg-foreground/10")}><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('list')} aria-label="List view" aria-pressed={viewMode === 'list'} className={cn("p-2 rounded-lg transition-colors focus:outline-none", viewMode === 'list' ? "bg-primary/20 text-primary shadow-sm" : "text-foreground/50 hover:text-foreground hover:bg-foreground/10")}><List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('kanban')} aria-label="Kanban view" aria-pressed={viewMode === 'kanban'} className={cn("p-2 rounded-lg transition-colors focus:outline-none", viewMode === 'kanban' ? "bg-primary/20 text-primary shadow-sm" : "text-foreground/50 hover:text-foreground hover:bg-foreground/10")}><Columns3 className="w-4 h-4" /></button>
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
                         <CompactBankCard key={bank.id} bankSummary={bank} hoveredId={hoveredId} setHoveredId={setHoveredId} viewMode="kanban" avgProgress={progressByBank.get(bank.id) || 0} />
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
                <CompactBankCard key={bank.id} bankSummary={bank} hoveredId={hoveredId} setHoveredId={setHoveredId} viewMode="list" avgProgress={progressByBank.get(bank.id) || 0} />
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="grid"
              variants={containerVariants} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-24"
            >
              {filteredBanks.map(bank => (
                <CompactBankCard key={bank.id} bankSummary={bank} hoveredId={hoveredId} setHoveredId={setHoveredId} viewMode="grid" avgProgress={progressByBank.get(bank.id) || 0} />
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
      <DialogContent className="sm:max-w-[650px] bg-background/95 backdrop-blur-3xl border-foreground/10 text-foreground max-h-[85vh] overflow-y-auto !rounded-3xl shadow-[0_0_50px_-12px_rgba(79,50,214,0.15)]" dir="ltr" onClick={e => e.stopPropagation()}>
        <DialogHeader className="border-b border-foreground/5 pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl font-light tracking-wide">
             <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
               <Pencil className="w-4 h-4 text-primary" />
             </div>
             Edit {bank.nameAr}
          </DialogTitle>
        </DialogHeader>
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
        <DialogFooter className="pt-2 border-t border-foreground/5">
          <Button onClick={handleSave} className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/80 font-bold rounded-xl h-[42px] transition-colors shadow-[0_0_15px_-3px_rgba(79,50,214,0.4)]" disabled={updateBank.isPending}>
            <Save className="w-4 h-4" /> {updateBank.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompactBankCard({ 
  bankSummary, 
  hoveredId, 
  setHoveredId,
  viewMode,
  avgProgress
}: { 
  bankSummary: Bank; 
  hoveredId: string | null; 
  setHoveredId: (id: string | null) => void;
  viewMode: 'grid' | 'list' | 'kanban';
  avgProgress: number;
}) {
  const { data: bankDetail } = useGetBank(bankSummary.id, {
    query: { queryKey: getGetBankQueryKey(bankSummary.id) }
  });
  const [isEditOpen, setIsEditOpen] = useState(false);

  const displayBank = bankDetail || bankSummary;
  const isHovered = hoveredId === displayBank.id;

  const risksCount = bankDetail?.risks?.length || 0;
  const docsCount = bankDetail?.documents?.length || 0;
  
  const statusColor = getStatusColor(displayBank.status);

  const EditButton = ({ className }: { className?: string }) => (
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
            </div>
          </div>

          <div className="relative z-20 flex items-center gap-6 flex-1 justify-between sm:justify-start overflow-x-auto hide-scrollbar">
            <div className="w-16 shrink-0">
              <ProgressRing progress={avgProgress} size={36} strokeWidth={2.5} />
            </div>
            
            <div className="w-36 shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-foreground/5 border border-foreground/5 w-max text-[11px] font-medium backdrop-blur-md">
                <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot} shadow-[0_0_8px_currentColor]`} />
                <span className="text-foreground/80 truncate max-w-[120px]">{displayBank.status}</span>
              </div>
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
              {formatDateTime(displayBank.updatedAt).split(',')[0]}
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
            <ProgressRing progress={avgProgress} size={36} strokeWidth={2.5} />
          </div>
          
          <div className="relative z-20 min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">{displayBank.nameAr}</h2>
            <h3 className="text-[10px] text-foreground/50 uppercase tracking-widest truncate">{displayBank.nameEn}</h3>
          </div>
          
          <div className="relative z-20 flex items-center justify-between text-[11px] mt-1 pt-3 border-t border-foreground/5">
            <span className="text-foreground/70 flex items-center gap-1.5 truncate pr-2">
              <User className="w-3 h-3 text-primary/70 shrink-0" /> 
              <span className="truncate">{displayBank.responsiblePerson?.split(' ')[0] || '—'}</span>
            </span>
            <div className="flex items-center gap-3 shrink-0">
               <span className={`flex items-center gap-1 ${risksCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground/40'}`}><AlertTriangle className="w-3 h-3"/>{risksCount}</span>
               <span className="flex items-center gap-1 text-foreground/40"><FileText className="w-3 h-3"/>{docsCount}</span>
            </div>
          </div>
          
          <EditButton className="absolute top-3 right-3 w-7 h-7 bg-background/60 backdrop-blur-md border border-foreground/10 text-foreground/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 hover:text-primary hover:bg-primary/20 hover:border-primary/40 transition-all text-[12px]" />
        </motion.div>
      );
    }

    // Default GRID
    return (
      <motion.div
        onMouseEnter={() => setHoveredId(displayBank.id)}
        onMouseLeave={() => setHoveredId(null)}
        animate={{ scale: isHovered ? 1.02 : 1, y: isHovered ? -4 : 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full h-[320px] rounded-[24px] overflow-hidden glass-card cursor-pointer group"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-transparent transition-all duration-700 pointer-events-none" />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-b from-white/50 to-transparent pointer-events-none transition-opacity duration-300 dark:hidden rounded-[24px]" />
        
        {/* Glow for active bank */}
        {displayBank.status === 'Active - Integration In Progress' && (
           <div className="absolute inset-0 z-10 rounded-[24px] pointer-events-none shadow-[inset_0_0_0_1px_rgba(47,107,255,0.3),0_0_20px_0_rgba(47,107,255,0.15)] dark:shadow-[inset_0_0_0_1px_rgba(79,50,214,0.3),0_0_20px_0_rgba(79,50,214,0.2)]" />
        )}

        {displayBank.logoUrl && (
          <div className="absolute -right-8 -bottom-8 w-40 h-40 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700 pointer-events-none blur-[2px]">
            <img src={displayBank.logoUrl} alt="" className="w-full h-full object-contain" />
          </div>
        )}

        <div className="relative z-20 h-full p-6 flex flex-col">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/50 dark:bg-foreground/5 border border-foreground/10 p-2.5 flex items-center justify-center shadow-sm backdrop-blur-md">
                 <BankLogo src={displayBank.logoUrl} alt={displayBank.nameEn} fallbackText={displayBank.nameAr.substring(0, 2)} />
              </div>
              <ProgressRing progress={avgProgress} size={44} strokeWidth={3} />
            </div>
            <EditButton className="w-8 h-8 bg-background/60 backdrop-blur-md border border-foreground/10 text-foreground/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 hover:text-primary hover:bg-primary/15 hover:border-primary/40 transition-all text-[14px]" />
          </div>

          <div className="mt-5 min-w-0">
            <h2 className="text-lg font-bold text-foreground leading-tight truncate">{displayBank.nameAr}</h2>
            <h3 className="text-[11px] text-foreground/50 tracking-[0.15em] uppercase truncate">{displayBank.nameEn}</h3>
          </div>

          <div className="mt-2.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-foreground/5 border border-foreground/5 text-[11px] font-medium backdrop-blur-md shadow-sm">
              <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot} shadow-[0_0_8px_currentColor]`} />
              <span className="text-foreground/80">{displayBank.status}</span>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-foreground/5 grid grid-cols-2 gap-y-3 gap-x-2">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-foreground/40 uppercase tracking-[0.15em] font-semibold">Owner</span>
              <span className="text-xs text-foreground/90 truncate flex items-center gap-1.5">
                <User className="w-3 h-3 text-primary/70 shrink-0" />
                <span className="truncate">{displayBank.responsiblePerson || '—'}</span>
              </span>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-foreground/40 uppercase tracking-[0.15em] font-semibold">Risks</span>
              <span className={`text-xs truncate flex items-center gap-1.5 ${risksCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground/60'}`}>
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="truncate">{risksCount} {displayBank.riskLevel && `· ${displayBank.riskLevel}`}</span>
              </span>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-foreground/40 uppercase tracking-[0.15em] font-semibold">Docs</span>
              <span className="text-xs text-foreground/60 truncate flex items-center gap-1.5">
                <FileText className="w-3 h-3 shrink-0" />
                <span className="truncate">{docsCount} files</span>
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-foreground/40 uppercase tracking-[0.15em] font-semibold">Updated</span>
              <span className="text-xs text-foreground/60 truncate flex items-center gap-1.5">
                <Clock className="w-3 h-3 shrink-0" />
                <span className="truncate">{formatDateTime(displayBank.updatedAt).split(',')[0]}</span>
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
      >
        {content()}
      </Link>
    </motion.div>
  );
}
