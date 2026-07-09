import React from 'react';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';

/**
 * Pure-CSS architectural backdrop recreating the reference image's
 * "executive glass headquarters" composition: outer glass wall panels with
 * signage, a converging tunnel of glowing door frames leading to the cube,
 * and a soft floor reflection glow. Sits behind the transparent-background
 * 3D cube canvas so the two composite into one scene.
 *
 * This is deliberately built in CSS/DOM (not three.js) because the
 * architecture only needs to be an exact, pixel-controllable match to a
 * static reference photo — the only element the brief requires to be real
 * 3D is the cube itself, which lives in `VaultScene`.
 */
export function VaultHallwayBackdrop({ entering = false }: { entering?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden select-none pointer-events-none">
      {/* base gradient: dark navy glass tower interior */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#0d0f22_0%,#050614_55%,#020208_100%)]" />

      {/* Outer left wall panel */}
      <div
        className="absolute top-0 bottom-0 left-0 w-[10%] min-w-[70px] border-r border-primary/20 transition-transform duration-[1400ms] ease-out"
        style={{
          background: 'linear-gradient(120deg, rgba(10,10,22,0.9), rgba(10,10,26,0.5) 60%, transparent)',
          transform: entering ? 'translateX(-40%)' : 'translateX(0)',
          opacity: entering ? 0 : 1,
        }}
      >
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/70 to-transparent shadow-[0_0_20px_4px_rgba(124,58,237,0.5)]" />
        <div className="absolute left-1/2 top-[38%] -translate-x-1/2 flex flex-col items-center gap-1 opacity-70">
          <img src={logoUrl} alt="" className="w-8 h-auto opacity-80" />
        </div>
      </div>

      {/* Outer right wall panel */}
      <div
        className="absolute top-0 bottom-0 right-0 w-[10%] min-w-[70px] border-l border-blue-400/20 transition-transform duration-[1400ms] ease-out"
        style={{
          background: 'linear-gradient(240deg, rgba(10,10,22,0.9), rgba(10,10,26,0.5) 60%, transparent)',
          transform: entering ? 'translateX(40%)' : 'translateX(0)',
          opacity: entering ? 0 : 1,
        }}
      >
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-blue-400/70 to-transparent shadow-[0_0_20px_4px_rgba(59,130,246,0.5)]" />
        <div className="absolute left-1/2 top-[38%] -translate-x-1/2 flex flex-col items-center gap-2 opacity-70 w-24 text-center">
          <img src={logoUrl} alt="" className="w-8 h-auto opacity-80" />
          <p className="text-white/40 text-[9px] leading-tight">
            نربط الفرص
            <br />
            نصنع المستقبل
          </p>
        </div>
      </div>

      {/* Converging tunnel of glowing door frames leading toward the cube */}
      <div className="absolute inset-x-0 top-[14%] bottom-[24%] flex items-center justify-center">
        {[
          { w: 78, h: 92, color: 'rgba(124,58,237,0.35)', delay: '0ms' },
          { w: 60, h: 74, color: 'rgba(59,130,246,0.32)', delay: '60ms' },
          { w: 42, h: 54, color: 'rgba(124,58,237,0.4)', delay: '120ms' },
        ].map((frame, i) => (
          <div
            key={i}
            className="absolute rounded-[2.5rem] border transition-all ease-out"
            style={{
              width: `${frame.w}%`,
              height: `${frame.h}%`,
              maxWidth: 760 - i * 110,
              maxHeight: 460 - i * 65,
              borderColor: frame.color,
              boxShadow: `0 0 40px ${frame.color}, inset 0 0 60px rgba(0,0,0,0.4)`,
              transitionDuration: '1300ms',
              transitionDelay: frame.delay,
              transform: entering ? `scale(${1 + (i + 1) * 0.9})` : 'scale(1)',
              opacity: entering ? 0 : 1,
            }}
          />
        ))}
      </div>

      {/* Floor: reflective gradient with a glow pooling under the cube */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[38%]"
        style={{
          background:
            'linear-gradient(to top, rgba(8,8,20,0.95), rgba(8,8,24,0.5) 40%, transparent), radial-gradient(ellipse 45% 60% at 50% 0%, rgba(124,58,237,0.25), transparent 70%)',
        }}
      />
      <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-[46%] max-w-[520px] h-24 rounded-[50%] bg-primary/25 blur-3xl" />

      {/* Ambient vertical light rays */}
      <div className="absolute inset-0 opacity-30" style={{ background: 'repeating-linear-gradient(100deg, transparent 0px, transparent 60px, rgba(124,58,237,0.05) 61px, transparent 130px)' }} />
    </div>
  );
}
