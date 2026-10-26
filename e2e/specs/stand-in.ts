import type { Page } from "@playwright/test";

/**
 * A stand-in for the browser's WebMCP, as the W3C draft has it (October 20, 2026):
 * `document.modelContext.registerTool(tool, { signal })`, keeping each tool until its
 * signal aborts, and refusing a name already taken. Set before the page's own scripts,
 * as a browser's would be.
 */
export async function standIn(page: Page) {
  await page.addInitScript(() => {
    const tools = new Map<string, Record<string, unknown>>();
    const registered: string[] = [];
    Object.assign(window, { __tools: tools, __registered: registered });
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        async registerTool(
          tool: Record<string, unknown>,
          { signal }: { signal?: AbortSignal } = {},
        ) {
          const name = tool.name as string;
          if (tools.has(name))
            throw new DOMException(`${name} is taken`, "InvalidStateError");
          tools.set(name, tool);
          registered.push(name);
          signal?.addEventListener("abort", () => tools.delete(name));
        },
      },
    });
  });
}

/** The page, once its tools are registered. */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(
    () =>
      (window as unknown as { __tools?: Map<string, unknown> }).__tools
        ?.size === 3,
    null,
    { timeout: 90_000 },
  );
}

/** What the tools are, as the page registered them, without what they do. */
export const described = (page: Page) =>
  page.evaluate(() =>
    [
      ...(
        window as unknown as { __tools: Map<string, Record<string, unknown>> }
      ).__tools.values(),
    ].map(({ execute: _, ...tool }) => tool),
  );

/** A tool called as an agent would, its answer as WebMCP would serialize it. */
export const call = <T = Record<string, unknown>>(
  page: Page,
  name: string,
  input: Record<string, unknown> = {},
) =>
  page.evaluate(
    async ([name, input]) => {
      const tools = (
        window as unknown as {
          __tools: Map<
            string,
            {
              execute: (
                input: unknown,
                options: { signal: AbortSignal },
              ) => Promise<unknown>;
            }
          >;
        }
      ).__tools;
      const answer = await tools
        .get(name)!
        .execute(input, { signal: new AbortController().signal });
      return JSON.parse(JSON.stringify(answer));
    },
    [name, input] as const,
  ) as Promise<T>;
