import React from 'react';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * WebGL is not guaranteed: some headless/embedded browsers (and rare real
 * devices) return a context object from getContext('webgl') that still
 * throws once THREE.WebGLRenderer actually initializes. If the <Canvas />
 * subtree throws for any reason, fall back to a static glowing WASL mark on
 * the same dark background instead of taking down the whole entry page.
 */
export class EntryCubeBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('3D hero scene failed to render, falling back to static mark:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: '#050816' }}>
          <img
            src={logoUrl}
            alt="Wasl"
            className="no-mirror h-40 md:h-56 w-auto"
            style={{ filter: 'drop-shadow(0 0 30px rgba(124,58,237,0.8)) drop-shadow(0 0 55px rgba(59,130,246,0.5))' }}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
