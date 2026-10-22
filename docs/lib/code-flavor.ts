import { useSyncExternalStore } from "react";
import { CODE_FLAVOR_KEY as KEY } from "docs/lib/code-flavor-script";

/*
 * Which code the docs show: React, or web components (Mat, 2026-10-21; React by
 * default). The reader's choice, made with the header's switch (`CodeSwitch.tsx`),
 * remembered in this browser and kept in step across its tabs, and set on the page's root
 * as `data-code` before the page paints (`code-flavor-script.ts`, in the root layout's head).
 * An example holds its code in both, each marked `data-code-flavor`, and the page's CSS
 * shows the chosen one (`layout.css`): no flash of the other on load, and no re-render
 * when the reader switches. Both stay in the HTML, for agents and pages read without
 * scripts.
 */
export type CodeFlavor = "react" | "web-components";

/** Each, by its name; `short`, what of it shows where the header is narrow. */
export const CODE_FLAVORS: {
  value: CodeFlavor;
  label: string;
  short?: string;
}[] = [
  { value: "react", label: "React" },
  { value: "web-components", label: "Web components", short: "Web" },
];

const DEFAULT: CodeFlavor = "react";

const isFlavor = (value: unknown): value is CodeFlavor =>
  value === "react" || value === "web-components";

/** The address's choice (`?code=`, never stored), else the stored one, as the head script reads them. */
const readChosen = (): CodeFlavor => {
  try {
    const asked = new URLSearchParams(location.search).get("code");
    if (isFlavor(asked)) return asked;
    const value = localStorage.getItem(KEY);
    return isFlavor(value) ? value : DEFAULT;
  } catch {
    return DEFAULT;
  }
};

const apply = (flavor: CodeFlavor) => {
  if (flavor === DEFAULT) delete document.documentElement.dataset.code;
  else document.documentElement.dataset.code = flavor;
};

let current: CodeFlavor | null = null;
const listeners = new Set<() => void>();

const getCodeFlavor = (): CodeFlavor =>
  (current ??= typeof window === "undefined" ? DEFAULT : readChosen());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/* A choice made in another tab, shown here too. */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return;
    current = isFlavor(event.newValue) ? event.newValue : DEFAULT;
    apply(current);
    listeners.forEach((listener) => listener());
  });
}

/** Show the docs' code in React or as web components: on the page, and remembered. */
export const setCodeFlavor = (flavor: CodeFlavor) => {
  current = flavor;
  apply(flavor);
  try {
    if (flavor === DEFAULT) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, flavor);
  } catch {
    // Private browsing or a full quota: the choice holds for this page only.
  }
  listeners.forEach((listener) => listener());
};

/** The code the docs show, re-rendering when the reader changes it. */
export const useCodeFlavor = (): CodeFlavor =>
  useSyncExternalStore(subscribe, getCodeFlavor, () => DEFAULT);
