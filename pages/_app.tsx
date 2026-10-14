/*
 * Clover's stylesheets, imported here because Next's Pages Router only allows a global
 * stylesheet in `_app`. @nulib/clover ships its own, and consumers import it the same way.
 * The 3.x pages' components (`@samvera/clover-iiif`, from npm) inject their own styles.
 */
import "@nulib/clover/styles.css";
import "@nulib/clover/templates.css";
// The 4.x Map draws with MapLibre, whose stylesheet a consumer imports beside Clover's.
import "maplibre-gl/dist/maplibre-gl.css";

import "docs/styles/fonts.css";
import "docs/styles/layout.css";
import "docs/styles/tokens.css";

import type { AppProps } from "next/app";
import { restorePageTheme } from "docs/lib/page-theme";
import { useEffect } from "react";

export default function CloverDocsApp({ Component, pageProps }: AppProps) {
  /*
   * Reapply the reader's accent and font on every cold load.
   *
   * The playground writes both to the document root, but it only mounts on the homepage —
   * so without this, choosing an accent and then navigating into the docs dropped it, and
   * the stored value was never honored again. Runs in an effect because `localStorage` is
   * unreachable during SSR, which means a frame of the default theme before it applies.
   */
  useEffect(() => {
    restorePageTheme();
  }, []);

  return <Component {...pageProps} />;
}
