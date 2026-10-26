import { describe, expect, it, vi } from "vitest";

import {
  type ModelContextLike,
  modelContextOf,
  registerTools,
} from "./register";
import type { ToolDefinition } from "./tools";

const TOOLS: ToolDefinition[] = [
  {
    name: "clover_suggest_layout",
    title: "Suggest a Clover layout",
    description: "Suggests.",
    inputSchema: { type: "object" },
    annotations: { readOnlyHint: true },
  },
  {
    name: "clover_compose_layout",
    title: "Write a Clover layout's code",
    description: "Writes.",
    inputSchema: { type: "object" },
    annotations: { readOnlyHint: true },
  },
];

/** Microtasks, run out: registration waits on one. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A model context as the draft has it, keeping what it is given until each signal aborts. */
function draftContext() {
  const tools = new Map<string, Record<string, unknown>>();
  const context: ModelContextLike = {
    registerTool: vi.fn(async (tool, options) => {
      const name = tool.name as string;
      if (tools.has(name)) throw new DOMException("taken", "InvalidStateError");
      tools.set(name, tool);
      options?.signal?.addEventListener("abort", () => tools.delete(name));
    }),
  };
  return { context, tools };
}

describe("modelContextOf", () => {
  it("finds the context on the document, else on the navigator, else none", () => {
    const { context } = draftContext();
    expect(
      modelContextOf({
        document: { modelContext: context } as unknown as Document,
      }),
    ).toBe(context);
    expect(
      modelContextOf({
        document: {} as Document,
        navigator: { modelContext: context } as unknown as Navigator,
      }),
    ).toBe(context);
    expect(
      modelContextOf({
        document: { modelContext: {} } as unknown as Document,
      }),
    ).toBeUndefined();
    expect(modelContextOf({})).toBeUndefined();
  });
});

describe("registerTools", () => {
  it("registers each tool until the signal aborts", async () => {
    const { context, tools } = draftContext();
    const controller = new AbortController();
    registerTools(context, TOOLS, vi.fn(), controller.signal);
    await settled();
    expect([...tools.keys()]).toEqual([
      "clover_suggest_layout",
      "clover_compose_layout",
    ]);
    expect(context.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Suggest a Clover layout" }),
      { signal: controller.signal },
    );
    controller.abort();
    expect(tools.size).toBe(0);
  });

  it("runs a tool only when it is called, with its name, input and signal", async () => {
    const { context, tools } = draftContext();
    const runner = vi.fn(async () => ({ ok: true }));
    registerTools(context, TOOLS, runner, new AbortController().signal);
    await settled();
    expect(runner).not.toHaveBeenCalled();
    const call = new AbortController();
    const execute = tools.get("clover_compose_layout")!.execute as (
      input: unknown,
      options: { signal: AbortSignal },
    ) => Promise<unknown>;
    await expect(
      execute({ parts: [] }, { signal: call.signal }),
    ).resolves.toEqual({ ok: true });
    expect(runner).toHaveBeenCalledWith(
      "clover_compose_layout",
      { parts: [] },
      call.signal,
    );
  });

  it("registers nothing once the page has gone", async () => {
    const { context, tools } = draftContext();
    const controller = new AbortController();
    registerTools(context, TOOLS, vi.fn(), controller.signal);
    controller.abort();
    await settled();
    expect(tools.size).toBe(0);
  });

  it("goes on quietly past a tool the context refuses", async () => {
    const { context, tools } = draftContext();
    tools.set("clover_suggest_layout", {});
    registerTools(context, TOOLS, vi.fn(), new AbortController().signal);
    await settled();
    expect(tools.has("clover_compose_layout")).toBe(true);
  });

  it("unregisters by the handle an earlier draft's polyfill gives back", async () => {
    const unregister = vi.fn();
    const context: ModelContextLike = {
      registerTool: vi.fn(() => ({ unregister })),
    };
    const controller = new AbortController();
    registerTools(context, TOOLS, vi.fn(), controller.signal);
    await settled();
    expect(unregister).not.toHaveBeenCalled();
    controller.abort();
    expect(unregister).toHaveBeenCalledTimes(2);
  });
});
