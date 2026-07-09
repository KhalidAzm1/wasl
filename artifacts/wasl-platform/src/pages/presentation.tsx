import React, { useState } from 'react';
import { useListBanks, useGetBank, getGetBankQueryKey } from '@workspace/api-client-react';
import type { Bank, BankDetail } from '@workspace/api-client-react';
import { BankLogo } from '@/components/BankLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { NavControls } from '@/components/NavControls';
import { formatDate, formatPercentage } from '@/lib/utils';
import { Link } from 'wouter';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';

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

export default function PresentationMode() {
  const { data: banks, isLoading } = useListBanks();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('الكل');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-6" dir="rtl">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="text-white/50 text-xl font-light tracking-widest uppercase">جاري التحميل...</div>
      </div>
    );
  }

  if (!banks || banks.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
         <div className="text-white/30 text-2xl font-light">لا توجد بنوك لعرضها</div>
      </div>
    );
  }

  const categories = ["الكل", ...Array.from(new Set(banks.map(b => b.category).filter(Boolean)))];
  const filteredBanks = filter === 'الكل' ? banks : banks.filter(b => b.category === filter);

  return (
    <div className="min-h-screen bg-[#030408] text-foreground overflow-x-hidden selection:bg-primary/30 font-sans" dir="rtl">
      
      {/* Background ambient light */}
      <div className="fixed inset-0 pointer-events-none z-0">
         <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] mix-blend-screen opacity-50" />
         <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[100px] mix-blend-screen opacity-30" />
         <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      </div>

      {/* Header Bar */}
      <div className="fixed top-0 left-0 right-0 w-full z-50 p-6 flex justify-between items-center pointer-events-none">
         <div className="pointer-events-auto">
            <NavControls variant="overlay" />
         </div>
         <img src={logoUrl} alt="Wasl" className="w-24 h-auto opacity-95 drop-shadow-2xl" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 pt-32 pb-32 px-8 md:px-16 2xl:px-24 max-w-[1920px] mx-auto min-h-screen flex flex-col">
        
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col xl:flex-row xl:items-end justify-between gap-12 mb-20"
        >
          <div className="max-w-4xl">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white tracking-tight mb-6 drop-shadow-2xl leading-[1.1]">
              المحفظة <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">الاستراتيجية</span>
            </h1>
            <p className="text-xl md:text-3xl text-white/50 leading-relaxed font-light">
              استعراض استراتيجي لشراكاتنا البنكية وجهات التمويل، مع متابعة حية لمستويات الإنجاز والقرارات الفعالة.
            </p>
          </div>

          {/* Filters */}
          {categories.length > 2 && (
            <div className="flex flex-wrap items-center justify-end gap-2 bg-white/5 p-2 rounded-2xl backdrop-blur-xl border border-white/10 shrink-0 shadow-2xl max-w-full xl:max-w-xl">
              {categories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-5 py-3 md:px-8 md:py-4 rounded-xl text-base md:text-lg font-bold whitespace-nowrap transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0c16] ${
                    filter === cat 
                      ? 'bg-primary text-white shadow-[0_0_20px_rgba(79,50,214,0.4)]' 
                      : 'text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Portfolio Wall Grid */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={filter}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: 20, transition: { duration: 0.3 } }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-10 md:gap-14"
          >
            {filteredBanks.map(bank => (
               <BankCard key={bank.id} bankSummary={bank} hoveredId={hoveredId} setHoveredId={setHoveredId} />
            ))}
          </motion.div>
        </AnimatePresence>
        
        {filteredBanks.length === 0 && (
           <div className="py-32 text-center text-white/30 text-2xl font-light">لا توجد بنوك في هذا التصنيف</div>
        )}

      </div>
    </div>
  );
}

function BankCard({ bankSummary, hoveredId, setHoveredId }: { bankSummary: Bank, hoveredId: string | null, setHoveredId: (id: string | null) => void }) {
  // Fetch full details gracefully in the background to access nested products for live progress
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
    <motion.div variants={itemVariants} className="will-change-transform">
      <Link
        href={`/bank/${displayBank.id}`}
        className="block relative group rounded-[2.5rem] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#030408]"
        style={{ perspective: 1000 }}
        onFocus={() => setHoveredId(displayBank.id)}
        onBlur={() => { if (hoveredId === displayBank.id) setHoveredId(null); }}
      >
        <motion.div
          onMouseEnter={() => setHoveredId(displayBank.id)}
          onMouseLeave={() => setHoveredId(null)}
          animate={{
            scale: isHovered ? 1.04 : isDimmed ? 0.96 : 1,
            opacity: isDimmed ? 0.4 : 1,
            filter: isDimmed ? "blur(12px) brightness(0.7)" : "blur(0px) brightness(1)",
            y: isHovered ? -16 : 0,
            rotateX: isHovered ? 2 : 0,
            rotateY: isHovered ? -2 : 0,
          }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full aspect-[2/3] rounded-[2.5rem] overflow-hidden bg-[#0a0c16] border border-white/10 cursor-pointer shadow-2xl"
          style={{ zIndex: isHovered ? 50 : 1, transformStyle: 'preserve-3d' }}
        >
          {/* Background Image / Gradient */}
          <div className="absolute inset-0 z-0">
            {displayBank.heroImageUrl ? (
              <motion.img 
                src={displayBank.heroImageUrl} 
                alt="" 
                className="w-full h-full object-cover mix-blend-luminosity opacity-50"
                animate={{ scale: isHovered ? 1.15 : 1.05 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-secondary/10 opacity-40" />
            )}
          </div>
          
          {/* Gradients */}
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/50 to-transparent opacity-95" />
          <motion.div 
            className="absolute inset-0 z-10 bg-gradient-to-t from-primary/50 via-primary/5 to-transparent mix-blend-screen"
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.6 }}
          />

          {/* Dynamic Glare Effect */}
          <motion.div 
            className="absolute inset-0 z-40 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none"
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.6 }}
          />

          {/* Content Container */}
          <div className="absolute inset-0 z-20 p-8 md:p-10 flex flex-col justify-between items-center text-center">
            
            {/* Logo Section */}
            <motion.div 
              className="flex-1 flex flex-col items-center justify-center w-full"
              animate={{ y: isHovered ? -24 : 0, scale: isHovered ? 1.05 : 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
               <div className="w-36 h-36 md:w-44 md:h-44 rounded-[2.5rem] bg-white/5 backdrop-blur-3xl border border-white/20 p-6 flex items-center justify-center shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                 <BankLogo src={displayBank.logoUrl} alt={displayBank.nameEn} fallbackText={displayBank.nameAr.substring(0, 2)} />
               </div>
               {/* Priority Badge */}
               {displayBank.priorityImpact === 'HOT' && (
                 <div className="mt-6 px-6 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full font-bold tracking-widest text-sm backdrop-blur-md">
                   أولوية قصوى
                 </div>
               )}
            </motion.div>
            
            {/* Title & Info Section */}
            <motion.div 
              className="w-full flex flex-col items-center"
              animate={{ y: isHovered ? -16 : 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight drop-shadow-xl leading-tight text-center">{displayBank.nameAr}</h2>
              <h3 className="text-xl md:text-2xl text-white/50 font-sans tracking-[0.2em] uppercase mb-2 text-center">{displayBank.nameEn}</h3>
              
              <motion.div 
                className="overflow-hidden w-full"
                initial={false}
                animate={{ 
                  height: isHovered ? 'auto' : 0, 
                  opacity: isHovered ? 1 : 0,
                  marginTop: isHovered ? 32 : 0
                }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                 <div className="h-px w-24 bg-white/20 mx-auto mb-8" />
                 
                 <div className="flex items-center justify-center gap-10 mb-8">
                    <div className="text-center">
                       <div className="text-4xl font-mono font-bold text-emerald-400 drop-shadow-xl">{formatPercentage(avgProgress)}</div>
                       <div className="text-white/50 text-sm uppercase tracking-widest mt-3 font-medium">نسبة الإنجاز</div>
                    </div>
                    <div className="w-px h-16 bg-white/10" />
                    <div className="text-center">
                       <div className="text-2xl font-bold text-white drop-shadow-xl mt-1">{displayBank.status}</div>
                       <div className="text-white/50 text-sm uppercase tracking-widest mt-3 font-medium">الحالة</div>
                    </div>
                 </div>
                 
                 {displayBank.nextMeetingDate && (
                   <div className="w-full bg-white/5 rounded-2xl py-4 px-6 border border-white/10 backdrop-blur-xl">
                     <div className="text-white/50 text-xs uppercase tracking-[0.2em] mb-2">الاجتماع القادم</div>
                     <div className="text-xl text-white font-medium">{formatDate(displayBank.nextMeetingDate)}</div>
                   </div>
                 )}
              </motion.div>
            </motion.div>

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
