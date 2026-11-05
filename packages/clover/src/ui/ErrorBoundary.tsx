import React from "react";

import { languageProps } from "../i18n/direction";
import { useCloverTranslation } from "../i18n/useCloverTranslation";

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
    return <Fallen error={error} />;
  }
}

/**
 * What went wrong, said as a Body says what it could not load (`BodyAlert`): Clover's
 * words in its language, then the error's own, in English as the browser writes them
 * (WCAG 3.1.2, 3.2.4). A function, since a class cannot call the translation hook.
 */
function Fallen({ error }: { error: Error }) {
  const { t, langOf } = useCloverTranslation();
  return (
    <div className="clover-canvas-error" role="alert">
      <p
        className="clover-canvas-error-headline"
        data-testid="headline"
        {...languageProps(langOf("statusError"))}
      >
        {t("statusError")}
      </p>
      {error.message && (
        <span className="clover-canvas-error-body" lang="en">
          {error.message}
        </span>
      )}
    </div>
  );
}
