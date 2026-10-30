import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import { Announcer } from "../../components/Root/Announcer";
import {
  type RootStateOptions,
  useRootState,
} from "../../components/Root/useRootState";
import type { Clover } from "../../core/clover";
import { HostLanguageContext } from "../../i18n/hostLanguage";
import { CloverContext } from "../../react/context";
import { useRootLanguage } from "../../i18n/useRootLanguage";
import type { HostedProps } from "../host";
import { CloverApiContext, cloverApi } from "./api";
import { loadRenderers, useLoaded } from "./later";

/**
 * `<clover-root>`: a `Root` whose element is the page's own (`specs/root.ts`). The host
 * draws no element for it: it takes `class="clover-root"` and `data-status` itself, its
 * live region goes last inside it, and the page's markup in it stays as written. Its
 * parts are its descendants, wherever the page puts them.
 *
 *   <clover-root iiif-content="https://example.org/manifest.json">
 *     <clover-body></clover-body>
 *     <clover-label as="h2"></clover-label>
 *   </clover-root>
 */
export function RootElement({ hosted, props, children }: HostedProps) {
  // The page's renderers' adapter, only for a root given them, which waits for it.
  const rendering = useLoaded(loadRenderers, Boolean(props.renderers));
  // Nothing to load yet: its parts wait.
  if (!props.iiifContent || (props.renderers && !rendering)) return null;
  return (
    <LoadedRoot
      element={hosted.element}
      props={props}
      toRenderers={rendering?.toRenderers}
    >
      {children}
    </LoadedRoot>
  );
}

function LoadedRoot({
  element,
  props,
  toRenderers,
  children,
}: {
  element: HTMLElement;
  props: HostedProps["props"];
  toRenderers?: (value: unknown) => RootStateOptions["renderers"];
  children: React.ReactNode;
}) {
  const { canvasId, manifestId, lang, onReady, renderers, ...rest } =
    props as unknown as RootStateOptions & {
      lang?: string;
      onReady?: (clover: unknown) => void;
      renderers?: unknown;
    };
  // The page's language, read where the element is, or its own `lang`.
  const root = useRootLanguage(undefined, lang);
  root.ref(element);
  /*
   * `canvas-id` and `manifest-id` are where it opens, and the reader moves on from
   * there. Changed later, they move the reader. Its events are its callbacks.
   */
  const adapted = useMemo(
    () => toRenderers?.(renderers),
    [toRenderers, renderers],
  );
  const [context, status] = useRootState({
    ...rest,
    defaultCanvasId: canvasId,
    defaultManifestId: manifestId,
    renderers: adapted,
  });
  const { clover, language } = context;
  /*
   * `root.clover`, for a part of the page's: one for the root's Clover, reading its
   * language as it is now. Kept, and sent with `clover-ready`, while the root is drawn.
   */
  const now = useRef({ language, host: root.hostLanguage });
  now.current = { language, host: root.hostLanguage };
  const api = useMemo(
    () =>
      cloverApi(
        clover,
        () => now.current.language,
        () => now.current.host,
      ),
    [clover],
  );
  useLayoutEffect(() => {
    onReady?.(api);
    return () => onReady?.(null);
  }, [api, onReady]);
  useMoveTo(clover, canvasId, (id) => clover.goTo(id));
  useMoveTo(clover, manifestId, (id) => void clover.goToManifest(id));

  useLayoutEffect(() => {
    element.classList.add("clover-root");
    return () => element.classList.remove("clover-root");
  }, [element]);
  useLayoutEffect(() => {
    element.setAttribute("data-status", status);
  }, [element, status]);
  useLayoutEffect(
    () => () => element.removeAttribute("data-status"),
    [element],
  );

  return (
    <CloverContext.Provider value={context}>
      <HostLanguageContext.Provider value={root.hostLanguage}>
        <CloverApiContext.Provider value={api}>
          {children}
          {createPortal(
            <Announcer clover={clover} language={language} />,
            element,
          )}
        </CloverApiContext.Provider>
      </HostLanguageContext.Provider>
    </CloverContext.Provider>
  );
}

/** Move the reader when an attribute changes, not when it is first read. */
function useMoveTo(
  clover: Clover,
  id: string | undefined,
  move: (id: string) => void,
) {
  const shown = useRef(id);
  useEffect(() => {
    if (id && id !== shown.current) move(id);
    shown.current = id;
  }, [clover, id]); // eslint-disable-line react-hooks/exhaustive-deps
}
