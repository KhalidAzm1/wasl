import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, LogIn, Building2, Pencil, Upload, Archive,
  Calendar, Search, Users, Sun, Lightbulb,
  ChevronRight, BookOpen, CheckCircle2, ChevronLeft,
} from 'lucide-react';

const STORAGE_KEY = 'wasl_guide_dismissed';

const STEPS = [
  {
    icon: LogIn,
    title: 'How to Log In',
    content:
      'Visit the login page and enter your email and password. Super Admins and Admins can log in. Contact your system administrator if you need an account created. You will be taken to the WASL AI Hub entry experience after logging in.',
  },
  {
    icon: Building2,
    title: 'How to Add a Bank',
    content:
      'Go to Settings → Banks & Financing Entities and click "Add Bank". Fill in the bank name (Arabic and English), category, risk level, and status. You can upload a logo and hero image. The bank is saved permanently to the database.',
  },
  {
    icon: Pencil,
    title: 'How to Edit Information',
    content:
      'Click on any bank card on the Dashboard to open its detail page. Click the Edit button (pencil icon) at the top-right of the bank card to modify fields. Changes are saved immediately and appear across the platform.',
  },
  {
    icon: Upload,
    title: 'How to Upload Files & Images',
    content:
      'Inside any bank detail page, open the Documents tab. Click "Upload to OneDrive" to select a file from your computer. Add a title and document type, then click Confirm Upload. Files are stored securely in Microsoft OneDrive and linked permanently to the bank.',
  },
  {
    icon: Archive,
    title: 'How to Archive & Restore',
    content:
      'Click the trash icon on any bank, document, or meeting to archive it. Archived items are NOT permanently deleted — they are moved to the Archive. Go to Settings → Archive to view and restore any archived item at any time.',
  },
  {
    icon: Calendar,
    title: 'How to Manage Meetings',
    content:
      'Inside a bank detail page, go to the Meetings tab and click "New Meeting". Log the date, topic, and summary of each meeting. View all meetings across all banks by clicking Meetings in the sidebar navigation panel.',
  },
  {
    icon: Search,
    title: 'How to Use Search & Filters',
    content:
      'On the Dashboard, use the search bar at the top to find banks by name. Use the category and status filter dropdowns to narrow your results. The list updates in real-time as you type. Click on any bank card to open its full detail view.',
  },
  {
    icon: Users,
    title: 'How to Manage Users',
    content:
      'Super Admins can access User Management from the sidebar. You will be prompted for the Admin PIN the first time. Create new admin accounts, assign roles (Super Admin or Admin), set granular permissions per user, and deactivate accounts when needed.',
  },
  {
    icon: Sun,
    title: 'How to Switch Themes',
    content:
      'Click the sun or moon icon in the top-right corner of any page to toggle between Dark and Light modes. Your preference is saved automatically in the browser and applied immediately across the whole platform.',
  },
  {
    icon: Lightbulb,
    title: 'Best Practices & Tips',
    content:
      'Always upload a logo when adding a new bank — it helps visual identification on the dashboard. Use the meeting log to track every interaction. Archive banks that are on hold rather than deleting them, so you can restore them later. Keep product progress percentages and statuses updated regularly for accurate reporting.',
  },
];

interface WaslOnboardingGuideProps {
  /** Called when the user clicks "Start Exploring" — use to trigger cube entry */
  onStartExploring?: () => void;
}

