import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { useGetDashboardSummary } from '@workspace/api-client-react';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';
import { CubeErrorBoundary, isWebglAvailable } from '@/components/CubeErrorBoundary';

// The 3D vault (doors, reflective floor, particles, camera dolly) is heavy
// and WebGL-dependent. Lazy-load it and guard it with an error boundary so a
// render failure never blocks the entry page or the "Enter" button — the
// static fallback below still lets the user reach /portfolio.
const VaultScene = lazy(() =>
  import('@/components/VaultScene')
    .then((m) => ({ default: m.VaultScene }))
    .catch(() => ({ default: (_: { entering?: boolean }) => <></> }))
);

function StaticVaultFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-[70vmin] h-[70vmin] max-w-[560px] max-h-[560px] rounded-[3rem] bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10" />
    </div>
  );
}

function Counter({ value, label, delay }: { value: number; label: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay }}
      className="flex flex-col items-center gap-1"
    >
      <span className="text-4xl md:text-5xl font-mono font-bold text-white">{value}</span>
      <span className="text-white/50 text-xs md:text-sm tracking-widest uppercase">{label}</span>
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
    // Let the vault doors open + camera push through before handing off to
    // the portfolio dashboard.
    navigateTimeoutRef.current = window.setTimeout(() => navigate('/portfolio'), 2300);
  };

  return (
    <div dir="rtl" className="relative min-h-[100dvh] w-full overflow-hidden text-white bg-[#050510]">
      {/* Full-screen 3D vault: black glass doors, neon blue edges, reflective
          floor, particles and light rays. */}
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
        style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 35%, rgba(3,3,10,0.85) 100%)' }}
      />

      {/* HTML overlay: title, stats, CTA */}
      <motion.div
        animate={entering ? { opacity: 0, y: -16 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center justify-between min-h-[100dvh] px-6 py-10 pointer-events-none"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="text-center mt-4 md:mt-8"
        >
          <h1 className="text-base md:text-2xl font-bold tracking-[0.15em] text-white/90 drop-shadow-[0_0_20px_rgba(124,58,237,0.5)]">
            WASL BANKING COMMAND CENTER
          </h1>
          <p className="text-white/50 text-xs md:text-base mt-1 tracking-wide">منصة القيادة التنفيذية للبنوك</p>
        </motion.div>

        <div className="flex flex-col items-center gap-6 md:gap-10 mb-4 md:mb-8">
          <div className="flex items-center gap-6 sm:gap-10 md:gap-16">
            <Counter value={summary?.totalBanks ?? 0} label="Banking Partners" delay={0.9} />
            <Counter value={summary?.inProgress ?? 0} label="Active Integrations" delay={1.05} />
            <Counter value={summary?.completed ?? 0} label="Completed" delay={1.2} />
          </div>

          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.4 }}
            onClick={handleEnter}
            disabled={entering}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="group relative pointer-events-auto px-8 md:px-10 py-3.5 md:py-4 rounded-2xl border border-blue-400/30 bg-white/[0.06] backdrop-blur-xl overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.25)] disabled:cursor-not-allowed"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-primary/30 to-blue-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative flex flex-col items-center gap-0.5">
              <span className="text-white font-bold tracking-widest text-sm md:text-base">ENTER COMMAND CENTER</span>
              <span className="text-white/60 text-xs md:text-sm">دخول مركز القيادة</span>
            </span>
          </motion.button>
        </div>
      </motion.div>

      {/* Whiteout as the camera passes through the doors */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={entering ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1, delay: entering ? 0.9 : 0 }}
        className="fixed inset-0 z-30 bg-white pointer-events-none"
      />

      {/* Preload the logo so it's ready for the 3D scene's texture. */}
      <img src={logoUrl} alt="" className="hidden" />
    </div>
  );
}
