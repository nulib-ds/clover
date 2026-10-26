import { describe, expect, it } from "vitest";

import { catalog } from "docs/lib/compose/catalog";
import { closePreview, registerHost, snapshot } from "./preview-store";
import { run } from "./run";
import { TOOL_NAMES, agentTools } from "./tools";

describe("agentTools", () => {
  const tools = agentTools();

  it("names each tool as WebMCP's draft allows, once", () => {
    // 1 to 128 of ASCII letters and digits, "_", "-" and ".", unique in a document.
    for (const tool of tools)
      expect(tool.name).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
    expect(tools.map((tool) => tool.name)).toEqual([...TOOL_NAMES]);
  });

  it("gives each a title in sentence case, a description and a schema that serializes", () => {
    for (const tool of tools) {
      expect(tool.title).toMatch(/^[A-Z][^A-Z]*Clover[^A-Z]*$/);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(JSON.parse(JSON.stringify(tool.inputSchema))).toEqual(
        tool.inputSchema,
      );
      expect(typeof tool.annotations.readOnlyHint).toBe("boolean");
    }
  });

  it("names the parts and templates Clover has today, from the catalog", () => {
    const compose = tools.find(
      (tool) => tool.name === "clover_compose_layout",
    )!;
    const schema = compose.inputSchema as {
      properties: { flavor: { enum: string[] } };
      $defs: { node: { properties: { part: { enum: string[] } } } };
    };
    expect(schema.$defs.node.properties.part.enum).toEqual(
      catalog().parts.map((part) => part.name),
    );
    expect(schema.properties.flavor.enum).toEqual(["react", "html"]);
  });

  it("has what each tool does, answering in plain data", async () => {
    for (const name of TOOL_NAMES) {
      const answer = await run(name, {});
      expect(answer, name).toBeDefined();
      expect(JSON.parse(JSON.stringify(answer))).toEqual(answer);
    }
    await expect(
      run("clover_compose_layout", {
        flavor: "html",
        parts: [{ part: "Label" }],
      }),
    ).resolves.toMatchObject({ ok: true, flavor: "html" });
  });

  it("marks what reads a resource as untrusted", () => {
    const suggest = tools.find(
      (tool) => tool.name === "clover_suggest_layout",
    )!;
    expect(suggest.annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    expect(suggest.inputSchema).toMatchObject({
      properties: { resource: { type: "string" } },
    });
  });

  it("previews in the page's first example, and only where there is one", async () => {
    await expect(
      run("clover_preview_layout", { capability: "3d" }),
    ).resolves.toMatchObject({
      ok: false,
      says: expect.stringMatching(/no example to draw in/),
    });
    const frame = document.body.appendChild(document.createElement("figure"));
    const key = Symbol("frame");
    const gone = registerHost(key, () => frame, "/docs/primitives/rights");
    await expect(run("clover_preview_layout", {})).resolves.toMatchObject({
      ok: true,
      shows: "Rights",
      page: "Rights",
    });
    expect(snapshot().shown).toMatchObject({ host: key, reveal: false });
    closePreview();
    gone();
    frame.remove();
  });

  it("changes the page, and says so", () => {
    expect(
      tools.find((tool) => tool.name === "clover_preview_layout")?.annotations,
    ).toEqual({ readOnlyHint: false });
  });
});
