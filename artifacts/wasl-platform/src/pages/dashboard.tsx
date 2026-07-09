import React, { useState } from 'react';
import { useGetDashboardSummary, useListBanks, useGetBank, getGetBankQueryKey } from '@workspace/api-client-react';
import type { Bank, BankDetail } from '@workspace/api-client-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { BankLogo } from '@/components/BankLogo';
import { formatDate, formatPercentage } from '@/lib/utils';

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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('الكل');

  if (isLoadingSummary || isLoadingBanks) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="text-white/50 text-xl font-light tracking-widest uppercase">جاري التحميل...</div>
      </div>
    );
  }

  if (!summary || !banks) return null;

  const categories = ["الكل", ...Array.from(new Set(banks.map(b => b.category).filter(Boolean)))];
  const filteredBanks = filter === 'الكل' ? banks : banks.filter(b => b.category === filter);

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

function HorizontalBankCard({ bankSummary, hoveredId, setHoveredId }: { bankSummary: Bank, hoveredId: string | null, setHoveredId: (id: string | null) => void }) {
  const { data: bankDetail } = useGetBank(bankSummary.id, {
    query: { queryKey: getGetBankQueryKey(bankSummary.id) }
  });

  const isHovered = hoveredId === bankSummary.id;
  const isDimmed = hoveredId !== null && hoveredId !== bankSummary.id;

  const displayBank = bankDetail || bankSummary;
  const products = (displayBank as BankDetail).products;
  const avgProgress = products?.length 
    ? products.reduce((acc, p) => acc + p.progressPercent, 0) / products.length 
    : 0;

  return (
    <motion.div variants={itemVariants} className="will-change-transform h-full">
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
                    <div className="text-xl md:text-2xl font-bold text-white drop-shadow-xl">{displayBank.status}</div>
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
