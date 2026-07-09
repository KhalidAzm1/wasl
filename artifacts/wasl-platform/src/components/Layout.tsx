import React from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Settings } from 'lucide-react';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';
import { cn } from '@/lib/utils';
import { AnimatedBackground } from './AnimatedBackground';

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

      {/* Sidebar. Hierarchy: logo -> nav -> empty space. Only one Wasl logo
          lives in the sidebar (top); per explicit user direction, no cube
          widget or second logo card fills the remaining space below nav. */}
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

        {/* Remaining space intentionally left empty. */}
        <div className="flex-1 w-full min-h-0" />
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col h-[100dvh] overflow-y-auto hide-scrollbar">
        {children}
      </main>
    </div>
  );
}
