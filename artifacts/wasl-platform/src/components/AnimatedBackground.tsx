import React from 'react';
import { motion } from 'framer-motion';

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-background transition-colors duration-500">
      {/* Light Mode Specific Background */}
      <div className="absolute inset-0 dark:hidden">
         {/* Apple Vision Pro / Linear inspired gradient */}
         <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at top, #FFFFFF 0%, #F6F8FC 50%, #EEF2F7 100%)' }} />
         
         {/* Blurred blue light spots in corners */}
         <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 0.8 }}
           transition={{ duration: 2 }}
           className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#63B3FF]/20 blur-[120px]" 
         />
         <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 0.6 }}
           transition={{ duration: 2, delay: 0.5 }}
           className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-[#2F6BFF]/15 blur-[150px]" 
         />
         
         {/* Particles */}
         <FloatingParticles />
      </div>

      {/* Dark Mode Specific Background */}
      <div className="absolute inset-0 hidden dark:block">
        <div className="absolute inset-0 bg-grid-pattern opacity-50" />
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 2 }}
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" 
        />
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          transition={{ duration: 2, delay: 0.5 }}
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-secondary/20 blur-[150px]" 
        />
        <motion.div 
          animate={{ 
            y: [0, -20, 0],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ 
            duration: 10, 
            repeat: Infinity,
            ease: "easeInOut" 
          }}
          className="absolute top-[40%] right-[30%] w-[30%] h-[30%] rounded-full bg-purple-500/10 blur-[100px]" 
        />
      </div>

      {/* Noise Texture Overlay for both */}
      <div 
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.015] mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />
    </div>
  );
}

function FloatingParticles() {
  const prefersReducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  
  const particles = React.useMemo(() => {
    if (prefersReducedMotion) return [];
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 20 + 20,
      delay: Math.random() * -20,
    }));
  }, [prefersReducedMotion]);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[#63B3FF]/30"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
          }}
          animate={{
            y: ['-100%', '100%'],
            x: ['-50%', '50%'],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
}