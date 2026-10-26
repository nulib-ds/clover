import type { PreviewPlan } from "docs/lib/compose/preview";

/**
 * Where an agent's preview is drawn (WEBMCP.md, phase 4), shared by the tool, which shows
 * it (`run.ts`), and the page's example frames, which draw it (`usePreviewHost`). Every
 * example frame on a page is a host; the first on the page draws the preview in place of
 * its own example until the reader brings that back, or leaves the page. Plain, with no
 * React, so the tool's chunk and the page's frames share the one store.
 */

export interface Shown {
  plan: PreviewPlan;
  /** The host drawing it. */
  host: symbol;
  /** Brought into view as it is drawn: the agent asked, for the reader. */
  reveal: boolean;
  /** Each preview's own, so a new one is drawn afresh. */
  id: number;
}

export interface PreviewState {
  shown: Shown | null;
  /** What a screen reader hears of it (WCAG 4.1.3), in the page's status region. */
  announcement: string;
}

interface Host {
  element: () => Element | null;
  route: string;
}

const hosts = new Map<symbol, Host>();
const listeners = new Set<() => void>();
let state: PreviewState = { shown: null, announcement: "" };
let count = 0;

const emit = (next: PreviewState) => {
  state = next;
  for (const listener of listeners) listener();
};

export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const snapshot = () => state;

/** An example frame, on the page at `route`, until it goes. */
export function registerHost(
  key: symbol,
  element: () => Element | null,
  route: string,
) {
  hosts.set(key, { element, route });
  return () => {
    hosts.delete(key);
    // Its page gone, its preview goes with it, unannounced.
    if (state.shown?.host === key) emit({ shown: null, announcement: "" });
  };
}

/** The first example frame on the page, by its place in it: where a preview is drawn. */
export function firstHost() {
  const placed = [...hosts]
    .map(([key, host]) => ({ key, route: host.route, element: host.element() }))
    .filter(
      (host): host is { key: symbol; route: string; element: Element } =>
        host.element?.isConnected === true,
    );
  placed.sort((a, b) =>
    a.element.compareDocumentPosition(b.element) &
    Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1,
  );
  return placed[0];
}

/** A preview, drawn by the host. */
export function showPreview(plan: PreviewPlan, host: symbol, reveal = false) {
  emit({
    shown: { plan, host, reveal, id: ++count },
    announcement: `Your agent's preview, ${plan.shows}, is in the page's first example.`,
  });
}

/** The page's own example back. */
export function closePreview() {
  if (!state.shown) return;
  emit({ shown: null, announcement: "The page's own example is back." });
}
