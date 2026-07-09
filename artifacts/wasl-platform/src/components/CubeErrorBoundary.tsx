import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// Some browsers/sandboxes cannot create a WebGL context (e.g. headless
// preview tools, locked-down corporate machines). Rather than crashing the
// whole sidebar, fall back to a static premium placeholder.
export class CubeErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('RotatingCube failed to render, falling back to static visual:', error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export function isWebglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const attrs: WebGLContextAttributes = { alpha: true, antialias: true };
    const gl =
      canvas.getContext('webgl2', attrs) ||
      canvas.getContext('webgl', attrs) ||
      canvas.getContext('experimental-webgl' as any, attrs);
    if (!gl) return false;
    // Some sandboxed browsers report a context object but it is immediately
    // lost / non-functional (isContextLost() === true). Treat that as unavailable.
    const glCtx = gl as WebGLRenderingContext;
    if (typeof glCtx.isContextLost === 'function' && glCtx.isContextLost()) return false;
    return true;
  } catch {
    return false;
  }
}
