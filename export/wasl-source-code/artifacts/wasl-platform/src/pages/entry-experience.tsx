import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';

// Images
import snbLogo from '@assets/wasl_brand/bank_cube/snb.png';
import alrajhiLogo from '@assets/wasl_brand/bank_cube/alrajhi_no_bg.png';
import riyadLogo from '@assets/wasl_brand/bank_cube/riyad.png';
import alinmaLogo from '@assets/wasl_brand/bank_cube/alinma.png';
import bsfLogo from '@assets/wasl_brand/bank_cube/bsf.png';
import waslLogo from '@assets/wasl_brand/wasl_logo_2026.png';
import bgImage from '@assets/generated_images/corridor_bg.jpg';

// Theme Constants
const COLORS = {
  bg: '#05030A',
  glowBlue: '#6C4CFF',
  violet: '#8B5CF6'
};

// ----------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------

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
             backgroundColor: 'rgba(5,3,10,0.85)',
             backdropFilter: 'blur(12px)',
             border: `1px solid rgba(108,76,255,0.4)`,
             willChange: 'opacity',
           }}
           animate={{ opacity: [0.85, 1, 0.85] }}
           transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: isLeft ? 0 : 2 }}
         >
            <img src={waslLogo} alt="WASL" className="w-24 md:w-32 opacity-90 drop-shadow-[0_0_15px_rgba(108,76,255,0.6)]" />
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
         <div className="w-40 md:w-72 h-64 md:h-96 rounded-2xl flex flex-col items-center justify-center relative" style={{ backgroundColor: 'rgba(108,76,255,0.1)' }}>
            <img src={waslLogo} alt="WASL" className="w-24 md:w-32 opacity-30" />
         </div>
      </div>
    </div>
  );
};

const BankTile = ({ logo, alt, compact = false }: { logo: string; alt: string; compact?: boolean }) => (
  <div
    className={`${compact ? 'w-[82%] h-[80%]' : 'w-[78%] h-[68%]'} rounded-md flex items-center justify-center relative overflow-hidden`}
    style={{
      background: 'linear-gradient(155deg, rgba(20,16,38,0.9) 0%, rgba(12,9,24,0.95) 100%)',
      border: '1px solid rgba(108,76,255,0.35)',
      boxShadow: 'inset 0 0 10px rgba(108,76,255,0.12), 0 0 10px rgba(0,0,0,0.35)',
    }}
  >
    <div
      className="absolute inset-0 opacity-60"
      style={{ background: 'radial-gradient(circle at 30% 20%, rgba(108,76,255,0.18), transparent 60%)' }}
    />
    <img
      src={logo}
      alt={alt}
      className={`relative z-10 ${compact ? 'w-[80%] h-[80%]' : 'w-[82%] h-[82%]'} object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]`}
    />
  </div>
);

