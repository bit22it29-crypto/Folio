import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as {
          error?: string;
          operationType?: string;
        };
        if (parsed && parsed.error) {
          friendly = `${parsed.operationType ? `Operation (${parsed.operationType}): ` : ''}${parsed.error}`;
        }
      } catch {
        // Use raw message
      }

      return (
        <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex items-center justify-center p-6">
          <div className="max-w-lg w-full border border-[var(--border-hairline)] rounded-xl p-8 bg-[var(--bg-surface)]">
            <p className="text-xs uppercase tracking-widest text-[var(--text-accent-soft)] mb-2">
              Folio Editorial Notice
            </p>
            <h1 className="font-display text-2xl font-semibold mb-3 text-[var(--text-primary)]">
              Something interrupted this view
            </h1>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6 break-words">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium bg-[#6D28D9] text-white rounded-lg hover:bg-[#7C3AED] transition-colors cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
