import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useGetDashboardSummary } from '@workspace/api-client-react';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';

// Lazy + defensively wrapped: a WebGL failure here must never block the
// entry experience from being usable (the "دخول مركز القيادة" button still
// has to work even if the 3D cube can't render on this browser).
const RotatingCube = lazy(() =>
  import('@/components/RotatingCube').then((m) => ({ default: m.RotatingCube })).catch(() => ({
    default: () => (
      <div className="w-[320px] h-[320px] mx-auto flex items-center justify-center rounded-3xl bg-gradient-to-br from-white/10 via-primary/10 to-secondary/10 border border-white/10">
        <img src={logoUrl} alt="Wasl" className="w-2/3 h-auto opacity-80" />
      </div>
    ),
  }))
);

function CubeSlotFallback() {
  return <div className="w-[320px] h-[320px] mx-auto rounded-3xl bg-white/5 border border-white/10 animate-pulse" />;
}

function Counter({ value, label, delay }: { value: number; label: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay }}
      className="flex flex-col items-center gap-1"
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: delay + 0.2 }}
        className="text-4xl md:text-5xl font-mono font-bold text-white"
      >
        {value}
      </motion.span>
      <span className="text-white/50 text-xs md:text-sm tracking-widest uppercase">{label}</span>
    </motion.div>
  );
}

export default function EntryExperience() {
  const [, navigate] = useLocation();
  const { data: summary } = useGetDashboardSummary();
  const [entering, setEntering] = useState(false);
  const navigateTimeoutRef = useRef<number | null>(null);

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
    // Let the cube spin-up + doors + camera-push animation play out before
    // handing off to the portfolio dashboard.
    navigateTimeoutRef.current = window.setTimeout(() => navigate('/portfolio'), 1700);
  };

  return (
    <div
      dir="rtl"
      className="relative min-h-[100dvh] w-full overflow-hidden flex flex-col items-center justify-center text-white"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0b1230 0%, #050816 60%, #030410 100%)' }}
    >
      {/* Ambient cinematic background: gradients, geometric lines, particles */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ opacity: [0.25, 0.4, 0.25] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/25 blur-[140px]"
        />
        <motion.div
          animate={{ opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-[-20%] right-[-10%] w-[65%] h-[65%] rounded-full bg-blue-500/20 blur-[160px]"
        />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        {/* Subtle floating particles */}
        {Array.from({ length: 18 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/40"
            style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }}
            animate={{ y: [0, -30, 0], opacity: [0.1, 0.6, 0.1] }}
            transition={{ duration: 6 + (i % 5), repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
          />
        ))}
      </div>

      {/*
        The hero stays mounted for the entire enter sequence — the vault
        doors, cube speed-up and camera-push all animate via the `entering`
        flag on their own elements. Unmounting this block immediately would
        cut those animations short before they can play out.
      */}
      <motion.div
        animate={entering ? { opacity: 0.85 } : { opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center px-6 py-10 max-h-[100dvh] overflow-y-auto"
      >
        {/* Step 1: logo fade + glow */}
        <motion.img
          src={logoUrl}
          alt="Wasl"
          initial={{ opacity: 0, y: -12, filter: 'drop-shadow(0 0 0px rgba(124,58,237,0))' }}
          animate={{ opacity: 1, y: 0, filter: 'drop-shadow(0 0 30px rgba(124,58,237,0.45))' }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          className="w-40 md:w-56 lg:w-64 h-auto mb-3 md:mb-4 shrink-0"
        />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="text-center mb-6 md:mb-10 shrink-0"
        >
          <h1 className="text-base md:text-2xl font-bold tracking-wide text-white/90">Wasl Banking Command Center</h1>
          <p className="text-white/50 text-xs md:text-base mt-1">منصة القيادة التنفيذية للبنوك</p>
        </motion.div>

        {/* Digital vault door + 3D cube centerpiece */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: entering ? 1.05 : 1 }}
          transition={{ duration: 1, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center justify-center mb-6 md:mb-10 shrink-0"
        >
          {/* Vault frame */}
          <div className="absolute w-[240px] h-[240px] sm:w-[300px] sm:h-[300px] md:w-[380px] md:h-[380px] lg:w-[420px] lg:h-[420px] rounded-[2.5rem] border border-white/15 bg-white/[0.03] backdrop-blur-2xl shadow-[0_0_80px_rgba(124,58,237,0.25)]" />
          <div className="absolute w-[240px] h-[240px] sm:w-[300px] sm:h-[300px] md:w-[380px] md:h-[380px] lg:w-[420px] lg:h-[420px] rounded-[2.5rem] border border-white/10"
            style={{ boxShadow: 'inset 0 0 60px rgba(59,130,246,0.15)' }}
          />
          {/* Vault doors — slide open on enter */}
          <motion.div
            animate={entering ? { x: '-100%' } : { x: 0 }}
            transition={{ duration: 1.1, ease: [0.7, 0, 0.3, 1] }}
            className="absolute right-1/2 top-0 h-full w-[120px] sm:w-[150px] md:w-[190px] lg:w-[210px] rounded-l-[2.5rem] bg-gradient-to-l from-white/[0.06] to-white/[0.02] border-r border-white/15 backdrop-blur-xl z-20"
          />
          <motion.div
            animate={entering ? { x: '100%' } : { x: 0 }}
            transition={{ duration: 1.1, ease: [0.7, 0, 0.3, 1] }}
            className="absolute left-1/2 top-0 h-full w-[120px] sm:w-[150px] md:w-[190px] lg:w-[210px] rounded-r-[2.5rem] bg-gradient-to-r from-white/[0.06] to-white/[0.02] border-l border-white/15 backdrop-blur-xl z-20"
          />

          <motion.div
            animate={entering ? { scale: 2.2, opacity: 0 } : { scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10"
          >
            <Suspense fallback={<CubeSlotFallback />}>
              <RotatingCube size={220} spinBoost={entering ? 6 : 1} />
            </Suspense>
          </motion.div>
        </motion.div>

        {/* Statistics */}
        <motion.div
          animate={entering ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-6 sm:gap-10 md:gap-16 mb-6 md:mb-12 shrink-0"
        >
          <Counter value={summary?.totalBanks ?? 0} label="Banking Partners" delay={1.2} />
          <Counter value={summary?.inProgress ?? 0} label="Active Integrations" delay={1.35} />
          <Counter value={summary?.completed ?? 0} label="Completed" delay={1.5} />
        </motion.div>

        {/* Enter button */}
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={entering ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: entering ? 0 : 1.7 }}
          onClick={handleEnter}
          disabled={entering}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className="group relative shrink-0 px-8 md:px-10 py-3.5 md:py-4 rounded-2xl border border-white/20 bg-white/[0.06] backdrop-blur-xl overflow-hidden shadow-[0_0_40px_rgba(124,58,237,0.2)] disabled:cursor-not-allowed"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-primary/30 to-secondary/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <span className="relative flex flex-col items-center gap-0.5">
            <span className="text-white font-bold tracking-widest text-sm md:text-base">ENTER COMMAND CENTER</span>
            <span className="text-white/60 text-xs md:text-sm">دخول مركز القيادة</span>
          </span>
        </motion.button>
      </motion.div>

      {/* Camera-push / whiteout transition while navigating */}
      <AnimatePresence>
        {entering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.4 }}
            className="fixed inset-0 z-30 bg-white pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
