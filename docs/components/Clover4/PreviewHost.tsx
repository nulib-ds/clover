"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  registerHost,
  snapshot,
  subscribe,
} from "docs/lib/webmcp/preview-store";

/**
 * An example frame as a host for an agent's preview (AGENTS.md, "Agent tools
 * (WebMCP)"): every frame on a docs page registers, and the first on the page draws a
 * preview in place of its own example (`AgentPreview.tsx`, loaded only when one is
 * shown). A frame spreads `ref` on its `figure` and draws `<AgentPreview
 * shown={preview} />` while `preview` is set.
 */
export function usePreviewHost<T extends Element = HTMLElement>() {
  const ref = useRef<T>(null);
  const route = usePathname();
  const [key] = useState(() => Symbol("example frame"));
  useEffect(
    () => registerHost(key, () => ref.current, route ?? ""),
    [key, route],
  );
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  const preview = state.shown?.host === key ? state.shown : null;
  const id = preview?.id;
  const reveal = preview?.reveal;
  useEffect(() => {
    if (!id || !reveal) return;
    // Into view, without moving focus; at once where the reader asks for less motion.
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({
      behavior: still ? "auto" : "smooth",
      block: "start",
    });
  }, [id, reveal]);
  return { ref, preview };
}

/** The preview, drawn in a frame; its code loaded the first time one is shown. */
export const AgentPreview = dynamic(
  () =>
    import("docs/components/Clover4/AgentPreview").then(
      (module) => module.AgentPreview,
    ),
  { ssr: false },
);
