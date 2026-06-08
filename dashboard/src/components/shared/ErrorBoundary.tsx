import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches render errors so a single component throwing doesn't blank the whole
 * app (React unmounts the tree on an uncaught render error). Shows the message
 * and a reload button instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surfaced in the browser console for diagnosis.
    console.error('UI crash:', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-cream p-6 text-center">
        <h1 className="text-xl font-semibold text-ink-head">Une erreur s'est produite</h1>
        <p className="max-w-md break-words font-mono text-sm text-ink-muted">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:opacity-90"
        >
          Recharger
        </button>
      </div>
    );
  }
}
