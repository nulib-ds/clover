import React from "react";

import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useStatus } from "../../react/hooks";
import { Loading } from "../../ui/Loading";
import { visuallyHidden } from "../../ui/visuallyHidden";

export interface StatusProps {
  className?: string;
  /**
   * Shown while loading. Default: Clover's loading mark (three pulsing dots), announced
   * as a translated "Loading…". `false` shows nothing and only announces it, for a
   * layout with a `Body`, which shows its own loading, so nothing moves.
   */
  loading?: React.ReactNode;
  /** Shown when loading failed. Default: a translated message and the error's own. */
  error?: (error: Error) => React.ReactNode;
}

/**
 * Loading and error states, announced: a `role="status"` region while loading and
 * `role="alert"` on failure. The region stays for the Status's whole life, empty and out
 * of sight once the content is ready, and only its words change: many screen readers
 * announce words put into a region already there, but not a region inserted with them
 * (WCAG 4.1.3).
 */
export function Status({
  className,
  loading,
  error: renderError,
}: StatusProps) {
  const { t, langOf } = useCloverTranslation();
  const { status, error } = useStatus();

  const busy = status === "loading";
  // Your own words are announced as they are; Clover's mark, or none, by the label.
  const own = loading !== undefined && loading !== false;
  return (
    <>
      <p
        className={join("clover-status", className)}
        data-status={busy ? status : undefined}
        role="status"
        style={busy && loading !== false ? undefined : visuallyHidden}
      >
        {busy && (own ? loading : loading === undefined && <Loading />)}
        {busy && !own && (
          <span style={visuallyHidden} lang={langOf("statusLoading")}>
            {t("statusLoading")}
          </span>
        )}
      </p>
      {status === "error" && error && (
        <div
          className={join("clover-status", className)}
          data-status={status}
          role="alert"
        >
          {renderError ? (
            renderError(error)
          ) : (
            <>
              <p lang={langOf("statusError")}>{t("statusError")}</p>
              {/* The error's own words: English, as the browser and Clover write them. */}
              <p className="clover-status-detail" lang="en">
                {error.message}
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
