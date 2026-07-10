import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Settings, Menu, X, Users } from 'lucide-react';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';
import { cn } from '@/lib/utils';
import { AnimatedBackground } from './AnimatedBackground';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: '/portfolio', icon: LayoutDashboard, label: 'لوحة القيادة (Dashboard)' },
  { href: '/admin/users', icon: Users, label: 'إدارة المستخدمين' },
  { href: '/settings', icon: Settings, label: 'الإعدادات (Settings)' },
];

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer on route change so it never lingers open.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location]);

  return (
    <div className="min-h-[100dvh] w-full text-foreground bg-background font-sans flex overflow-x-hidden" dir="rtl">
      <AnimatedBackground />

      {/* Brand watermark, present behind all page content */}
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        className="no-mirror pointer-events-none select-none fixed bottom-[-6%] left-[-4%] w-[38rem] max-w-[60vw] opacity-[0.05] z-0"
      />

      {/* Mobile-only top bar: hamburger toggle for the drawer sidebar. Sits
          above safe-area insets (notch / Dynamic Island). */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 safe-area-top flex items-center justify-between px-4 py-3 bg-background/85 backdrop-blur-xl border-b border-white/5">
        <img src={logoUrl} alt="Wasl" className="no-mirror h-8 w-auto" />
        <button
          type="button"
          aria-label={drawerOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          onClick={() => setDrawerOpen((v) => !v)}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop, mobile drawer mode only. */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar. Hierarchy: logo -> nav -> empty space. Only one Wasl logo
          lives in the sidebar (top); no cube widget or second logo card
          fills the remaining space below nav.
          Responsive behavior:
          - Desktop (xl, >=1280px): static 340px panel, always visible.
          - Tablet (md-lg, 768-1279px): static 280px panel, always visible.
          - Mobile (<768px): collapses into a right-side slide-in drawer,
            toggled by the hamburger button above; hidden off-canvas by
            default and never overlaps page content. */}
      <aside
        className={cn(
          'glass-panel border-l border-r-0 flex flex-col items-center py-8 px-4 gap-8 overflow-hidden',
          'fixed md:static inset-y-0 right-0 z-50 md:z-20 w-[82vw] max-w-[300px] md:w-[280px] xl:w-[340px]',
          'transition-transform duration-300 ease-out',
          'safe-area-top safe-area-bottom',
          drawerOpen ? 'translate-x-0' : 'max-md:translate-x-full'
        )}
      >
        <div className="w-full flex items-center justify-center shrink-0">
          <img src={logoUrl} alt="Wasl" className="no-mirror w-48 max-w-full h-auto drop-shadow-lg" />
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

      {/* Main Content. Top padding on mobile clears the fixed hamburger bar. */}
      <main className="relative z-10 flex-1 flex flex-col min-w-0 h-[100dvh] pt-14 md:pt-0 overflow-y-auto overflow-x-hidden hide-scrollbar safe-area-bottom">
        {children}
      </main>
    </div>
  );
}
