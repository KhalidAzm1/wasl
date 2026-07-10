import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// Root-level safety net: if anything anywhere in the tree throws during
// render (a bad third-party lib, a bug in a new feature, etc.), show a
// recoverable message instead of a permanent blank white page.
export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('Unhandled error rendering the app:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="ltr"
          className="min-h-[100dvh] w-full flex items-center justify-center bg-background text-foreground p-8"
        >
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-bold">An unexpected error occurred</h1>
            <p className="text-white/60">
              Something went wrong while loading the page. Try refreshing, and let us know if the problem persists.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-primary text-white font-semibold"
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