export function WaslOnboardingGuide({ onStartExploring }: WaslOnboardingGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  // Auto-show on first visit (after a short delay so the scene loads first)
  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;
    const t = window.setTimeout(() => setIsOpen(true), 1600);
    return () => window.clearTimeout(t);
  }, []);

  function handleClose() {
    if (dontShowAgain) localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
  }

  function handleStartExploring() {
    if (dontShowAgain) localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
    onStartExploring?.();
  }

  function prev() {
    setActiveStep((s) => Math.max(0, s - 1));
  }

  function next() {
    setActiveStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  const Step = STEPS[activeStep];
  const StepIcon = Step.icon;
  const isLast = activeStep === STEPS.length - 1;

  return (
    <>
      {/* ── Floating trigger button ── */}
      <motion.button
        type="button"
        aria-label="Open onboarding guide"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-white/80 hover:text-white transition-colors"
        style={{
          background: 'rgba(108,76,255,0.14)',
          border: '1px solid rgba(108,76,255,0.35)',
          backdropFilter: 'blur(14px)',
          boxShadow: '0 0 22px rgba(108,76,255,0.18)',
        }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.5, ease: 'easeOut' }}
        whileHover={{
          scale: 1.05,
          boxShadow: '0 0 32px rgba(108,76,255,0.4)',
        }}
      >
        <BookOpen className="w-4 h-4 text-[#8B5CF6]" />
        How to Use WASL AI Hub
      </motion.button>

      {/* ── Guide overlay ── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={handleClose}
              aria-hidden="true"
            />

            {/* Side panel */}
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="WASL AI Hub onboarding guide"
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] flex flex-col"
              style={{
                background:
                  'linear-gradient(160deg, rgba(12,8,24,0.98) 0%, rgba(5,3,10,0.99) 100%)',
                borderLeft: '1px solid rgba(108,76,255,0.18)',
                boxShadow: '-24px 0 72px rgba(108,76,255,0.12)',
              }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: 'rgba(108,76,255,0.18)',
                      border: '1px solid rgba(108,76,255,0.38)',
                    }}
                  >
                    <BookOpen className="w-4 h-4 text-[#8B5CF6]" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-[15px] leading-tight">
                      How to Use WASL AI Hub
                    </h2>
                    <p className="text-white/35 text-[11px] mt-0.5 uppercase tracking-wider">
                      Step-by-step guide
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close guide"
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/35 hover:text-white hover:bg-white/8 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step number pills */}
              <div className="flex gap-1.5 px-6 py-3 border-b border-white/5 overflow-x-auto shrink-0">
                {STEPS.map((_, i) => {
                  const done = i < activeStep;
                  const active = i === activeStep;
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to step ${i + 1}`}
                      onClick={() => setActiveStep(i)}
                      className="shrink-0 w-7 h-7 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: active
                          ? 'rgba(108,76,255,0.5)'
                          : done
                            ? 'rgba(34,197,94,0.15)'
                            : 'rgba(255,255,255,0.05)',
                        border: active
                          ? '1px solid rgba(108,76,255,0.75)'
                          : done
                            ? '1px solid rgba(34,197,94,0.3)'
                            : '1px solid rgba(255,255,255,0.08)',
                        color: active ? 'white' : done ? '#4ade80' : 'rgba(255,255,255,0.35)',
                      }}
                    >
                      {done ? '✓' : i + 1}
                    </button>
                  );
                })}
              </div>

              {/* Active step content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                  >
                    {/* Featured step card */}
                    <div
                      className="p-5 rounded-2xl mb-5"
                      style={{
                        background: 'rgba(108,76,255,0.07)',
                        border: '1px solid rgba(108,76,255,0.2)',
                      }}
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: 'rgba(108,76,255,0.22)',
                            border: '1px solid rgba(108,76,255,0.45)',
                          }}
                        >
                          <StepIcon className="w-5 h-5 text-[#8B5CF6]" />
                        </div>
                        <div>
                          <p className="text-white/35 text-[10px] uppercase tracking-[0.15em] font-medium mb-0.5">
                            Step {activeStep + 1} of {STEPS.length}
                          </p>
                          <h3 className="text-white font-bold text-lg leading-tight">{Step.title}</h3>
                        </div>
                      </div>
                      <p className="text-white/65 text-sm leading-relaxed">{Step.content}</p>
                    </div>

                    {/* All steps list */}
                    <div className="space-y-1.5">
                      {STEPS.map((step, i) => {
                        const StepListIcon = step.icon;
                        const active = i === activeStep;
                        const done = i < activeStep;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setActiveStep(i)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                            style={{
                              background: active ? 'rgba(108,76,255,0.1)' : 'rgba(255,255,255,0.02)',
                              border: active
                                ? '1px solid rgba(108,76,255,0.28)'
                                : '1px solid rgba(255,255,255,0.04)',
                            }}
                          >
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                              style={{
                                background: done
                                  ? 'rgba(34,197,94,0.15)'
                                  : active
                                    ? 'rgba(108,76,255,0.28)'
                                    : 'rgba(255,255,255,0.05)',
                              }}
                            >
                              {done ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <StepListIcon
                                  className="w-3 h-3"
                                  style={{ color: active ? '#8B5CF6' : 'rgba(255,255,255,0.35)' }}
                                />
                              )}
                            </div>
                            <span
                              className="text-sm flex-1 truncate"
                              style={{
                                color: active
                                  ? 'rgba(255,255,255,0.9)'
                                  : done
                                    ? 'rgba(255,255,255,0.45)'
                                    : 'rgba(255,255,255,0.38)',
                              }}
                            >
                              {step.title}
                            </span>
                            {active && <ChevronRight className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/5 space-y-3 shrink-0">
                {/* Prev / Next navigation */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={prev}
                    disabled={activeStep === 0}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white/50 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </button>
                  {!isLast && (
                    <button
                      type="button"
                      onClick={next}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white/50 hover:text-white/80 transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className="ml-auto text-[11px] text-white/25">
                    {activeStep + 1} / {STEPS.length}
                  </span>
                </div>

                {/* Don't show again */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={dontShowAgain}
                    onClick={() => setDontShowAgain((v) => !v)}
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                    style={{
                      background: dontShowAgain ? 'rgba(108,76,255,0.6)' : 'transparent',
                      border: dontShowAgain
                        ? '1px solid rgba(108,76,255,0.85)'
                        : '1px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    {dontShowAgain && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                  </button>
                  <span
                    className="text-[13px] text-white/40 group-hover:text-white/60 transition-colors"
                    onClick={() => setDontShowAgain((v) => !v)}
                  >
                    Don't show this guide again
                  </span>
                </label>

                {/* Start Exploring */}
                <motion.button
                  type="button"
                  onClick={handleStartExploring}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(108,76,255,0.75) 0%, rgba(139,92,246,0.75) 100%)',
                    border: '1px solid rgba(108,76,255,0.55)',
                    boxShadow: '0 0 24px rgba(108,76,255,0.3)',
                  }}
                  whileHover={{ scale: 1.01, boxShadow: '0 0 36px rgba(108,76,255,0.45)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  Start Exploring →
                </motion.button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
