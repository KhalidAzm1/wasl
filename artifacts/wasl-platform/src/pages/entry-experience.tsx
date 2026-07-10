import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';

import snbLogo from '@assets/wasl_brand/bank_cube/snb.png';
import alrajhiLogo from '@assets/wasl_brand/bank_cube/alrajhi.png';
import riyadLogo from '@assets/wasl_brand/bank_cube/riyad.png';
import alinmaLogo from '@assets/wasl_brand/bank_cube/alinma.png';
import bsfLogo from '@assets/wasl_brand/bank_cube/bsf.png';
import waslLogo from '@assets/wasl_brand/wasl_logo_2026.png';

export default function EntryExperience() {
  const [, navigate] = useLocation();
  const [entering, setEntering] = useState(false);
  const navigateTimeoutRef = useRef<number | null>(null);
  const [cubeSize, setCubeSize] = useState(180);

  useEffect(() => {
    const handleResize = () => {
      setCubeSize(window.innerWidth < 768 ? 140 : 180);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (navigateTimeoutRef.current !== null) {
        window.clearTimeout(navigateTimeoutRef.current);
      }
    };
  }, []);

  const H_SIZE = cubeSize / 2;

  const handleEnter = () => {
    if (entering) return;
    setEntering(true);
    // Smooth transition to dashboard takes 700-1000ms
    navigateTimeoutRef.current = window.setTimeout(() => navigate('/portfolio'), 900);
  };

  const CubeFace = ({ transform, img, isTop = false }: { transform: string; img: string; isTop?: boolean }) => (
    <div 
      className="absolute left-0 top-0 flex items-center justify-center border border-blue-400/30 bg-blue-950/20 backdrop-blur-[2px]"
      style={{ 
        width: cubeSize, 
        height: cubeSize, 
        transform, 
        boxShadow: 'inset 0 0 30px rgba(59,130,246,0.3), 0 0 15px rgba(59,130,246,0.3)',
        backfaceVisibility: 'visible',
      }}
    >
      <img src={img} alt="Logo" className={`w-[65%] h-[65%] object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.7)] ${isTop ? 'opacity-90' : 'opacity-100'}`} />
    </div>
  );

  const CubeSpin = () => (
    <motion.div
      className="absolute inset-0 preserve-3d"
      animate={{ rotateY: [0, 360] }}
      transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
    >
      <CubeFace transform={`rotateY(0deg) translateZ(${H_SIZE}px)`} img={snbLogo} />
      <CubeFace transform={`rotateY(180deg) translateZ(${H_SIZE}px)`} img={riyadLogo} />
      <CubeFace transform={`rotateY(90deg) translateZ(${H_SIZE}px)`} img={alrajhiLogo} />
      <CubeFace transform={`rotateY(-90deg) translateZ(${H_SIZE}px)`} img={alinmaLogo} />
      <CubeFace transform={`rotateX(90deg) translateZ(${H_SIZE}px)`} img={waslLogo} isTop />
      <CubeFace transform={`rotateX(-90deg) translateZ(${H_SIZE}px)`} img={bsfLogo} />
    </motion.div>
  );

  const HoverParticles = () => {
    const pData = useMemo(() => Array.from({ length: 15 }).map(() => ({
      xOff: (Math.random() - 0.5) * 350,
      yOff: (Math.random() - 0.5) * 350,
      zOff: (Math.random() - 0.5) * 350,
      dur: 1 + Math.random()
    })), []);
    
    return (
      <div className="absolute inset-0 pointer-events-none preserve-3d">
        {pData.map((p, i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-300 rounded-full shadow-[0_0_10px_#60a5fa]"
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

  const WallPanel = ({ side }: { side: 'left' | 'right' }) => {
    const isLeft = side === 'left';
    const isMobile = window.innerWidth < 768;
    const xOffset = isLeft ? (isMobile ? -200 : -500) : (isMobile ? 200 : 500);
    const rotateY = isLeft ? 60 : -60;
    
    return (
      <div className="absolute preserve-3d pointer-events-none">
        <div 
          className="absolute flex flex-col items-center justify-center preserve-3d"
          style={{ transform: `translate3d(${xOffset}px, -150px, -200px) rotateY(${rotateY}deg)` }}
        >
           <motion.div
             className="w-40 md:w-64 h-64 md:h-96 bg-blue-900/10 backdrop-blur-md border border-blue-400/20 rounded-2xl flex items-center justify-center overflow-hidden relative"
             animate={{ 
               boxShadow: [
                 '0 0 20px rgba(59,130,246,0.1), inset 0 0 10px rgba(59,130,246,0.1)', 
                 '0 0 50px rgba(59,130,246,0.3), inset 0 0 30px rgba(59,130,246,0.3)', 
                 '0 0 20px rgba(59,130,246,0.1), inset 0 0 10px rgba(59,130,246,0.1)'
               ] 
             }}
             transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: isLeft ? 0 : 2 }}
           >
              <img src={waslLogo} alt="WASL" className="w-24 md:w-32 opacity-80 filter drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
              
              {/* Breathing light scan animation */}
              <motion.div 
                className="absolute left-0 w-full h-[2px] bg-blue-300 shadow-[0_0_10px_rgba(59,130,246,1)]"
                animate={{ top: ['-10%', '110%', '-10%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: isLeft ? 0 : 1.5 }}
              />
           </motion.div>
        </div>

        {/* Floor reflection of the wall panel */}
        <div 
          className="absolute flex flex-col items-center justify-center preserve-3d"
          style={{ 
            transform: `translate3d(${xOffset}px, 200px, -200px) rotateY(${rotateY}deg) scaleY(-1)`,
            filter: 'blur(15px)',
            opacity: 0.3
          }}
        >
           <div className="w-40 md:w-64 h-64 md:h-96 bg-blue-500/10 rounded-2xl flex items-center justify-center relative">
              <img src={waslLogo} alt="WASL" className="w-24 md:w-32 opacity-50" />
           </div>
        </div>
      </div>
    );
  };

  const CubeContainer = () => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div className="absolute preserve-3d pointer-events-none">
        <motion.div
          className="preserve-3d"
          animate={{ y: [-15, 15, -15] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div style={{ transform: 'rotateX(-15deg)', transformStyle: 'preserve-3d' }}>
            
            {/* Floor Reflection of the rotating cube */}
            <motion.div 
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 preserve-3d"
              style={{ transform: `translateY(${cubeSize + 60}px) scaleY(-1)`, filter: 'blur(12px)' }}
              animate={{ opacity: entering ? 0 : (isHovered ? 0.6 : 0.3) }}
              transition={{ duration: 0.5 }}
            >
              <div style={{ width: cubeSize, height: cubeSize, left: -H_SIZE, top: -H_SIZE }} className="absolute preserve-3d">
                <CubeSpin />
              </div>
            </motion.div>

            {/* The Actual Center Cube */}
            <motion.div 
              className="absolute pointer-events-auto cursor-pointer"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={handleEnter}
              style={{ width: cubeSize, height: cubeSize, left: -H_SIZE, top: -H_SIZE, transformStyle: 'preserve-3d' }}
              animate={entering ? { scale: 3, opacity: 0 } : { scale: isHovered ? 1.05 : 1 }}
              transition={{ duration: entering ? 0.8 : 0.4 }}
            >
              <AnimatePresence>
                {isHovered && !entering && <HoverParticles />}
              </AnimatePresence>

              <CubeSpin />

              {/* Internal core glow (non-rotating) */}
              <motion.div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400 pointer-events-none"
                style={{ width: cubeSize * 0.7, height: cubeSize * 0.7, transform: 'translateZ(0px)', filter: 'blur(40px)' }}
                animate={{ opacity: entering ? 1 : (isHovered ? 0.8 : 0.5) }}
                transition={{ duration: 0.4 }}
              />

              {/* External Hover/Intensified Glow */}
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400 pointer-events-none"
                style={{ width: '150%', height: '150%', filter: 'blur(60px)', transform: 'translateZ(-1px)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: entering ? 1 : (isHovered ? 0.7 : 0) }}
                transition={{ duration: entering ? 0.8 : 0.4 }}
              />
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  };

  const EnvParticles = () => {
    const particles = useMemo(() => Array.from({ length: 50 }).map(() => ({
      x: (Math.random() - 0.5) * 2000,
      y: (Math.random() - 0.5) * 1000,
      z: (Math.random() - 0.5) * 1000,
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
              boxShadow: '0 0 10px rgba(59,130,246,0.8)',
            }}
            initial={{ x: p.x, y: p.y, z: p.z, opacity: 0 }}
            animate={{ 
              y: p.y - 800,
              opacity: [0, 0.6, 0] 
            }}
            transition={{ duration: p.duration, repeat: Infinity, ease: 'linear', delay: p.delay }}
          />
        ))}
      </div>
    );
  };

  return (
    <div 
      className="relative h-[100dvh] w-screen overflow-hidden text-white bg-[#02040A]" 
      style={{ perspective: '1200px' }}
      dir="ltr"
    >
      <style>{`
        @keyframes sweep {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
      `}</style>
      
      {/* 3D Scene Root - Camera Movement Wrapper */}
      <motion.div
        className="absolute preserve-3d pointer-events-none"
        style={{ left: '50%', top: '50%' }}
        animate={
          entering 
          ? { scale: 2.5, translateZ: 600 } 
          : { rotateX: [-2, 2, -2], rotateY: [-3, 3, -3], scale: 1, translateZ: 0 }
        }
        transition={
          entering
          ? { duration: 1, ease: "easeIn" }
          : { duration: 15, repeat: Infinity, ease: "easeInOut" }
        }
      >
        {/* Ambient Volumetric Glow */}
        <div className="absolute w-[200vw] h-[200vh] left-[-100vw] top-[-100vh] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0%,transparent_50%)] transform translateZ(-800px)" />

        {/* Floating dust particles */}
        <EnvParticles />

        {/* Reflective Dark Floor */}
        <div 
          className="absolute"
          style={{
            width: '300vw',
            height: '200vh',
            left: '-150vw',
            top: '-100vh',
            background: 'linear-gradient(to top, #02040A 20%, rgba(59,130,246,0.08) 100%)',
            transform: 'translateY(30vh) rotateX(80deg) translateZ(-500px)',
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Light reflections / Grid on the floor */}
          <div 
            className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.15)_1px,transparent_1px)] bg-[size:60px_60px] opacity-40" 
            style={{ WebkitMaskImage: 'linear-gradient(to top, black 10%, transparent 80%)', maskImage: 'linear-gradient(to top, black 10%, transparent 80%)' }}
          />
        </div>

        {/* Illuminated Glass Panels on Walls */}
        <WallPanel side="left" />
        <WallPanel side="right" />

        {/* Center Glowing Rotating Cube */}
        <CubeContainer />
      </motion.div>

      {/* Cinematic Fade out transition mask */}
      <motion.div
        className="absolute inset-0 bg-[#02040A] z-40 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: entering ? 1 : 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      />

      {/* Futuristic Main Button */}
      <motion.div
        className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
        animate={{ opacity: entering ? 0 : 1, y: entering ? 40 : 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.button
          onClick={handleEnter}
          disabled={entering}
          className="group relative flex items-center justify-center w-72 md:w-80 h-16 md:h-20 rounded-[2rem] border border-blue-400/30 bg-blue-950/30 backdrop-blur-xl overflow-hidden cursor-pointer"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{ boxShadow: '0 0 25px rgba(59,130,246,0.2), inset 0 0 15px rgba(59,130,246,0.1)' }}
        >
          {/* Hover Glow */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2rem] shadow-[0_0_40px_rgba(59,130,246,0.5)_inset]" />
          
          {/* Light Sweep Animation */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-blue-300/40 to-transparent skew-x-[30deg] animate-[sweep_2s_ease-in-out_infinite]" />
          </div>

          {/* Button Text */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            <span className="text-white font-bold tracking-[0.15em] text-sm md:text-base drop-shadow-md">ENTER WASL AI HUB</span>
          </div>
          
          {/* Subtle Inner Light Bottom Edge */}
          <div className="absolute bottom-0 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-blue-400/80 to-transparent shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
        </motion.button>
      </motion.div>
    </div>
  );
}
