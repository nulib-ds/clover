import { useSyncExternalStore } from "react";

/**
 * Whether what a root draws takes Clover's higher-contrast mode (`styles/contrast.css`):
 * where the page sets `highContrast`, or the reader's system asks for more contrast
 * (`prefers-contrast: more`; Mat, 2026-10-29), followed as it changes. A root (a `Root`, or
 * a part standing alone) writes it as `data-high-contrast` on its element, and the parts
 * inside follow it there.
 */
export function useHighContrast(own: boolean | undefined): boolean {
  const asked = useSyncExternalStore(subscribe, readerAsks, never);
  return Boolean(own) || asked;
}

/** The attribute a root writes while the mode is on. */
export const highContrastProps = (on: boolean) =>
  on ? { "data-high-contrast": "" } : {};

const QUERY = "(prefers-contrast: more)";

const query = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(QUERY)
    : null;

function subscribe(change: () => void) {
  const list = query();
  list?.addEventListener?.("change", change);
  return () => list?.removeEventListener?.("change", change);
}

const readerAsks = () => Boolean(query()?.matches);

// Rendered on a server, before any reader is known.
const never = () => false;
