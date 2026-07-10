import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';
import EntryCube from '@/components/EntryCube';

/**
 * Entry page: a real interactive Three.js scene (see EntryCube) recreating the
 * reference render -- rotating/floating cube with WASL + bank logo faces,
 * reflective floor, ambient blue lighting -- plus glowing WASL wall marks,
 * animated light rays, floating particles and a glass CTA button.
 */
export default function EntryExperience() {
  const [, navigate] = useLocation();
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
    navigateTimeoutRef.current = window.setTimeout(() => navigate('/portfolio'), 1800);
  };

  return (
    <div
      dir="ltr"
      className="relative h-screen w-screen overflow-hidden text-white"
      style={{ backgroundColor: '#050816' }}
    >
      {/* Real interactive 3D scene: rotating cube + reflective floor + lighting. */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        <EntryCube />
      </motion.div>

      {/* Ambient blue glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 45%, rgba(59,130,246,0.10), transparent 70%)' }}
      />

      {/* Animated vertical light rays, either side of the cube. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden hidden md:block">
        {[12, 22, 78, 88].map((leftPct, i) => (
          <motion.div
            key={leftPct}
            className="absolute top-0 bottom-0"
            style={{
              left: `${leftPct}%`,
              width: 2,
              background: 'linear-gradient(to bottom, transparent, rgba(96,165,250,0.5), transparent)',
              filter: 'blur(1px)',
            }}
            initial={{ opacity: 0.15 }}
            animate={{ opacity: [0.15, 0.5, 0.15] }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }}
          />
        ))}
      </div>

      {/* Occasional ambient light flicker over the whole scene. */}
      <motion.div
        className="absolute inset-0 pointer-events-none bg-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0, 0.04, 0, 0, 0, 0.02, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />

      {/* Glowing, pulsing WASL wall marks -- left and right, like the reference. */}
      <motion.img
        src={logoUrl}
        alt="Wasl"
        className="no-mirror absolute left-4 md:left-10 top-1/2 -translate-y-1/2 h-16 md:h-24 w-auto hidden sm:block pointer-events-none"
        style={{ filter: 'drop-shadow(0 0 18px rgba(124,58,237,0.85)) drop-shadow(0 0 34px rgba(59,130,246,0.5))' }}
        animate={{ filter: [
          'drop-shadow(0 0 18px rgba(124,58,237,0.85)) drop-shadow(0 0 34px rgba(59,130,246,0.5)) brightness(1)',
          'drop-shadow(0 0 30px rgba(124,58,237,1)) drop-shadow(0 0 54px rgba(59,130,246,0.75)) brightness(1.3)',
          'drop-shadow(0 0 18px rgba(124,58,237,0.85)) drop-shadow(0 0 34px rgba(59,130,246,0.5)) brightness(1)',
        ] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.img
        src={logoUrl}
        alt="Wasl"
        className="no-mirror absolute right-4 md:right-10 top-1/2 -translate-y-1/2 h-16 md:h-24 w-auto hidden sm:block pointer-events-none"
        style={{ filter: 'drop-shadow(0 0 18px rgba(124,58,237,0.85)) drop-shadow(0 0 34px rgba(59,130,246,0.5))' }}
        animate={{ filter: [
          'drop-shadow(0 0 18px rgba(124,58,237,0.85)) drop-shadow(0 0 34px rgba(59,130,246,0.5)) brightness(1)',
          'drop-shadow(0 0 30px rgba(124,58,237,1)) drop-shadow(0 0 54px rgba(59,130,246,0.75)) brightness(1.3)',
          'drop-shadow(0 0 18px rgba(124,58,237,0.85)) drop-shadow(0 0 34px rgba(59,130,246,0.5)) brightness(1)',
        ] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />

      {/* Soft particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => {
          const left = (i * 47.7) % 100;
          const size = 2 + (i % 3);
          const duration = 12 + (i % 6) * 2;
          const delay = (i % 8) * 0.7;
          const color = i % 2 === 0 ? 'rgba(124,58,237,0.5)' : 'rgba(59,130,246,0.5)';
          return (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${left}%`,
                bottom: '-10px',
                width: size,
                height: size,
                background: color,
                boxShadow: `0 0 6px ${color}`,
              }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: '-110vh', opacity: [0, 0.85, 0.85, 0] }}
              transition={{ duration, delay, repeat: Infinity, ease: 'linear' }}
            />
          );
        })}
      </div>

      {/* Purple pulse on click, centered on the cube. */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{ width: 40, height: 40, background: 'radial-gradient(circle, rgba(124,58,237,0.9), transparent 70%)' }}
        initial={{ scale: 1, opacity: 0 }}
        animate={entering ? { scale: 40, opacity: [0.9, 0] } : { scale: 1, opacity: 0 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      {/* Single glass CTA button, bottom center. */}
      <motion.div
        animate={entering ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-x-0 bottom-6 sm:bottom-8 md:bottom-10 flex justify-center px-4 pointer-events-none"
      >
        <motion.button
          onClick={handleEnter}
          disabled={entering}
          whileHover={{ scale: 1.03, boxShadow: '0 0 45px 10px rgba(59,130,246,0.45), 0 0 70px 18px rgba(124,58,237,0.25)' }}
          whileTap={{ scale: 0.97 }}
          className="pointer-events-auto w-[85%] max-w-[320px] h-[64px] md:h-[80px] rounded-[24px] border border-white/20 bg-white/[0.08] backdrop-blur-xl flex flex-col items-center justify-center gap-0.5 disabled:cursor-not-allowed"
          style={{ boxShadow: '0 0 30px 6px rgba(59,130,246,0.3), 0 0 50px 12px rgba(124,58,237,0.18), inset 0 1px 0 rgba(255,255,255,0.15)' }}
        >
          <span className="text-white font-bold tracking-wide text-sm md:text-base">ENTER PLATFORM</span>
          <span className="text-white/75 text-xs md:text-sm">Enter Platform</span>
        </motion.button>
      </motion.div>

      {/* Cinematic loading transition overlay. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={entering ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5, delay: entering ? 0.4 : 0 }}
        className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 pointer-events-none"
        style={{ backgroundColor: '#050816' }}
      >
        <motion.img
          src={logoUrl}
          alt="Wasl"
          className="h-28 w-auto"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={entering ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          style={{ filter: 'drop-shadow(0 0 24px rgba(124,58,237,0.7))' }}
        />
        <div className="relative w-40 h-[2px] bg-white/10 overflow-hidden rounded-full">
          <motion.div
            className="absolute inset-y-0 left-0 w-1/2 rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, #3b82f6, #7c3aed, transparent)' }}
            animate={entering ? { x: ['-100%', '200%'] } : { x: '-100%' }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </motion.div>
    </div>
  );
}
