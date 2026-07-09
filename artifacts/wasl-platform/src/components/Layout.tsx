import React, { Suspense, lazy } from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Settings } from 'lucide-react';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';
import { cn } from '@/lib/utils';
import { AnimatedBackground } from './AnimatedBackground';

// Loaded lazily and behind its own error boundary: if the three.js/WebGL
// stack fails to load or mount on a given browser, it must never be able to
// block the rest of the app (sidebar nav, dashboard, etc.) from rendering.
const CUBE_SIZE = 240;
const RotatingCube = lazy(() =>
  import('./RotatingCube').then((m) => ({ default: m.RotatingCube })).catch(() => ({
    default: () => (
      <div
        style={{ width: CUBE_SIZE + 40, height: CUBE_SIZE + 40 }}
        className="mx-auto flex items-center justify-center rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl"
      >
        <img src={logoUrl} alt="Wasl" className="w-1/2 h-auto opacity-70" />
      </div>
    ),
  }))
);

function CubeSlotFallback() {
  return (
    <div
      style={{ width: CUBE_SIZE + 40, height: CUBE_SIZE + 40 }}
      className="mx-auto flex items-center justify-center rounded-3xl bg-white/5 border border-white/10 animate-pulse"
    />
  );
}

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: '/portfolio', icon: LayoutDashboard, label: 'لوحة القيادة (Dashboard)' },
  { href: '/settings', icon: Settings, label: 'الإعدادات (Settings)' },
];

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] w-full text-foreground bg-background font-sans flex" dir="rtl">
      <AnimatedBackground />

      {/* Brand watermark, present behind all page content */}
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none fixed bottom-[-6%] left-[-4%] w-[38rem] max-w-[60vw] opacity-[0.05] z-0"
      />

      {/* Sidebar. Hierarchy: logo -> nav -> rotating cube (only one Wasl
          logo lives in the sidebar; the cube widget replaces what used to
          be a second, large logo card). */}
      <aside className="relative z-20 w-72 glass-panel border-l border-r-0 flex flex-col items-center py-8 px-4 gap-8 overflow-hidden">
        <div className="w-full flex items-center justify-center shrink-0">
          <img src={logoUrl} alt="Wasl" className="w-48 h-auto drop-shadow-lg" />
        </div>

        <nav className="w-full flex flex-col gap-3 shrink-0">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl transition-all cursor-pointer",
                  isActive 
                    ? "bg-primary/20 text-white border border-primary/30 shadow-[0_0_15px_rgba(124,58,237,0.2)]" 
                    : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
                )}>
                  <Icon className="w-5 h-5" />
                  <span className="font-semibold text-[15px]">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Remaining space: cube centered vertically, empty spacing above/below. */}
        <div className="flex-1 w-full min-h-0 flex items-center justify-center">
          <Suspense fallback={<CubeSlotFallback />}>
            <RotatingCube size={CUBE_SIZE} glass />
          </Suspense>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col h-[100dvh] overflow-y-auto hide-scrollbar">
        {children}
      </main>
    </div>
  );
}
