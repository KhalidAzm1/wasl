import { useLocation } from 'wouter';
import { ArrowRight, Home } from 'lucide-react';

/** Back + Home navigation controls, shown at the top of pages other than the main dashboard. */
export function NavControls({ variant = 'default' }: { variant?: 'default' | 'overlay' }) {
  const [, setLocation] = useLocation();

  const base = 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border';
  const style =
    variant === 'overlay'
      ? `${base} bg-black/40 border-white/10 text-white/80 hover:text-white hover:bg-black/60 backdrop-blur-md`
      : `${base} bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10`;

  return (
    <div className="flex items-center gap-3">
      <button onClick={() => window.history.back()} className={style}>
        <ArrowRight className="w-4 h-4 rotate-180" />
        Back
      </button>
      <button onClick={() => setLocation('/')} className={style}>
        <Home className="w-4 h-4" />
        Home
      </button>
    </div>
  );
}
