import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Users, Link2, CheckCircle2 } from 'lucide-react';
import { useGetDashboardSummary } from '@workspace/api-client-react';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';
import { CubeErrorBoundary, isWebglAvailable } from '@/components/CubeErrorBoundary';

// The 3D vault (glass doors, cube, reflective floor, particles, camera
// dolly) is heavy and WebGL-dependent. Lazy-load it and guard it with an
// error boundary so a render failure never blocks the entry page or the
// "Enter" button — the static fallback below still lets the user proceed.
const VaultScene = lazy(() =>
  import('@/components/VaultScene')
    .then((m) => ({ default: m.VaultScene }))
    .catch(() => ({ default: (_: { entering?: boolean }) => <></> }))
);

function StaticVaultFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-[70vmin] h-[70vmin] max-w-[420px] max-h-[420px] rounded-[2.5rem] bg-gradient-to-br from-white/[0.06] via-primary/10 to-transparent border border-white/10 flex items-center justify-center shadow-[0_0_80px_rgba(124,58,237,0.2)]">
        <img src={logoUrl} alt="Wasl" className="w-1/2 h-auto opacity-80" />
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  labelEn: string;
  labelAr: string;
  delay: number;
}

function StatCard({ icon: Icon, value, labelEn, labelAr, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay }}
      whileHover={{ y: -3, boxShadow: '0 0 40px rgba(124,58,237,0.35)' }}
      className="pointer-events-auto flex-1 min-w-[140px] rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 md:px-6 md:py-5 flex flex-col items-center gap-1 shadow-[0_0_30px_rgba(124,58,237,0.12)]"
    >
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 text-primary">
          <Icon className="w-4 h-4" />
        </span>
        <span className="text-2xl md:text-3xl font-mono font-bold text-white">{value}</span>
      </div>
      <span className="text-white/60 text-[10px] md:text-xs tracking-widest uppercase mt-1">{labelEn}</span>
      <span className="text-white/40 text-[10px] md:text-xs">{labelAr}</span>
    </motion.div>
  );
}

export default function EntryExperience() {
  const [, navigate] = useLocation();
  const { data: summary } = useGetDashboardSummary();
  const [entering, setEntering] = useState(false);
  const navigateTimeoutRef = useRef<number | null>(null);
  const webglOk = useMemo(() => isWebglAvailable(), []);

  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current !== null) {
        window.clearTimeout(navigateTimeoutRef.current);
      }
    };
  }, []);

  const handleEnter = () => {
    if (entering) return;
    setEntering(true);
    // Let the cube spin up, the vault doors open, and the camera push
    // through before handing off to the portfolio dashboard.
    navigateTimeoutRef.current = window.setTimeout(() => navigate('/portfolio'), 2300);
  };

  return (
    <div dir="rtl" className="relative min-h-[100dvh] w-full overflow-hidden text-white bg-[#050816]">
      {/* Full-screen 3D vault: glass doors, rotating bank-logo cube,
          reflective floor, particles. */}
      <div className="absolute inset-0">
        {webglOk ? (
          <CubeErrorBoundary fallback={<StaticVaultFallback />}>
            <Suspense fallback={<StaticVaultFallback />}>
              <VaultScene entering={entering} />
            </Suspense>
          </CubeErrorBoundary>
        ) : (
          <StaticVaultFallback />
        )}
      </div>

      {/* Vignette for cinematic depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(3,3,10,0.8) 100%)' }}
      />

      {/* HTML overlay: header, stats, CTA */}
      <motion.div
        animate={entering ? { opacity: 0, y: -16 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center justify-between min-h-[100dvh] px-4 sm:px-6 py-8 md:py-10 pointer-events-none"
      >
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.2 }}
          className="text-center flex flex-col items-center gap-2"
        >
          <img src={logoUrl} alt="Wasl" className="h-8 md:h-10 w-auto drop-shadow-[0_0_20px_rgba(124,58,237,0.6)]" />
          <h1 className="text-lg md:text-2xl font-bold tracking-wide text-white">
            منصة القيادة التنفيذية <span className="text-primary">للبنوك</span>
          </h1>
          <p className="text-white/50 text-[11px] md:text-sm tracking-[0.2em] uppercase">Wasl Banking Command Center</p>
        </motion.div>

        {/* Spacer so the 3D cube reads through the transparent middle */}
        <div className="flex-1" />

        <div className="w-full max-w-2xl flex flex-col items-center gap-5 md:gap-6 mb-2 md:mb-4">
          <div className="w-full flex items-stretch gap-3 md:gap-4">
            <StatCard icon={Users} value={summary?.totalBanks ?? 0} labelEn="Banking Partners" labelAr="شريك بنكي" delay={0.9} />
            <StatCard icon={Link2} value={summary?.inProgress ?? 0} labelEn="Active Integrations" labelAr="تكامل نشط" delay={1.05} />
            <StatCard icon={CheckCircle2} value={summary?.completed ?? 0} labelEn="Completed" labelAr="مكتمل" delay={1.2} />
          </div>

          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.4 }}
            onClick={handleEnter}
            disabled={entering}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            className="group relative w-full pointer-events-auto px-8 py-4 md:py-5 rounded-2xl border border-primary/40 bg-white/[0.05] backdrop-blur-xl overflow-hidden shadow-[0_0_60px_rgba(124,58,237,0.3)] disabled:cursor-not-allowed"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-primary/25 to-blue-500/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative flex flex-col items-center gap-0.5">
              <span className="text-white font-bold tracking-widest text-sm md:text-base">ENTER COMMAND CENTER</span>
              <span className="text-white/60 text-xs md:text-sm">دخول مركز القيادة</span>
            </span>
          </motion.button>
        </div>
      </motion.div>

      {/* Whiteout as the camera passes through the cube and doors */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={entering ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1, delay: entering ? 0.9 : 0 }}
        className="fixed inset-0 z-30 bg-white pointer-events-none"
      />
    </div>
  );
}
