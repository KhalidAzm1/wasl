import React from 'react';
import { StaticGlowFallback } from '@/components/EntryCube';

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
      return <StaticGlowFallback />;
    }
    return this.props.children;
  }
}
