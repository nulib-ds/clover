"use client";

import { useEffect, useSyncExternalStore } from "react";

import styles from "docs/components/AgentTools.module.css";
import { snapshot, subscribe } from "docs/lib/webmcp/preview-store";

import { modelContextOf, registerTools } from "docs/lib/webmcp/register";
import type { ToolDefinition } from "docs/lib/webmcp/tools";

/**
 * The docs' tools for agents (AGENTS.md, "Agent tools (WebMCP)"), registered with
 * WebMCP on every page where the browser offers it, and taken back as the page goes.
 * It draws nothing but the status region that says when a preview comes and goes, out
 * of sight. The definitions come from the server (`agentTools()` in the root layout);
 * what the tools do, and the compose engine behind them, load the first time an agent
 * calls one.
 */
export default function AgentTools({ tools }: { tools: ToolDefinition[] }) {
  useEffect(() => {
    const context = modelContextOf();
    if (!context) return;
    const controller = new AbortController();
    registerTools(
      context,
      tools,
      async (name, input, signal) => {
        const { run } = await import("docs/lib/webmcp/run");
        signal?.throwIfAborted();
        return run(name, input, signal);
      },
      controller.signal,
    );
    return () => controller.abort();
  }, [tools]);
  // What a screen reader hears as a preview comes and goes (WCAG 4.1.3).
  const { announcement } = useSyncExternalStore(subscribe, snapshot, snapshot);
  return (
    <div role="status" className={styles.status}>
      {announcement}
    </div>
  );
}
