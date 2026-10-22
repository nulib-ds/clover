import React, { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { Announcer } from "../../components/Root/Announcer";
import {
  type RootStateOptions,
  useRootState,
} from "../../components/Root/useRootState";
import type { Clover } from "../../core/clover";
import { HostLanguageContext } from "../../i18n/hostLanguage";
import { CloverContext } from "../../react/context";
import { useRootLanguage } from "../../react/language";
import type { HostedProps } from "../host";

/**
 * `<clover-root>`: a `Root` whose element is the page's own (`specs/root.ts`). The host
 * draws no element for it: it takes `class="clover-root"` and `data-status` itself, its
 * live region goes last inside it, and the page's markup in it stays as written. Its
 * parts are its descendants, wherever the page puts them.
 *
 *   <clover-root iiif-content="https://example.org/manifest.json">
 *     <clover-content></clover-content>
 *     <clover-label as="h2"></clover-label>
 *   </clover-root>
 */
export function RootElement({ hosted, props, children }: HostedProps) {
  // Nothing to load yet: its parts wait.
  if (!props.iiifContent) return null;
  return (
    <LoadedRoot element={hosted.element} props={props}>
      {children}
    </LoadedRoot>
  );
}

function LoadedRoot({
  element,
  props,
  children,
}: {
  element: HTMLElement;
  props: HostedProps["props"];
  children: React.ReactNode;
}) {
  const { canvasId, manifestId, lang, ...rest } =
    props as unknown as RootStateOptions & { lang?: string };
  // The page's language, read where the element is, or its own `lang`.
  const root = useRootLanguage(undefined, lang);
  root.ref(element);
  /*
   * `canvas-id` and `manifest-id` are where it opens, and the reader moves on from
   * there. Changed later, they move the reader. Its events are its callbacks.
   */
  const [context, status] = useRootState({
    ...rest,
    defaultCanvasId: canvasId,
    defaultManifestId: manifestId,
  });
  const { clover, language } = context;
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
        {children}
        {createPortal(
          <Announcer clover={clover} language={language} />,
          element,
        )}
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
