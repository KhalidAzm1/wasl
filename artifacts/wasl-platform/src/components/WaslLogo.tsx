import type React from 'react';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';
import iconUrl from '@assets/wasl_brand/wasl_icon_transparent.png';
import { useTheme } from './ThemeProvider';

/**
 * Brand lockup used at the top of auth screens and the sidebar panel.
 *
 * The source artwork (`wasl_logo_2026.png`) is baked onto a near-black
 * canvas, so in dark mode it keeps sitting on the existing `.logo-plate`
 * dark stage. In light mode that plate reads as a jarring black card, so we
 * render an equivalent lockup instead: transparent background, dark navy
 * wordmark, and the brand's blue quarter-circle mark, with only a soft glow
 * (no boxed backdrop).
 */
interface WaslLogoProps {
  height?: number;
  className?: string;
  /** Dark-mode-only: classes on the `.logo-plate` wrapper (padding/width). */
  plateClassName?: string;
  /** Dark-mode-only: classes on the raster `<img>` (sizing). */
  imgClassName?: string;
  /** Dark-mode-only: inline style on the raster `<img>`; defaults to `{ height }`. Pass `{}` to size purely via `imgClassName` (e.g. a width-based fit). */
  imgStyle?: React.CSSProperties;
}

export function WaslLogo({
  height = 90,
  className = '',
  plateClassName = 'px-6 py-4',
  imgClassName = 'w-auto max-w-full',
  imgStyle,
}: WaslLogoProps) {
  const { theme } = useTheme();

  if (theme === 'light') {
    return (
      <div className={`flex items-center justify-center gap-3 no-mirror ${className}`} style={{ height }}>
        <img
          src={iconUrl}
          alt=""
          style={{ height: '100%', width: 'auto', filter: 'drop-shadow(0 0 10px rgba(47, 107, 255, 0.3))' }}
        />
        <div className="flex flex-col items-start leading-none">
          <span className="font-bold" style={{ color: '#0F172A', fontSize: height * 0.34, lineHeight: 1 }}>
            وصل
          </span>
          <span className="font-bold tracking-wide" style={{ color: '#0F172A', fontSize: height * 0.22, lineHeight: 1.3 }}>
            WASL
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`logo-plate rounded-2xl flex items-center justify-center ${plateClassName} ${className}`}>
      <img src={logoUrl} alt="Wasl" style={imgStyle ?? { height }} className={`no-mirror ${imgClassName}`} />
    </div>
  );
}
