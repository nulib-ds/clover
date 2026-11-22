import React from "react";
import { ExitFullScreenGlyph } from "./glyphs/ExitFullScreen";
import { toggleFullscreen } from "../lib/fullscreen";
import { useCloverTranslation } from "../i18n/useCloverTranslation";
import { languageProps } from "../i18n/direction";

/**
 * The way out of full screen. `hidden` unless its root is full screen, so it stays out of
 * the way without the stylesheet too; the stylesheet only dresses it. Its glyph is the
 * Full screen control's way out, two arrows in, so the one action looks the same wherever
 * it sits (WCAG 3.2.4; a left arrow before, which read as Back).
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
        width="16"
        height="16"
        aria-hidden="true"
        focusable="false"
      >
        <ExitFullScreenGlyph />
      </svg>
      {label}
    </button>
  );
};

export default ExitFullscreen;
