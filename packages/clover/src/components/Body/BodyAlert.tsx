import React from "react";

import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { languageProps } from "../../i18n/direction";

/**
 * What a Body could not load, said in the middle of the Body: Clover's interface words,
 * larger, then, smaller and muted, the error's own, in English as the browser and Clover
 * write them (where a server would not let the page read it, an issue with its CORS
 * headers). An alert, so it is announced as it comes. A module of its own, so only what
 * fails to load carries it, never a page's first load. `center={false}` leaves where it
 * sits to its parent (a Scene's foot, clear of its controls).
 */
export function BodyAlert({
  error,
  className,
  center = true,
}: {
  error: Error;
  className?: string;
  center?: boolean;
}) {
  const { t, langOf } = useCloverTranslation();
  return (
    <div
      className={join("clover-status clover-body-alert", className)}
      data-status="error"
      data-center={center || undefined}
      role="alert"
    >
      <p
        className="clover-body-alert-headline"
        {...languageProps(langOf("statusError"))}
      >
        {t("statusError")}
      </p>
      <p className="clover-status-detail" lang="en">
        {error.message}
      </p>
    </div>
  );
}
