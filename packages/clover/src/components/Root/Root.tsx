import React, { forwardRef } from "react";

import type { CloverStatus } from "../../core/clover";
import type { AnnotationsInput } from "../../core/annotation-collection";
import type { ContentStateOutput } from "../../core/content-state";
import type { IIIFContent } from "../../core/load";
import {
  highContrastProps,
  useHighContrast,
} from "../../hooks/useHighContrast";
import type { CloverRequest } from "../../core/request";
import { HostLanguageContext } from "../../i18n/hostLanguage";
import { join } from "../../lib/classnames";
import { CloverContext } from "../../react/context";
import { useRootLanguage } from "../../react/language";
import type { BodyRenderer } from "../Body/renderers";
import { Announcer } from "./Announcer";
import { useRootState } from "./useRootState";

export interface RootProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /**
   * What to show: a URL, a IIIF resource (Presentation 2, 3 or 4: a Manifest, Collection
   * or Canvas), or a content state (JSON or base64url).
   */
  iiifContent: IIIFContent;
  /** The Canvas to show, controlled: moving asks `onCanvasChange` to change it. */
  canvasId?: string;
  /** The Canvas to start on, uncontrolled. A content state or `start` still wins. */
  defaultCanvasId?: string;
  /** The reader moved to a Canvas (the first of the view that shows it). */
  onCanvasChange?: (canvasId: string) => void;
  /**
   * In a Collection, the member Manifest to show, controlled: choosing another asks
   * `onManifestChange` to change it.
   */
  manifestId?: string;
  /** In a Collection, the member Manifest to open first, uncontrolled. */
  defaultManifestId?: string;
  /** In a Collection, the reader moved (or, controlled, asks to move) to a Manifest. */
  onManifestChange?: (manifestId: string) => void;
  onStatusChange?: (status: CloverStatus, error: Error | null) => void;
  /**
   * A Content Search query to run once the Manifest is shown, and again whenever it
   * changes (3.x's `iiifContentSearchQuery`). The reader can search on from `Search`.
   */
  searchQuery?: string;
  /** Credentials, headers and `fetch` for every request any part makes. */
  request?: CloverRequest;
  /** The language to read IIIF text in. The reader's, by default. */
  language?: string;
  /**
   * Clover's higher-contrast mode, for every part inside: the accent kept to rings,
   * outlines and marks, and never under words or a glyph, where the controls' dark fill
   * takes its place, edged in the accent. For an accent that cannot carry white text at
   * 4.5:1. It is on wherever the reader's system asks for more contrast, too. Default
   * `false`.
   */
  highContrast?: boolean;
  /**
   * Renderers of your own for some views — by Canvas id, painting format, or a test —
   * drawn by every `Body` inside in place of `Canvas` (3.x's `customDisplays`).
   */
  renderers?: BodyRenderer[];
  /**
   * Annotations to show beside the Manifest's own: an AnnotationPage or
   * AnnotationCollection (or a list of them), as URLs or objects.
   */
  annotations?: AnnotationsInput;
  /**
   * Whose referenced annotation pages to fetch: the view's as the reader moves (default),
   * or every Canvas's at once, for a layout that shows them all.
   */
  annotationPages?: "view" | "all";
  /**
   * Where the reader is, as a IIIF content state, whenever it settles: after a move, a
   * pan or zoom, or a pause or seek in media. Debounced, and only when it changed.
   */
  onContentStateChange?: (state: ContentStateOutput) => void;
  /** The element to render. Default `div`. */
  as?: React.ElementType;
  children?: React.ReactNode;
}

/**
 * The root of any Clover composition. It loads `iiifContent`, holds where the reader is,
 * and gives every part inside it the same state. Render parts — `Clover.Body`,
 * `Clover.Label`, `Clover.Items` — anywhere within it, in any layout.
 */
export const Root = forwardRef<HTMLElement, RootProps>(function Root(
  { as: Tag = "div", className, children, highContrast, ...props },
  ref,
) {
  // What it holds: its Clover, the effects that keep it in step, its parts' context.
  const [context, status, rest] = useRootState(props);
  /*
   * The page's language, for Clover's strings to be marked where they are in another.
   * The Root carries none of its own: what the host puts in it is in the page's.
   */
  const root = useRootLanguage(ref, rest.lang);
  // The mode for every part inside, by its styles: the page's, or the reader's.
  const contrast = useHighContrast(highContrast);

  return (
    <CloverContext.Provider value={context}>
      <HostLanguageContext.Provider value={root.hostLanguage}>
        <Tag
          ref={root.ref}
          className={join("clover-root", className)}
          data-status={status}
          {...highContrastProps(contrast)}
          {...rest}
        >
          {children}
          <Announcer clover={context.clover} language={context.language} />
        </Tag>
      </HostLanguageContext.Provider>
    </CloverContext.Provider>
  );
});
