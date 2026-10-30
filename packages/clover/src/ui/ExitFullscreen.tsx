import React from "react";
import { toggleFullscreen } from "../lib/fullscreen";
import { useCloverTranslation } from "../i18n/useCloverTranslation";
import { languageProps } from "../i18n/direction";

/**
 * The way out of full screen. `hidden` unless its root is full screen, so it stays out of
 * the way without the stylesheet too; the stylesheet only dresses it.
 */
const ExitFullscreen: React.FC<{ hidden?: boolean }> = ({ hidden }) => {
  const { t, langOf } = useCloverTranslation();
  const label = t("imageExitFullScreen");

  return (
    <button
      aria-label={label}
      {...languageProps(langOf("imageExitFullScreen"))}
      className="clover-canvas-exit-full-screen"
      hidden={hidden}
      onClick={(event) => void toggleFullscreen(event.currentTarget)}
      type="button"
    >
      <svg
        viewBox="0 0 512 512"
        width="20"
        height="20"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="45"
          d="M244 400L100 256l144-144M120 256h292"
        />
      </svg>
      {label}
    </button>
  );
};

export default ExitFullscreen;
