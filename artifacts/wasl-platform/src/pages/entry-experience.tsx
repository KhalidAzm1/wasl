import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Building2, Wallet, TrendingUp, Shield, Activity, Database, Fingerprint } from 'lucide-react';
// Activity is reused below both for the ambient background icon set and as the
// distinct right-side-panel glyph (AI Banking Dashboard), kept visually apart
// from the WASL wordmark used on the left panel.

// Images
import snbLogo from '@assets/wasl_brand/bank_cube/snb.png';
import alrajhiLogo from '@assets/wasl_brand/bank_cube/alrajhi.png';
import riyadLogo from '@assets/wasl_brand/bank_cube/riyad.png';
import alinmaLogo from '@assets/wasl_brand/bank_cube/alinma.png';
import bsfLogo from '@assets/wasl_brand/bank_cube/bsf.png';
import waslLogo from '@assets/wasl_brand/wasl_logo_2026.png';

// Theme Constants
const COLORS = {
  bg: '#050816',
  neonBlue: '#2F6BFF',
  glowBlue: '#63B3FF',
};

// ----------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------

const FloatingIcons = () => {
  const icons = useMemo(() => [
    CreditCard, Building2, Wallet, TrendingUp, Shield, Activity, Database, Fingerprint
  ], []);

  const items = useMemo(() => Array.from({ length: 24 }).map((_, i) => ({
    Icon: icons[i % icons.length],
    x: (Math.random() - 0.5) * 3000,
    y: (Math.random() - 0.5) * 2000,
    z: (Math.random() - 0.5) * 2000 - 500,
    size: Math.random() * 30 + 15,
    duration: Math.random() * 40 + 30,
    delay: Math.random() * 20
  })), [icons]);

  return (
    <div className="absolute w-full h-full pointer-events-none preserve-3d">
      {items.map((p, i) => {
        const Icon = p.Icon;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{ width: p.size, height: p.size, x: p.x, z: p.z, color: `rgba(47,107,255,0.25)` }}
            initial={{ y: p.y, opacity: 0, rotate: 0 }}
            animate={{ 
              y: p.y - 1200,
              opacity: [0, 0.4, 0],
              rotate: 360
            }}
            transition={{ duration: p.duration, repeat: Infinity, ease: 'linear', delay: p.delay }}
          >
            <Icon size={p.size} strokeWidth={1.5} />
          </motion.div>
        );
      })}
    </div>
  );
};

const DataStreams = () => {
  const streams = useMemo(() => Array.from({ length: 20 }).map(() => ({
    x: (Math.random() - 0.5) * 2500,
    z: (Math.random() - 0.5) * 1500 - 300,
    height: Math.random() * 300 + 100,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 5
  })), []);

  return (
    <div className="absolute inset-0 pointer-events-none preserve-3d">
      {streams.map((s, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 w-[1px]"
          style={{ 
            x: s.x, 
            z: s.z, 
            height: s.height,
            background: `linear-gradient(to bottom, transparent, rgba(99,179,255,0.5), transparent)`
          }}
          initial={{ y: 1500, opacity: 0 }}
          animate={{ y: -1500, opacity: [0, 1, 0] }}
          transition={{ duration: s.duration, repeat: Infinity, ease: 'linear', delay: s.delay }}
        />
      ))}
    </div>
  );
};

const EnvParticles = () => {
  const particles = useMemo(() => Array.from({ length: 60 }).map(() => ({
    x: (Math.random() - 0.5) * 2000,
    y: (Math.random() - 0.5) * 1500,
    z: (Math.random() - 0.5) * 1500,
    size: Math.random() * 4 + 1,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 10
  })), []);

  return (
    <div className="absolute w-full h-full pointer-events-none preserve-3d">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: COLORS.glowBlue,
            boxShadow: `0 0 12px rgba(47,107,255,0.8)`,
          }}
          initial={{ x: p.x, y: p.y, z: p.z, opacity: 0 }}
          animate={{ 
            y: p.y - 800,
            opacity: [0, 0.8, 0] 
          }}
          transition={{ duration: p.duration, repeat: Infinity, ease: 'linear', delay: p.delay }}
        />
      ))}
    </div>
  );
};

