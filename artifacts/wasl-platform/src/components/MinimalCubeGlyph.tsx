import React from 'react';

/**
 * Tiny static geometric glyph (an isometric cube outline, NOT the Wasl logo)
 * used as the last-resort visual for the cube widget: when the RotatingCube
 * module chunk itself fails to load, and as the neutral cube-face texture
 * when no bank/brand textures are available. Lives in its own file (kept
 * separate from RotatingCube.tsx) so it can be imported even if the main
 * module fails to load, preserving true lazy-import failure isolation.
 * It intentionally contains no Wasl branding/logo imagery, so no path
 * through this widget can ever reintroduce the duplicate-logo bug.
 */
export function MinimalCubeGlyph({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <polygon points="50,6 92,28 92,72 50,94 8,72 8,28" stroke="rgba(167,139,250,0.6)" strokeWidth="3" />
      <polygon points="50,6 92,28 50,50 8,28" stroke="rgba(96,165,250,0.5)" strokeWidth="2.5" />
      <line x1="50" y1="50" x2="50" y2="94" stroke="rgba(167,139,250,0.4)" strokeWidth="2.5" />
    </svg>
  );
}

/** Data-URL version of the same glyph, for use as a cube face texture. */
export function minimalCubeGlyphDataUrl(): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 100 100' fill='none'>
    <rect width='100' height='100' fill='#0c0c16'/>
    <polygon points='50,10 88,30 88,70 50,90 12,70 12,30' stroke='rgba(167,139,250,0.6)' stroke-width='3'/>
    <polygon points='50,10 88,30 50,50 12,30' stroke='rgba(96,165,250,0.5)' stroke-width='2.5'/>
    <line x1='50' y1='50' x2='50' y2='90' stroke='rgba(167,139,250,0.4)' stroke-width='2.5'/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
