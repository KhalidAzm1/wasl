import type React from 'react';
import logoUrl from '@assets/wasl_brand/wasl_logo_uploaded_transparent.png';

interface WaslLogoProps {
  height?: number;
  className?: string;
  /** Classes on the `<img>` (sizing). Defaults to a height-based fit. */
  imgClassName?: string;
  /** Inline style on the `<img>`; defaults to `{ height }`. Pass `{}` to size purely via `imgClassName` (e.g. a width-based fit). */
  imgStyle?: React.CSSProperties;
}

/**
 * The WASL brand lockup (Arabic/English wordmark + AI Banking Dashboard tagline
 * + the blue quarter-circle mark), with its background made transparent so it
 * sits cleanly on both the dark and light theme without a boxed backdrop.
 */
export function WaslLogo({ height = 90, className = '', imgClassName = 'w-auto max-w-full', imgStyle }: WaslLogoProps) {
  return (
    <img
      src={logoUrl}
      alt="Wasl"
      style={imgStyle ?? { height }}
      className={`no-mirror ${imgClassName} ${className}`}
    />
  );
}
