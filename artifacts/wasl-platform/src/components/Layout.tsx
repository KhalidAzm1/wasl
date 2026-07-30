import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Settings2, Settings, Users, LogOut, Calendar, FileText, ShieldCheck, X, Sun, Moon, Activity, FlaskConical, Layers } from 'lucide-react';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';
import { cn } from '@/lib/utils';
import { AnimatedBackground } from './AnimatedBackground';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/authContext';
import { useTheme } from './ThemeProvider';
import { WaslLogo } from './WaslLogo';
import { WaslAIChat } from './WaslAIChat';
import { motion, AnimatePresence } from 'framer-motion';
import { analytics } from '@/lib/analytics';

interface LayoutProps {
  children: React.ReactNode;
}

const mainNavItems = [
  { href: '/portfolio', icon: LayoutDashboard, label: 'Dashboard', roles: null, permission: 'dashboard_access' as const },
  { href: '/settings', icon: Settings2, label: 'Dashboard Settings', roles: null, permission: null },
];

// Note: "Product Types" and "Archive" live as tabs inside the Settings page
// itself — they are intentionally NOT duplicated here as separate entries,
// since both used to point at the same /settings route with no tab
// differentiation, which read as a duplicate menu item.
const contentNavItems = [
  { href: '/admin/users', icon: Users, label: 'User Management', roles: ['super_admin'], permission: 'user_management' as const },
  { href: '/meetings', icon: Calendar, label: 'Meetings', roles: null, permission: 'meetings' as const },
  { href: '/documents', icon: FileText, label: 'Documents', roles: null, permission: 'documents' as const },
];

const adminNavItems = [
  { href: '/admin/system-health', icon: Activity, label: 'System Health', roles: ['super_admin'], permission: 'user_management' as const },
  { href: '/admin/system-tests', icon: FlaskConical, label: 'System Tests', roles: ['super_admin'], permission: 'user_management' as const },
  { href: '/admin/implementation-settings', icon: Layers, label: 'Implementation Stages', roles: ['super_admin'], permission: 'user_management' as const },
];

const systemNavItems = [
  { href: '/security', icon: ShieldCheck, label: 'Activity Timeline', roles: null, permission: 'security' as const },
];

