import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import heroImageUrl from '@assets/WhatsApp_Image_2026-07-09_at_1.39.31_PM_1783594958614.jpeg';

/**
 * Entry / cinematic landing page. Per explicit direction: the uploaded
 * reference photo IS the executive vault scene — it is used directly as the
 * full-viewport background (no CSS or 3D recreation of the room). The image
 * already contains the logo, titles, stat cards, and button artwork; the
 * only thing layered on top is a subtle overlay/glow/particles plus an
 * invisible clickable hit-area over the image's own button.
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
    navigateTimeoutRef.current = window.setTimeout(() => navigate('/portfolio'), 1400);
  };

  return (
    <div dir="rtl" className="relative h-screen w-screen overflow-hidden text-white">
      {/* The uploaded image is the entire scene: full-viewport, cover, centered. */}
      <motion.div
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImageUrl})` }}
        initial={{ scale: 1 }}
        animate={{ scale: 1.02 }}
        transition={{ duration: 18, ease: 'easeOut' }}
      />

      {/* Subtle dark overlay only -- no blur, no gradient replacement. */}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(5,8,22,0.25)' }} />

      {/* Ambient purple/blue glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 45% at 50% 40%, rgba(124,58,237,0.16), transparent 70%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 75%, rgba(59,130,246,0.12), transparent 70%)' }} />

      {/* Soft floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => {
          const left = (i * 41.3) % 100;
          const size = 2 + (i % 4);
          const duration = 10 + (i % 6) * 2;
          const delay = (i % 8) * 0.6;
          const color = i % 2 === 0 ? 'rgba(124,58,237,0.55)' : 'rgba(59,130,246,0.5)';
          return (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{ left: `${left}%`, bottom: '-10px', width: size, height: size, background: color, boxShadow: `0 0 6px ${color}` }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: '-110vh', opacity: [0, 0.9, 0.9, 0] }}
              transition={{ duration, delay, repeat: Infinity, ease: 'linear' }}
            />
          );
        })}
      </div>

      {/* Content overlay -- the uploaded image already contains the logo,
          Arabic/English title, stat cards, and button art, so we only add
          the one interactive element it can't provide: a real clickable
          button, positioned to sit exactly over the image's own button. */}
      <motion.div
        animate={entering ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center justify-between h-full px-4 sm:px-6 py-8 md:py-10 pointer-events-none"
      >
        <div />

        <div className="flex-1" />

        {/* Invisible clickable hit-area positioned over the button artwork
            already baked into the image (roughly its bottom band). A subtle
            hover glow gives feedback without drawing a second button. */}
        <motion.button
          initial={{ opacity: 1 }}
          onClick={handleEnter}
          disabled={entering}
          aria-label="Enter Command Center / دخول مركز القيادة"
          whileHover={{ boxShadow: '0 0 40px 6px rgba(124,58,237,0.35)' }}
          whileTap={{ scale: 0.985 }}
          className="w-full max-w-2xl h-[9%] min-h-[64px] pointer-events-auto rounded-2xl disabled:cursor-not-allowed mb-[6%]"
        />
      </motion.div>

      {/* Fade to black on enter, then navigate. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={entering ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1 }}
        className="fixed inset-0 z-30 bg-black pointer-events-none"
      />
    </div>
  );
}
