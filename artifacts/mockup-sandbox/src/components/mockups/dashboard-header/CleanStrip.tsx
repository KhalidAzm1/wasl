// Variant B — الشريط النظيف
// Ultra-minimal header: logo left, KPIs as a single horizontal strip, search integrated

import { useState } from "react";
import {
  Building2, TrendingUp, CheckCircle2, Clock, AlertTriangle,
  Zap, FlaskConical, ShieldAlert, Rocket, BarChart3, Search, Grid3X3, List, Columns3
} from "lucide-react";

type Filter = 'all' | 'inProgress' | 'completed' | 'delayed' | 'highRisk' |
  'implInProduction' | 'implInTesting' | 'implBlocked' | 'implReadyForGoLive';
type ViewMode = 'grid' | 'list' | 'kanban';

interface ChipProps {
  dot: string;
  label: string;
  value: number | string;
  active: boolean;
  onClick: () => void;
  suffix?: string;
  dimmed?: boolean;
}

function Chip({ dot, label, value, active, onClick, suffix, dimmed }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border transition-all duration-200 shrink-0
        ${active
          ? 'bg-white/10 border-white/25 shadow-sm'
          : 'bg-transparent border-transparent hover:bg-white/[0.04] hover:border-white/10'
        }
        ${dimmed ? 'opacity-40' : ''}
      `}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot} shadow-[0_0_6px_currentColor]`} />
      <span className={`text-[22px] font-black leading-none tracking-tight ${active ? 'text-white' : 'text-white/80'} transition-colors`}>
        {value}{suffix && <span className="text-sm ml-0.5 opacity-50">{suffix}</span>}
      </span>
      <span className={`text-[10px] leading-tight font-medium max-w-[56px] text-right ${active ? 'text-white/70' : 'text-white/35'} transition-colors`}>
        {label}
      </span>
    </button>
  );
}

export function CleanStrip() {
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const toggle = (f: Filter) => setActiveFilter(prev => prev === f ? 'all' : f);

  const statusChips = [
    { id: 'all' as Filter,        dot: 'bg-white/60',      label: "إجمالي البنوك",  value: 30 },
    { id: 'inProgress' as Filter, dot: 'bg-amber-400',     label: "قيد التنفيذ",   value: 14 },
    { id: 'completed' as Filter,  dot: 'bg-emerald-400',   label: "مكتمل",         value: 8 },
    { id: 'delayed' as Filter,    dot: 'bg-red-400',       label: "متأخر",         value: 5 },
    { id: 'highRisk' as Filter,   dot: 'bg-rose-500',      label: "مخاطر عالية",   value: 4 },
  ];

  const implChips = [
    { id: 'all' as Filter,                dot: 'bg-violet-400',  label: "متوسط التقدم",  value: 62, suffix: "%" },
    { id: 'implInProduction' as Filter,   dot: 'bg-emerald-400', label: "في الإنتاج",    value: 6 },
    { id: 'implInTesting' as Filter,      dot: 'bg-blue-400',    label: "في الاختبار",   value: 7 },
    { id: 'implBlocked' as Filter,        dot: 'bg-red-400',     label: "موقوف",         value: 2 },
    { id: 'implReadyForGoLive' as Filter, dot: 'bg-amber-400',   label: "جاهز للإطلاق", value: 3 },
  ];

  const isImplActive = ['implInProduction','implInTesting','implBlocked','implReadyForGoLive'].includes(activeFilter);
  const isStatusActive = ['inProgress','completed','delayed','highRisk'].includes(activeFilter);

  return (
    <div className="min-h-screen bg-[#0A0B1A]" dir="rtl">

      {/* Header — single sticky strip */}
      <div className="sticky top-0 z-40 bg-[#0A0B1A]/95 backdrop-blur-3xl border-b border-white/[0.06] shadow-2xl">

        {/* Top bar */}
        <div className="flex items-center gap-5 px-6 pt-4 pb-3">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white">وصل</span>
          </div>

          <div className="w-px h-5 bg-white/10 shrink-0" />

          {/* Status KPIs strip */}
          <div className="flex items-center gap-0.5 overflow-x-auto hide-scrollbar">
            {statusChips.map((c, i) => (
              <span key={c.id} className="flex items-center">
                {i > 0 && <span className="w-px h-4 bg-white/[0.07] mx-1 shrink-0" />}
                <Chip
                  dot={c.dot} label={c.label} value={c.value}
                  active={activeFilter === c.id}
                  dimmed={isImplActive}
                  onClick={() => toggle(c.id)}
                  suffix={(c as any).suffix}
                />
              </span>
            ))}
          </div>

          {/* Search — pushed to left */}
          <div className="flex-1 min-w-0" />
          <div className="relative shrink-0 w-52">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <input
              placeholder="بحث..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pr-9 pl-3 py-2 text-xs text-white/70 placeholder:text-white/25 outline-none focus:border-violet-500/40 transition-all"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 border border-white/10 rounded-xl p-1 shrink-0">
            {([['grid', Grid3X3], ['list', List], ['kanban', Columns3]] as [ViewMode, any][]).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === mode ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Implementation KPIs — second row, subtle */}
        <div className="flex items-center gap-2 px-6 pb-2.5">
          <div className="flex items-center gap-1.5 shrink-0">
            <BarChart3 className="w-3 h-3 text-violet-400/60" />
            <span className="text-[9px] text-white/25 uppercase tracking-[0.2em] font-bold">Implementation</span>
          </div>
          <div className="w-px h-4 bg-white/[0.07] shrink-0" />
          <div className="flex items-center gap-0.5 overflow-x-auto hide-scrollbar">
            {implChips.map((c, i) => (
              <span key={c.id} className="flex items-center">
                {i > 0 && <span className="w-px h-3 bg-white/[0.07] mx-0.5 shrink-0" />}
                <button
                  onClick={() => toggle(c.id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-right shrink-0
                    ${activeFilter === c.id
                      ? 'bg-white/8 border-white/20'
                      : 'border-transparent hover:bg-white/[0.03] hover:border-white/[0.08]'
                    }
                    ${isStatusActive ? 'opacity-35' : ''}
                  `}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                  <span className={`text-base font-black leading-none ${activeFilter === c.id ? 'text-white' : 'text-white/60'}`}>
                    {c.value}{c.suffix && <span className="text-xs opacity-50">{c.suffix}</span>}
                  </span>
                  <span className="text-[9px] text-white/30 font-medium">{c.label}</span>
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Body placeholder */}
      <div className="p-6 grid grid-cols-3 gap-4 opacity-30">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
        ))}
      </div>
    </div>
  );
}