const HoverParticles = () => {
  const pData = useMemo(() => Array.from({ length: 40 }).map(() => ({
    xOff: (Math.random() - 0.5) * 600,
    yOff: (Math.random() - 0.5) * 600,
    zOff: (Math.random() - 0.5) * 600,
    dur: 0.8 + Math.random() * 1.5
  })), []);
  
  return (
    <div className="absolute inset-0 pointer-events-none preserve-3d">
      {pData.map((p, i) => (
        <motion.div
          key={i}
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: COLORS.glowBlue,
            boxShadow: `0 0 12px ${COLORS.glowBlue}`
          }}
          initial={{ x: '-50%', y: '-50%', z: 0, opacity: 1, scale: 1 }}
          animate={{ 
            x: `calc(-50% + ${p.xOff}px)`, 
            y: `calc(-50% + ${p.yOff}px)`, 
            z: p.zOff,
            opacity: 0,
            scale: 0 
          }}
          transition={{ duration: p.dur, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
    </div>
  );
};

const WallPanel = ({ side, isMobile }: { side: 'left' | 'right'; isMobile: boolean }) => {
  const isLeft = side === 'left';
  const xOffset = isLeft ? (isMobile ? -260 : -750) : (isMobile ? 260 : 750);
  const rotateY = isLeft ? 60 : -60;
  
  return (
    <div className="absolute preserve-3d pointer-events-none">
      <div 
        className="absolute flex flex-col items-center justify-center preserve-3d"
        style={{ transform: `translate3d(${xOffset}px, -150px, -250px) rotateY(${rotateY}deg)` }}
      >
         <motion.div
           className="w-40 md:w-72 h-64 md:h-96 rounded-2xl flex flex-col items-center justify-center overflow-hidden relative"
           style={{
             backgroundColor: 'rgba(5,8,22,0.6)',
             backdropFilter: 'blur(12px)',
             border: '1px solid rgba(47,107,255,0.2)'
           }}
           animate={{ 
             boxShadow: [
               '0 0 20px rgba(47,107,255,0.1), inset 0 0 10px rgba(47,107,255,0.1)', 
               '0 0 60px rgba(47,107,255,0.3), inset 0 0 30px rgba(47,107,255,0.3)', 
               '0 0 20px rgba(47,107,255,0.1), inset 0 0 10px rgba(47,107,255,0.1)'
             ] 
           }}
           transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: isLeft ? 0 : 2 }}
         >
            {isLeft ? (
              <img src={waslLogo} alt="WASL" className="w-24 md:w-32 opacity-80 filter drop-shadow-[0_0_15px_rgba(99,179,255,0.5)] grayscale" />
            ) : (
              <Activity
                className="w-16 h-16 md:w-20 md:h-20 opacity-80"
                style={{ color: COLORS.glowBlue, filter: `drop-shadow(0 0 15px rgba(99,179,255,0.5))` }}
                strokeWidth={1.25}
              />
            )}

            {!isLeft && (
              <div className="mt-6 text-white text-[10px] md:text-xs font-bold tracking-[0.2em] text-center opacity-80">
                AI BANKING<br/>DASHBOARD
              </div>
            )}
            
            <motion.div 
              className="absolute left-0 w-full h-[2px]"
              style={{ backgroundColor: COLORS.glowBlue, boxShadow: `0 0 15px rgba(99,179,255,1)` }}
              animate={{ top: ['-10%', '110%', '-10%'] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "linear", delay: isLeft ? 0 : 1.7 }}
            />
         </motion.div>
      </div>

      <div 
        className="absolute flex flex-col items-center justify-center preserve-3d"
        style={{ 
          transform: `translate3d(${xOffset}px, 200px, -250px) rotateY(${rotateY}deg) scaleY(-1)`,
          filter: 'blur(15px)',
          opacity: 0.2
        }}
      >
         <div className="w-40 md:w-72 h-64 md:h-96 rounded-2xl flex flex-col items-center justify-center relative" style={{ backgroundColor: 'rgba(47,107,255,0.1)' }}>
            {isLeft ? (
              <img src={waslLogo} alt="WASL" className="w-24 md:w-32 opacity-30 grayscale" />
            ) : (
              <Activity className="w-16 h-16 md:w-20 md:h-20 opacity-30" style={{ color: COLORS.glowBlue }} strokeWidth={1.25} />
            )}
            {!isLeft && (
              <div className="mt-6 text-white text-[10px] md:text-xs font-bold tracking-[0.2em] text-center opacity-30">
                AI BANKING<br/>DASHBOARD
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

const CubeFace = ({ rx = 0, ry = 0, img, isTop = false, stage, cubeSize }: { rx?: number, ry?: number, img?: string, isTop?: boolean, stage: number, cubeSize: number }) => {
  const H_SIZE = cubeSize / 2;
  const explodeOffset = stage >= 3 ? 600 : 0;
  const opacity = stage >= 3 ? 0 : (isTop ? 0.3 : 0.95);
  
  return (
    <motion.div 
      className="absolute left-0 top-0 flex items-center justify-center backdrop-blur-[4px]"
      initial={false}
      animate={{
        opacity,
        transform: `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${H_SIZE + explodeOffset}px)`
      }}
      transition={{ duration: stage >= 3 ? 0.7 : 0.3, ease: stage >= 3 ? "easeOut" : "linear" }}
      style={{ 
        width: cubeSize, 
        height: cubeSize, 
        backgroundColor: 'rgba(5,8,22,0.7)',
        border: `1px solid rgba(47,107,255,0.5)`,
        boxShadow: `inset 0 0 40px rgba(47,107,255,0.5), 0 0 20px rgba(47,107,255,0.4)`,
        backfaceVisibility: 'visible',
      }}
    >
      {img && <img src={img} alt="Bank Logo" className="w-[65%] h-[65%] object-contain drop-shadow-[0_0_20px_rgba(99,179,255,0.8)]" />}
    </motion.div>
  );
};

const CubeSpin = ({ stage, cubeSize }: { stage: number, cubeSize: number }) => (
  <motion.div
    className="absolute inset-0 preserve-3d"
    animate={stage >= 1 ? { rotateY: 0 } : { rotateY: [0, 360] }}
    transition={stage >= 1 ? { duration: 0.8, ease: "easeOut" } : { duration: 24, repeat: Infinity, ease: "linear" }}
  >
    <CubeFace stage={stage} cubeSize={cubeSize} ry={0} img={snbLogo} />
    <CubeFace stage={stage} cubeSize={cubeSize} ry={180} img={riyadLogo} />
    <CubeFace stage={stage} cubeSize={cubeSize} ry={90} img={alrajhiLogo} />
    <CubeFace stage={stage} cubeSize={cubeSize} ry={-90} img={alinmaLogo} />
    <CubeFace stage={stage} cubeSize={cubeSize} rx={-90} img={bsfLogo} />
    <CubeFace stage={stage} cubeSize={cubeSize} rx={90} isTop />
  </motion.div>
);

const EnergyRings = ({ stage, cubeSize }: { stage: number, cubeSize: number }) => {
  const isExploding = stage >= 3;
  return (
    <div 
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 preserve-3d pointer-events-none"
      style={{ transform: `translateY(${cubeSize + 100}px) rotateX(90deg)` }}
    >
      {[1, 2, 3].map((ring) => (
        <motion.div
          key={ring}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2px]"
          style={{ 
            width: ring * (cubeSize * 0.85), 
            height: ring * (cubeSize * 0.85),
            borderColor: 'rgba(47,107,255,0.4)',
            boxShadow: '0 0 15px rgba(47,107,255,0.3) inset, 0 0 15px rgba(47,107,255,0.3)'
          }}
          animate={{ 
            rotateZ: [0, 360 * (ring % 2 === 0 ? -1 : 1)],
            scale: isExploding ? 4 : [1, 1.05, 1],
            opacity: isExploding ? 0 : [0.1, 0.4, 0.1]
          }}
          transition={{ 
            rotateZ: { duration: 20 * ring, repeat: Infinity, ease: "linear" },
            scale: isExploding ? { duration: 0.7 } : { duration: 4 * ring, repeat: Infinity, ease: "easeInOut" },
            opacity: isExploding ? { duration: 0.5 } : { duration: 4 * ring, repeat: Infinity, ease: "easeInOut" }
          }}
        />
      ))}
    </div>
  );
};

const WaslHeader = ({ stage, cubeSize }: { stage: number, cubeSize: number }) => {
  const isExploding = stage >= 3;
  const H_SIZE = cubeSize / 2;
  return (
    <motion.div 
      className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-end pointer-events-none w-[300px]"
      style={{ bottom: `${H_SIZE + 40}px`, transform: 'translateZ(0px)' }}
      animate={{ opacity: isExploding ? 0 : 1, y: isExploding ? -100 : 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative mb-2 w-40 md:w-52 flex justify-center">
        <motion.img 
          src={waslLogo} 
          alt="" 
          className="absolute w-full blur-[12px] filter brightness-150"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <img src={waslLogo} alt="WASL AI Hub" className="relative w-full drop-shadow-[0_0_8px_rgba(99,179,255,0.8)]" />
      </div>
      
      <div className="text-white tracking-[0.35em] text-[9px] md:text-[11px] font-light mt-1 mb-2 opacity-80 uppercase text-center w-full">
        Banking Intelligence Platform
      </div>
      
      <svg className="w-24 h-10 opacity-80" viewBox="0 0 128 80">
        <motion.path 
          d="M64 0 L64 30 L20 50 L20 80 M64 30 L108 50 L108 80 M64 0 L64 80"
          fill="none"
          stroke={COLORS.glowBlue}
          strokeWidth="2"
          strokeDasharray="200"
          animate={{ strokeDashoffset: [200, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          style={{ filter: `drop-shadow(0 0 5px rgba(47,107,255,0.8))` }}
        />
      </svg>
    </motion.div>
  );
};

// ----------------------------------------------------------------------
// Main Page Component
// ----------------------------------------------------------------------

export default function EntryExperience() {
  const [, navigate] = useLocation();
  const [entryStage, setEntryStage] = useState(0);
  const stageTimeoutsRef = useRef<number[]>([]);
  const [cubeSize, setCubeSize] = useState(260);
  const [isHovered, setIsHovered] = useState(false);

  const clearStageTimeouts = () => {
    stageTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    stageTimeoutsRef.current = [];
  };

  useEffect(() => {
    const handleResize = () => {
      setCubeSize(window.innerWidth < 768 ? 180 : 260);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearStageTimeouts();
    };
  }, []);

  const handleEnter = () => {
    if (entryStage > 0) return;
    setEntryStage(1); // Click -> Glow stronger, rotation stops

    const schedule = (fn: () => void, delay: number) => {
      const id = window.setTimeout(fn, delay);
      stageTimeoutsRef.current.push(id);
      return id;
    };

    schedule(() => setEntryStage(2), 500);  // Camera zooms in
    schedule(() => setEntryStage(3), 1200); // Explode cube faces, emit strong blue light
    schedule(() => setEntryStage(4), 1600); // Blue flash mask
    schedule(() => setEntryStage(5), 1800); // "Initializing..." text

    schedule(() => {
      // Fail-safe: if `navigate` throws, or silently no-ops and we're still
      // sitting on this route once the flash has fully painted, reset the
      // scene instead of leaving the opaque full-screen flash frozen forever.
      try {
        navigate('/portfolio');
      } catch {
        setEntryStage(0);
        return;
      }
      schedule(() => {
        if (window.location.pathname === '/') {
          setEntryStage(0);
        }
      }, 600);
    }, 2800); // Final route change
  };

  const H_SIZE = cubeSize / 2;
  const coreScale = entryStage >= 3 ? 8 : (entryStage >= 1 ? 1.5 : (isHovered ? 1.2 : 0.8));
  const auraOpacity = entryStage >= 4 ? 0 : (entryStage >= 3 ? 1 : (entryStage >= 1 ? 1 : (isHovered ? 0.8 : 0)));

  return (
    <div 
      className="relative h-[100dvh] w-screen overflow-hidden text-white" 
      style={{ perspective: '1000px', backgroundColor: COLORS.bg }}
      dir="ltr"
    >
      <style>{`
        .preserve-3d { transform-style: preserve-3d; }
      `}</style>
      
      {/* 3D Scene Root - Camera Movement Wrapper */}
      <motion.div
        className="absolute preserve-3d pointer-events-none"
        style={{ left: '50%', top: '50%' }}
        animate={
          entryStage >= 2 
          ? { scale: 3.5, translateZ: 800, rotateX: 0, rotateY: 0 } 
          : { rotateX: [-2, 2, -2], rotateY: [-3, 3, -3], scale: 1, translateZ: 0 }
        }
        transition={
          entryStage >= 2
          ? { duration: 1.2, ease: [0.4, 0, 0.2, 1] } 
          : { duration: 15, repeat: Infinity, ease: "easeInOut" }
        }
      >
        {/* Ambient Volumetric Glow */}
        <div 
          className="absolute w-[250vw] h-[250vh] left-[-125vw] top-[-125vh] transform translateZ(-1000px)" 
          style={{ background: `radial-gradient(circle at center, rgba(47,107,255,0.12) 0%, transparent 50%)` }} 
        />

        {/* Environment Decor */}
        <FloatingIcons />
        <DataStreams />
        <EnvParticles />

        {/* Reflective Dark Floor */}
        <div 
          className="absolute pointer-events-none"
          style={{
            width: '300vw',
            height: '200vh',
            left: '-150vw',
            top: '-100vh',
            background: `linear-gradient(to top, ${COLORS.bg} 20%, rgba(47,107,255,0.05) 100%)`,
            transform: 'translateY(40vh) rotateX(80deg) translateZ(-500px)',
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Light reflections / Grid on the floor */}
          <div 
            className="absolute inset-0 opacity-40" 
            style={{ 
              backgroundImage: 'linear-gradient(rgba(47,107,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(47,107,255,0.15) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
              WebkitMaskImage: 'linear-gradient(to top, black 10%, transparent 80%)', 
              maskImage: 'linear-gradient(to top, black 10%, transparent 80%)' 
            }}
          />
        </div>

        {/* Illuminated Glass Panels on Walls */}
        <WallPanel side="left" isMobile={cubeSize <= 180} />
        <WallPanel side="right" isMobile={cubeSize <= 180} />

        {/* Center Glowing Rotating Cube Container */}
        <div className="absolute preserve-3d pointer-events-none">
          <motion.div
            className="preserve-3d"
            animate={{ y: entryStage >= 2 ? 0 : [-12, 12, -12] }}
            transition={{ duration: 6, repeat: entryStage >= 2 ? 0 : Infinity, ease: "easeInOut" }}
          >
            <div style={{ transform: 'rotateX(-15deg)', transformStyle: 'preserve-3d' }}>
              
              <WaslHeader stage={entryStage} cubeSize={cubeSize} />
              <EnergyRings stage={entryStage} cubeSize={cubeSize} />

              <motion.div 
                className="absolute left-1/2 -translate-x-1/2 text-white opacity-40 text-xs md:text-sm tracking-widest uppercase pointer-events-none whitespace-nowrap"
                style={{ top: `${H_SIZE + 90}px`, transform: 'translateZ(0px)' }}
                animate={{ opacity: entryStage > 0 ? 0 : 0.4 }}
              >
                Click the cube to enter.
              </motion.div>

              {/* Floor Reflection of the rotating cube */}
              <motion.div 
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 preserve-3d"
                style={{ transform: `translateY(${cubeSize + 80}px) scaleY(-1)`, filter: 'blur(15px)' }}
                animate={{ opacity: entryStage >= 3 ? 0 : (isHovered || entryStage > 0 ? 0.7 : 0.3) }}
                transition={{ duration: 0.5 }}
              >
                <div style={{ width: cubeSize, height: cubeSize, left: -H_SIZE, top: -H_SIZE }} className="absolute preserve-3d">
                  <CubeSpin stage={entryStage} cubeSize={cubeSize} />
                </div>
              </motion.div>

              {/* The Actual Center Cube - Tappable Entry Point */}
              <motion.div 
                className="absolute pointer-events-auto cursor-pointer"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={handleEnter}
                style={{ width: cubeSize, height: cubeSize, left: -H_SIZE, top: -H_SIZE, transformStyle: 'preserve-3d' }}
                animate={entryStage >= 3 ? { scale: 1.2 } : { scale: entryStage >= 1 ? 1.1 : (isHovered ? 1.05 : 1) }}
                transition={{ duration: entryStage >= 3 ? 0.8 : 0.4 }}
              >
                <AnimatePresence>
                  {(isHovered || entryStage >= 1) && entryStage < 3 && <HoverParticles />}
                </AnimatePresence>

                <CubeSpin stage={entryStage} cubeSize={cubeSize} />

                {/* Internal core glow (non-rotating) */}
                <motion.div 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                  style={{ 
                    width: cubeSize * 0.8, 
                    height: cubeSize * 0.8, 
                    backgroundColor: COLORS.glowBlue, 
                    transform: 'translateZ(0px)', 
                    filter: 'blur(45px)' 
                  }}
                  animate={{ opacity: auraOpacity, scale: coreScale }}
                  transition={{ duration: 0.4 }}
                />

                {/* External Hover/Intensified Glow */}
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                  style={{ 
                    width: '150%', 
                    height: '150%', 
                    backgroundColor: COLORS.neonBlue, 
                    filter: 'blur(60px)', 
                    transform: 'translateZ(-1px)' 
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: auraOpacity, scale: coreScale }}
                  transition={{ duration: 0.4 }}
                />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Cinematic Flash / Fade transition mask */}
      <motion.div
        className="absolute inset-0 z-40 pointer-events-none mix-blend-screen"
        style={{ backgroundColor: COLORS.neonBlue }}
        initial={{ opacity: 0 }}
        animate={{ opacity: entryStage >= 4 ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-center"
        style={{ backgroundColor: COLORS.bg }}
        initial={{ opacity: 0 }}
        animate={{ opacity: entryStage >= 4 ? 1 : 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {entryStage >= 5 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="text-white text-lg md:text-2xl font-light tracking-widest uppercase"
          >
            Initializing WASL AI Hub...
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
