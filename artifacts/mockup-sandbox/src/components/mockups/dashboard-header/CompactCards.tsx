// Variant A — الكارد المدمج
// KPIs as icon cards in a clean 2-row grid, logo compact on the left

import { useState } from "react";
import {
  Building2, TrendingUp, CheckCircle2, Clock, AlertTriangle,
  Zap, FlaskConical, ShieldAlert, Rocket, BarChart3, Search, SlidersHorizontal
} from "lucide-react";

type Filter = 'all' | 'inProgress' | 'completed' | 'delayed' | 'highRisk' |
  'implInProduction' | 'implInTesting' | 'implBlocked' | 'implReadyForGoLive';

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
  borderColor: string;
  active: boolean;
  onClick: () => void;
  suffix?: string;
}

function MetricCard({ icon, label, value, color, bgColor, borderColor, active, onClick, suffix }: MetricCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-start gap-1.5 px-4 py-3 rounded-2xl border transition-all duration-200 text-left
        ${active
          ? `${bgColor} ${borderColor} shadow-lg scale-[1.03]`
          : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
        }
      `}
    >
      <div className={`flex items-center gap-2 ${active ? color : 'text-white/40'} transition-colors`}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-widest">{label}</span>
      </div>
      <div className={`text-3xl font-black leading-none tracking-tight ${active ? color : 'text-white/90'} transition-colors`}>
        {value}{suffix && <span className="text-base font-semibold ml-0.5 opacity-60">{suffix}</span>}
      </div>
    </button>
  );
}

export function CompactCards() {
  const [activeFilter, setActiveFilter] = useState<Filter>('all');

  const toggle = (f: Filter) => setActiveFilter(prev => prev === f ? 'all' : f);

  // Simulated data
  const statusMetrics = [
    { id: 'all' as Filter,        icon: <Building2 className="w-3.5 h-3.5" />, label: "إجمالي البنوك",    value: 30,  color: 'text-white',             bgColor: 'bg-white/10',          borderColor: 'border-white/30' },
    { id: 'inProgress' as Filter, icon: <TrendingUp className="w-3.5 h-3.5" />, label: "قيد التنفيذ",   value: 14,  color: 'text-amber-400',          bgColor: 'bg-amber-500/10',      borderColor: 'border-amber-500/30' },
    { id: 'completed' as Filter,  icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "مكتمل",      value: 8,   color: 'text-emerald-400',        bgColor: 'bg-emerald-500/10',    borderColor: 'border-emerald-500/30' },
    { id: 'delayed' as Filter,    icon: <Clock className="w-3.5 h-3.5" />, label: "متأخر",             value: 5,   color: 'text-red-400',            bgColor: 'bg-red-500/10',        borderColor: 'border-red-500/30' },
    { id: 'highRisk' as Filter,   icon: <AlertTriangle className="w-3.5 h-3.5" />, label: "مخاطر عالية", value: 4,  color: 'text-red-400',            bgColor: 'bg-red-500/10',        borderColor: 'border-red-500/30' },
  ];

  const implMetrics = [
    { id: 'all' as Filter,                icon: <BarChart3 className="w-3.5 h-3.5" />,   label: "متوسط التقدم",    value: 62, color: 'text-violet-400', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/30', suffix: "%" },
    { id: 'implInProduction' as Filter,   icon: <Rocket className="w-3.5 h-3.5" />,       label: "في الإنتاج",       value: 6,  color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
    { id: 'implInTesting' as Filter,      icon: <FlaskConical className="w-3.5 h-3.5" />, label: "في الاختبار",      value: 7,  color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    borderColor: 'border-blue-500/30' },
    { id: 'implBlocked' as Filter,        icon: <ShieldAlert className="w-3.5 h-3.5" />,  label: "موقوف",            value: 2,  color: 'text-red-400',     bgColor: 'bg-red-500/10',     borderColor: 'border-red-500/30' },
    { id: 'implReadyForGoLive' as Filter, icon: <Zap className="w-3.5 h-3.5" />,          label: "جاهز للإطلاق",    value: 3,  color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/30' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0B1A]" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0B1A]/90 backdrop-blur-3xl border-b border-white/[0.06] px-6 py-4 flex flex-col gap-4 shadow-2xl">

        {/* Top row: Logo + Search */}
        <div className="flex items-center justify-between gap-6">
          {/* Logo compact */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">وصل</p>
              <p className="text-[9px] text-white/30 uppercase tracking-[0.2em] leading-tight mt-0.5">Banking Platform</p>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-sm relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              placeholder="ابحث عن بنك..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl pr-9 pl-4 py-2.5 text-sm text-white/80 placeholder:text-white/30 outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
            />
          </div>

          {/* View controls placeholder */}
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white/60 hover:border-white/20 text-xs transition-all">
            <SlidersHorizontal className="w-3.5 h-3.5" /> فلاتر
          </button>
        </div>

        {/* Status KPIs grid */}
        <div className="grid grid-cols-5 gap-2">
          {statusMetrics.map(m => (
            <MetricCard
              key={m.id}
              icon={m.icon} label={m.label} value={m.value}
              color={m.color} bgColor={m.bgColor} borderColor={m.borderColor}
              active={activeFilter === m.id}
              onClick={() => toggle(m.id)}
              suffix={(m as any).suffix}
            />
          ))}
        </div>

        {/* Implementation KPIs grid */}
        <div className="flex items-center gap-2">
          <div className="text-[9px] text-white/20 uppercase tracking-[0.25em] font-bold shrink-0">Implementation</div>
          <div className="flex-1 h-px bg-white/[0.05]" />
          <div className="grid grid-cols-5 gap-2 flex-1">
            {implMetrics.map(m => (
              <MetricCard
                key={m.id}
                icon={m.icon} label={m.label} value={m.value}
                color={m.color} bgColor={m.bgColor} borderColor={m.borderColor}
                active={activeFilter === m.id}
                onClick={() => toggle(m.id)}
                suffix={(m as any).suffix}
              />
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
