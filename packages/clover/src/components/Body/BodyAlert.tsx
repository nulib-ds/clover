import React from "react";

import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { languageProps } from "../../core/direction";

/**
 * What a Body could not load, said: Clover's words, then the error's own, in English as
 * the browser and Clover write them. An alert, so it is announced as it comes. A module
 * of its own, so only what fails to load carries it, never a page's first load.
 */
export function BodyAlert({
  error,
  className,
}: {
  error: Error;
  className?: string;
}) {
  const { t, langOf } = useCloverTranslation();
  return (
    <div
      className={join("clover-status", className)}
      data-status="error"
      role="alert"
    >
      <p {...languageProps(langOf("statusError"))}>{t("statusError")}</p>
      <p className="clover-status-detail" lang="en">
        {error.message}
      </p>
    </div>
  );
}
