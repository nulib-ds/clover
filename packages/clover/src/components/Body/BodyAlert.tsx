import React from "react";

import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { languageProps } from "../../i18n/direction";

/**
 * What a Body could not load, said in the middle of the Body: Clover's interface words,
 * larger, then, smaller and muted, the error's own, in English as the browser and Clover
 * write them (where a server would not let the page read it, an issue with its CORS
 * headers). An alert, so it is announced as it comes. Always loaded with the Body, as the
 * failure it says may be the network's, which would keep a module of its own from coming.
 * `center={false}` leaves where it sits to its parent (a Scene's foot, clear of its
 * controls). `focusable`, it can take focus from what the failure took away (`Body`),
 * never a tab stop.
 */
export function BodyAlert({
  error,
  className,
  center = true,
  focusable = false,
}: {
  error: Error;
  className?: string;
  center?: boolean;
  focusable?: boolean;
}) {
  const { t, langOf } = useCloverTranslation();
  return (
    <div
      className={join("clover-status clover-body-alert", className)}
      data-status="error"
      data-center={center || undefined}
      role="alert"
      tabIndex={focusable ? -1 : undefined}
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