const CubeFace = ({ rx = 0, ry = 0, isTop = false, isBottom = false, stage, cubeSize }: { rx?: number, ry?: number, isTop?: boolean, isBottom?: boolean, stage: number, cubeSize: number }) => {
  const H_SIZE = cubeSize / 2;
  const explodeOffset = stage >= 3 ? 600 : 0;
  const opacity = stage >= 3 ? 0 : 0.95;
  
  return (
    <motion.div 
      className="absolute left-0 top-0 flex items-center justify-center"
      initial={false}
      animate={{
        opacity,
        transform: `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${H_SIZE + explodeOffset}px)`
      }}
      transition={{ duration: stage >= 3 ? 0.7 : 0.3, ease: stage >= 3 ? "easeOut" : "linear" }}
      style={{ 
        width: cubeSize, 
        height: cubeSize, 
        backgroundColor: '#0A0714',
        border: `1px solid rgba(108, 76, 255, 0.6)`,
        boxShadow: `inset 0 0 20px rgba(108, 76, 255, 0.3), 0 0 12px rgba(108, 76, 255, 0.25)`,
        backfaceVisibility: 'hidden',
        willChange: 'transform, opacity',
      }}
    >
      {isTop ? (
        <img src={waslLogo} alt="WASL" className="w-[65%] h-[65%] object-contain drop-shadow-[0_0_15px_rgba(108,76,255,0.8)]" />
      ) : isBottom ? (
        <div className="w-full h-full bg-[#0A0714]" />
      ) : (
        <div className="w-full h-full grid grid-cols-2 grid-rows-2">
          {/* Upper-Left: Alrajhi */}
          <div className="flex items-center justify-center border-r border-b border-[rgba(108,76,255,0.3)] p-2">
            <BankTile logo={alrajhiLogo} alt="Alrajhi" />
          </div>
          {/* Upper-Right: SNB */}
          <div className="flex items-center justify-center border-b border-[rgba(108,76,255,0.3)] p-2">
            <BankTile logo={snbLogo} alt="SNB" />
          </div>
          {/* Lower-Left: Riyad */}
          <div className="flex items-center justify-center border-r border-[rgba(108,76,255,0.3)] p-2">
            <BankTile logo={riyadLogo} alt="Riyad" />
          </div>
          {/* Lower-Right: Split Alinma & BSF */}
          <div className="flex flex-col p-2 gap-1">
            <div className="flex-1 flex items-center justify-center border-b border-[rgba(108,76,255,0.3)] pb-1">
              <BankTile logo={alinmaLogo} alt="Alinma" compact />
            </div>
            <div className="flex-1 flex items-center justify-center pt-1">
              <BankTile logo={bsfLogo} alt="BSF" compact />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const CubeSpin = ({ stage, cubeSize }: { stage: number, cubeSize: number }) => (
  <motion.div
    className="absolute inset-0 preserve-3d"
    animate={stage >= 1 ? { rotateY: 0 } : { rotateY: [0, 360] }}
    transition={stage >= 1 ? { duration: 0.8, ease: "easeOut" } : { duration: 24, repeat: Infinity, ease: "linear" }}
  >
    <CubeFace stage={stage} cubeSize={cubeSize} ry={0} />
    <CubeFace stage={stage} cubeSize={cubeSize} ry={180} />
    <CubeFace stage={stage} cubeSize={cubeSize} ry={90} />
    <CubeFace stage={stage} cubeSize={cubeSize} ry={-90} />
    <CubeFace stage={stage} cubeSize={cubeSize} rx={-90} isBottom />
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
            borderColor: 'rgba(108,76,255,0.5)',
            boxShadow: '0 0 20px rgba(108,76,255,0.4) inset, 0 0 20px rgba(108,76,255,0.4)'
          }}
          animate={{ 
            rotateZ: [0, 360 * (ring % 2 === 0 ? -1 : 1)],
            scale: isExploding ? 4 : [1, 1.05, 1],
            opacity: isExploding ? 0 : [0.2, 0.6, 0.2]
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
        <img src={waslLogo} alt="WASL AI Hub" className="relative w-full drop-shadow-[0_0_8px_rgba(108,76,255,0.8)]" />
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
          style={{ filter: `drop-shadow(0 0 5px rgba(108,76,255,0.8))` }}
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
  const [bgFailed, setBgFailed] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onerror = () => setBgFailed(true);
    img.src = bgImage;
  }, []);

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
        const entryPath = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
        if (window.location.pathname === entryPath || window.location.pathname === entryPath + '/') {
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
        {/* Background Image - Cinematic Glass Corridor */}
        <div 
          className="absolute w-[250vw] h-[250vh] left-[-125vw] top-[-125vh] bg-cover bg-center" 
          style={{ 
            backgroundImage: bgFailed
              ? `radial-gradient(circle at 50% 30%, rgba(108,76,255,0.18), ${COLORS.bg} 70%)`
              : `url(${bgImage})`,
            transform: 'translateZ(-1500px)',
            opacity: 0.9 
          }} 
        />

        {/* Reflective Dark Floor */}
        <div 
          className="absolute pointer-events-none"
          style={{
            width: '300vw',
            height: '200vh',
            left: '-150vw',
            top: '-100vh',
            background: `linear-gradient(to top, ${COLORS.bg} 20%, rgba(108,76,255,0.05) 100%)`,
            transform: 'translateY(40vh) rotateX(80deg) translateZ(-500px)',
            transformStyle: 'preserve-3d'
          }}
        />

        {/* Illuminated Glass Panels on Walls */}
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
                style={{ transform: `translateY(${cubeSize + 80}px) scaleY(-1)`, filter: 'blur(8px)' }}
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
                    backgroundColor: COLORS.violet, 
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
        style={{ backgroundColor: COLORS.violet }}
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
