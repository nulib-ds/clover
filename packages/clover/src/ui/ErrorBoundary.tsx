import React from "react";

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches a render error below it and shows what went wrong in place of the part, so one
 * broken Canvas cannot take the page with it.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // Its words are English, untranslated, so they are marked as English.
    return (
      <div className="clover-canvas-error" role="alert" lang="en">
        <p className="clover-canvas-error-headline" data-testid="headline">
          Something went wrong
        </p>
        {error.message && (
          <span className="clover-canvas-error-body">
            {`Error message: ${error.message}`}
          </span>
        )}
      </div>
    );
  }
}