export function Layout({ children }: LayoutProps) {
  const [location, navigate] = useLocation();
  const [panelOpen, setPanelOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { role, permissions } = useAuth();
  const { theme, setTheme } = useTheme();

  // Close panel on route change
  useEffect(() => {
    setPanelOpen(false);
  }, [location]);

  // Close panel on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false);
    };
    if (panelOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [panelOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      analytics.userLogout();
      sessionStorage.removeItem('wasl_admin_pin_token');
      sessionStorage.removeItem('wasl_admin_pin_token_expires');
      await supabase.auth.signOut();
      navigate('/login');
    } finally {
      setSigningOut(false);
    }
  }

  const filterNavItems = (items: any[]) =>
    items.filter((item) => {
      const roleOk = !item.roles || (role && item.roles.includes(role));
      // Permissions are optional metadata on older/legacy profiles — only a
      // profile with permissions loaded and the flag explicitly disabled is
      // hidden, so a null/undefined permissions map (e.g. still loading)
      // doesn't flash-hide every nav item.
      const permissionOk = !item.permission || !permissions || permissions[item.permission as keyof typeof permissions] !== false;
      return roleOk && permissionOk;
    });

  const renderNavSection = (items: any[], title?: string) => {
    const filtered = filterNavItems(items);
    if (filtered.length === 0) return null;

    return (
      <div className="flex flex-col gap-1 mb-6">
        {title && (
          <div className="px-4 py-2 text-xs font-semibold text-foreground/40 uppercase tracking-wider">
            {title}
          </div>
        )}
        {filtered.map((item, idx) => {
          // Simplistic exact path match; handle deep linking /settings active states if needed
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link key={`${item.href}-${idx}`} href={item.href} className="block">
              <div
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer group',
                  isActive
                    ? 'bg-primary/20 text-foreground border border-primary/30 shadow-[0_0_15px_rgba(124,58,237,0.15)]'
                    : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5 border border-transparent'
                )}
              >
                <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "group-hover:text-foreground")} />
                <span className="font-medium text-[15px]">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] w-full text-foreground bg-background font-sans flex overflow-x-hidden" dir="ltr">
      <AnimatedBackground />

      {/* Brand watermark, present behind all page content */}
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        className="no-mirror pointer-events-none select-none fixed bottom-[-6%] right-[-4%] w-[38rem] max-w-[60vw] opacity-[0.05] z-0"
      />

      {/* Floating Settings Button
          Desktop: top-right corner
          Mobile:  bottom-right corner, above AI chat widget (which sits at bottom-6) */}
      <div className="fixed z-40
                      bottom-[5.5rem] right-4 flex-col gap-2
                      sm:bottom-auto sm:top-6 sm:right-6 sm:flex-row
                      flex safe-area-bottom">
        {/* Theme toggle — hidden on mobile to keep the corner clean; accessible via the settings panel */}
        <button
          type="button"
          aria-label="Toggle theme"
          aria-pressed={theme === 'light'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="hidden sm:flex w-11 h-11 sm:w-12 sm:h-12 rounded-full
                     bg-foreground/[0.06] dark:bg-background/70
                     backdrop-blur-xl border border-foreground/[0.12]
                     items-center justify-center
                     text-foreground/70 hover:text-foreground
                     hover:bg-foreground/[0.1] hover:border-foreground/20
                     transition-all shadow-lg hover:shadow-primary/20 hover:scale-105"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>
        {/* Settings / nav panel — always visible */}
        <button
          type="button"
          aria-label="Open settings panel"
          onClick={() => setPanelOpen(true)}
          className="flex w-11 h-11 sm:w-12 sm:h-12 rounded-full
                     bg-foreground/[0.06] dark:bg-background/70
                     backdrop-blur-xl border border-foreground/[0.12]
                     items-center justify-center
                     text-foreground/70 hover:text-foreground
                     hover:bg-foreground/[0.1] hover:border-foreground/20
                     transition-all shadow-lg hover:shadow-primary/20 hover:scale-105"
        >
          <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Slide-over Panel & Backdrop */}
      <AnimatePresence>
        {panelOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
              onClick={() => setPanelOpen(false)}
              aria-hidden="true"
            />

            {/* Slide-over panel */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              role="dialog"
              aria-modal="true"
              aria-label="Settings panel"
              className="fixed inset-y-0 right-0 z-50 w-full max-w-[320px] md:max-w-[380px] bg-background/95 backdrop-blur-2xl border-l border-foreground/10 shadow-2xl flex flex-col safe-area-top safe-area-bottom"
            >
              <div className="relative flex flex-col items-center justify-center gap-2 px-12 pt-10 pb-8 border-b border-foreground/5">
                <WaslLogo height={90} />
                <p className="text-[11px] text-foreground/40 uppercase tracking-[0.15em] font-medium">Banking Intelligence Platform</p>
                <button
                  type="button"
                  aria-label="Close settings panel"
                  onClick={() => setPanelOpen(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-6 hide-scrollbar">
                {renderNavSection(mainNavItems)}
                {renderNavSection(contentNavItems, 'Content')}
                {renderNavSection(adminNavItems, 'Admin')}
                {renderNavSection(systemNavItems, 'System')}
              </div>

              <div className="p-4 border-t border-foreground/5">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer text-red-600 dark:text-red-400/80 hover:text-red-600 dark:text-red-400 hover:bg-red-600 dark:bg-red-400/10 border border-transparent disabled:opacity-50 group"
                >
                  <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                  <span className="font-medium text-[15px]">{signingOut ? 'Signing out...' : 'Sign out'}</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col min-w-0 min-h-[100dvh] pt-4 md:pt-0 overflow-y-auto overflow-x-hidden safe-area-bottom">
        {children}
      </main>

      {/* Wasl AI Chat Widget */}
      <WaslAIChat />
    </div>
  );
}
