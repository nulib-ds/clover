import type { ToolDefinition, ToolName } from "docs/lib/webmcp/tools";

/**
 * Registering the docs' agent tools with WebMCP (WEBMCP.md), as the W3C Web Machine
 * Learning Community Group's draft has it (October 20, 2026): `document.modelContext`,
 * whose `registerTool(tool, { signal })` takes a tool until the signal aborts. Earlier
 * drafts, and the polyfills written to them, put it on `navigator` and gave back a handle
 * to unregister: both are met. Where neither is, nothing happens.
 */

export interface ModelContextLike {
  registerTool(
    tool: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): unknown;
}

/** The page's model context, where the browser (or an extension) gives one. */
export function modelContextOf(
  scope: { document?: Document; navigator?: Navigator } = globalThis,
): ModelContextLike | undefined {
  const own = (target: unknown) => {
    const context = (target as { modelContext?: ModelContextLike } | undefined)
      ?.modelContext;
    return typeof context?.registerTool === "function" ? context : undefined;
  };
  return own(scope.document) ?? own(scope.navigator);
}

/** What a tool does, given its input and the signal that cancels it. */
export type Runner = (
  name: ToolName,
  input: unknown,
  signal?: AbortSignal,
) => Promise<unknown>;

/**
 * Each tool, registered until `signal` aborts. A tool the context refuses (a name an
 * extension took already) is left out, quietly: the page works the same without it.
 */
export function registerTools(
  context: ModelContextLike,
  tools: readonly ToolDefinition[],
  runner: Runner,
  signal: AbortSignal,
) {
  for (const tool of tools)
    Promise.resolve()
      .then(() => {
        if (signal.aborted) return undefined;
        return context.registerTool(
          {
            ...tool,
            execute: (input: unknown, options?: { signal?: AbortSignal }) =>
              runner(tool.name, input, options?.signal),
          },
          { signal },
        );
      })
      .then((handle) => {
        const unregister = (handle as { unregister?: unknown } | undefined)
          ?.unregister;
        if (typeof unregister !== "function") return;
        const off = () => unregister.call(handle);
        if (signal.aborted) off();
        else signal.addEventListener("abort", off, { once: true });
      })
      .catch(() => {});
}
