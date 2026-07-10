import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Building2, Wallet, TrendingUp, Shield, Activity, Database, Fingerprint } from 'lucide-react';

// Images
import snbLogo from '@assets/wasl_brand/bank_cube/snb.png';
import alrajhiLogo from '@assets/wasl_brand/bank_cube/alrajhi.png';
import riyadLogo from '@assets/wasl_brand/bank_cube/riyad.png';
import alinmaLogo from '@assets/wasl_brand/bank_cube/alinma.png';
import bsfLogo from '@assets/wasl_brand/bank_cube/bsf.png';
import waslLogo from '@assets/wasl_brand/wasl_logo_2026.png';

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
            className="absolute left-1/2 top-1/2 text-blue-500/20"
            style={{ width: p.size, height: p.size, x: p.x, z: p.z }}
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
          className="absolute left-1/2 top-1/2 bg-gradient-to-b from-transparent via-blue-400/40 to-transparent w-[1px]"
          style={{ x: s.x, z: s.z, height: s.height }}
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
          className="absolute left-1/2 top-1/2 rounded-full bg-blue-300"
          style={{
            width: p.size,
            height: p.size,
            boxShadow: '0 0 12px rgba(59,130,246,0.8)',
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
  const pData = useMemo(() => Array.from({ length: 30 }).map(() => ({
    xOff: (Math.random() - 0.5) * 450,
    yOff: (Math.random() - 0.5) * 450,
    zOff: (Math.random() - 0.5) * 450,
    dur: 0.8 + Math.random() * 1.5
  })), []);
  
  return (
    <div className="absolute inset-0 pointer-events-none preserve-3d">
      {pData.map((p, i) => (
        <motion.div
          key={i}
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-blue-200 rounded-full shadow-[0_0_12px_#93c5fd]"
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
  const xOffset = isLeft ? (isMobile ? -220 : -550) : (isMobile ? 220 : 550);
  const rotateY = isLeft ? 60 : -60;
  
  return (
    <div className="absolute preserve-3d pointer-events-none">
      <div 
        className="absolute flex flex-col items-center justify-center preserve-3d"
        style={{ transform: `translate3d(${xOffset}px, -150px, -250px) rotateY(${rotateY}deg)` }}
      >
         <motion.div
           className="w-40 md:w-64 h-64 md:h-96 bg-blue-900/10 backdrop-blur-md border border-blue-400/20 rounded-2xl flex items-center justify-center overflow-hidden relative"
           animate={{ 
             boxShadow: [
               '0 0 20px rgba(59,130,246,0.1), inset 0 0 10px rgba(59,130,246,0.1)', 
               '0 0 60px rgba(59,130,246,0.3), inset 0 0 30px rgba(59,130,246,0.3)', 
               '0 0 20px rgba(59,130,246,0.1), inset 0 0 10px rgba(59,130,246,0.1)'
             ] 
           }}
           transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: isLeft ? 0 : 2 }}
         >
            <img src={waslLogo} alt="WASL" className="w-24 md:w-32 opacity-60 filter drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] grayscale" />
            
            <motion.div 
              className="absolute left-0 w-full h-[2px] bg-blue-400 shadow-[0_0_15px_rgba(59,130,246,1)]"
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
         <div className="w-40 md:w-64 h-64 md:h-96 bg-blue-500/10 rounded-2xl flex items-center justify-center relative">
            <img src={waslLogo} alt="WASL" className="w-24 md:w-32 opacity-30 grayscale" />
         </div>
      </div>
    </div>
  );
};

const CubeFace = ({ rx = 0, ry = 0, img, isTop = false, stage, cubeSize }: { rx?: number, ry?: number, img: string, isTop?: boolean, stage: number, cubeSize: number }) => {
  const H_SIZE = cubeSize / 2;
  const explodeOffset = stage >= 3 ? 600 : 0;
  const opacity = stage >= 3 ? 0 : (isTop ? 0.9 : 1);
  
  return (
    <motion.div 
      className="absolute left-0 top-0 flex items-center justify-center border border-blue-400/40 bg-[#061224]/70 backdrop-blur-[4px]"
      initial={false}
      animate={{
        opacity,
        transform: `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${H_SIZE + explodeOffset}px)`
      }}
      transition={{ duration: stage >= 3 ? 0.7 : 0.3, ease: stage >= 3 ? "easeOut" : "linear" }}
      style={{ 
        width: cubeSize, 
        height: cubeSize, 
        boxShadow: 'inset 0 0 40px rgba(59,130,246,0.4), 0 0 20px rgba(59,130,246,0.3)',
        backfaceVisibility: 'visible',
      }}
    >
      <img src={img} alt="Bank Logo" className="w-[65%] h-[65%] object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]" />
    </motion.div>
  );
};

const CubeSpin = ({ stage, cubeSize }: { stage: number, cubeSize: number }) => (
  <motion.div
    className="absolute inset-0 preserve-3d"
    animate={{ rotateY: [0, 360] }}
    transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
  >
    <CubeFace stage={stage} cubeSize={cubeSize} ry={0} img={snbLogo} />
    <CubeFace stage={stage} cubeSize={cubeSize} ry={180} img={riyadLogo} />
    <CubeFace stage={stage} cubeSize={cubeSize} ry={90} img={alrajhiLogo} />
    <CubeFace stage={stage} cubeSize={cubeSize} ry={-90} img={alinmaLogo} />
    <CubeFace stage={stage} cubeSize={cubeSize} rx={90} img={waslLogo} isTop />
    <CubeFace stage={stage} cubeSize={cubeSize} rx={-90} img={bsfLogo} />
  </motion.div>
);

const EnergyRings = ({ stage }: { stage: number }) => {
  const isExploding = stage >= 3;
  return (
    <div 
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 preserve-3d pointer-events-none"
      style={{ transform: `translateY(280px) rotateX(90deg)` }}
    >
      {[1, 2, 3].map((ring) => (
        <motion.div
          key={ring}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2px] border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.3)_inset,0_0_15px_rgba(59,130,246,0.3)]"
          style={{ width: ring * 140, height: ring * 140 }}
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

const WaslHeader = ({ stage }: { stage: number }) => {
  const isExploding = stage >= 3;
  return (
    <motion.div 
      className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
      style={{ top: '-180px', transform: 'translateZ(0px)' }}
      animate={{ opacity: isExploding ? 0 : 1, y: isExploding ? -100 : 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative mb-2 w-48 md:w-64 flex justify-center">
        <motion.img 
          src={waslLogo} 
          alt="" 
          className="absolute w-full blur-[12px] filter brightness-150"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <img src={waslLogo} alt="WASL AI Hub" className="relative w-full drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
      </div>
      
      <svg className="w-32 h-20 opacity-80" viewBox="0 0 128 80">
        <motion.path 
          d="M64 0 L64 30 L20 50 L20 80 M64 30 L108 50 L108 80 M64 0 L64 80"
          fill="none"
          stroke="#60a5fa"
          strokeWidth="2"
          strokeDasharray="200"
          animate={{ strokeDashoffset: [200, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          style={{ filter: 'drop-shadow(0 0 5px rgba(59,130,246,0.8))' }}
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
  const [cubeSize, setCubeSize] = useState(180);
  const [isHovered, setIsHovered] = useState(false);

  const clearStageTimeouts = () => {
    stageTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    stageTimeoutsRef.current = [];
  };

  useEffect(() => {
    const handleResize = () => {
      setCubeSize(window.innerWidth < 768 ? 140 : 180);
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
    setEntryStage(1); // Click -> Glow stronger

    const schedule = (fn: () => void, delay: number) => {
      const id = window.setTimeout(fn, delay);
      stageTimeoutsRef.current.push(id);
      return id;
    };

    schedule(() => setEntryStage(2), 200);  // Zoom towards cube
    schedule(() => setEntryStage(3), 700);  // Explode cube faces
    schedule(() => setEntryStage(4), 1000); // Blue flash mask
    schedule(() => {
      // Fail-safe: if routing doesn't happen right away (e.g. router hiccup),
      // reset the scene instead of leaving an opaque flash frozen on screen.
      const fallback = schedule(() => setEntryStage(0), 900);
      navigate('/portfolio');
      window.clearTimeout(fallback);
      stageTimeoutsRef.current = stageTimeoutsRef.current.filter((id) => id !== fallback);
    }, 1400); // Final route change
  };

  const H_SIZE = cubeSize / 2;
  const coreScale = entryStage >= 3 ? 4 : (entryStage >= 1 ? 1.4 : (isHovered ? 1.2 : 0.8));
  const auraOpacity = entryStage >= 4 ? 0 : (entryStage >= 1 ? 1 : (isHovered ? 0.8 : 0));

  return (
    <div 
      className="relative h-[100dvh] w-screen overflow-hidden text-white bg-[#010308]" 
      style={{ perspective: '1000px' }}
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
        <div className="absolute w-[250vw] h-[250vh] left-[-125vw] top-[-125vh] bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.12)_0%,transparent_50%)] transform translateZ(-1000px)" />

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
            background: 'linear-gradient(to top, #010308 20%, rgba(37,99,235,0.05) 100%)',
            transform: 'translateY(30vh) rotateX(80deg) translateZ(-500px)',
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Light reflections / Grid on the floor */}
          <div 
            className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.15)_1px,transparent_1px)] bg-[size:80px_80px] opacity-40" 
            style={{ WebkitMaskImage: 'linear-gradient(to top, black 10%, transparent 80%)', maskImage: 'linear-gradient(to top, black 10%, transparent 80%)' }}
          />
        </div>

        {/* Illuminated Glass Panels on Walls */}
        <WallPanel side="left" isMobile={cubeSize <= 140} />
        <WallPanel side="right" isMobile={cubeSize <= 140} />

        {/* Center Glowing Rotating Cube Container */}
        <div className="absolute preserve-3d pointer-events-none">
          <motion.div
            className="preserve-3d"
            animate={{ y: entryStage >= 2 ? 0 : [-12, 12, -12] }}
            transition={{ duration: 6, repeat: entryStage >= 2 ? 0 : Infinity, ease: "easeInOut" }}
          >
            <div style={{ transform: 'rotateX(-15deg)', transformStyle: 'preserve-3d' }}>
              
              <WaslHeader stage={entryStage} />
              <EnergyRings stage={entryStage} />

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
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-300 pointer-events-none"
                  style={{ width: cubeSize * 0.8, height: cubeSize * 0.8, transform: 'translateZ(0px)', filter: 'blur(35px)' }}
                  animate={{ opacity: auraOpacity, scale: coreScale }}
                  transition={{ duration: 0.4 }}
                />

                {/* External Hover/Intensified Glow */}
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 pointer-events-none"
                  style={{ width: '150%', height: '150%', filter: 'blur(50px)', transform: 'translateZ(-1px)' }}
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
        className="absolute inset-0 bg-blue-400 z-50 pointer-events-none mix-blend-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: entryStage >= 4 ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="absolute inset-0 bg-[#010308] z-40 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: entryStage >= 4 ? 1 : 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      />
    </div>
  );
}
