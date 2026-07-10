import { useLocation } from 'wouter';
import { ArrowRight, Home } from 'lucide-react';

/** Back + Home navigation controls, shown at the top of pages other than the main dashboard. */
export function NavControls({ variant = 'default', hideHome = false }: { variant?: 'default' | 'overlay'; hideHome?: boolean }) {
  const [, setLocation] = useLocation();

  const base = 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border';
  const style =
    variant === 'overlay'
      ? `${base} bg-background/60 border-foreground/10 text-foreground/80 hover:text-foreground hover:bg-background/80 backdrop-blur-md`
      : `${base} bg-foreground/5 border-foreground/10 text-foreground/70 hover:text-foreground hover:bg-foreground/10`;

  return (
    <div className="flex items-center gap-3 mr-14 xl:mr-0 z-20 relative">
      <button onClick={() => window.history.back()} className={style}>
        <ArrowRight className="w-4 h-4 rotate-180" />
        Back
      </button>
      {!hideHome && (
        <button onClick={() => setLocation('/portfolio')} className={style}>
          <Home className="w-4 h-4" />
          Home
        </button>
      )}
    </div>
  );
}
