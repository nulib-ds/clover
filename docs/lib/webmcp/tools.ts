import { capabilities } from "docs/lib/compose/catalog";
import { layoutSchema } from "docs/lib/compose/layout";
import { MOST_NEEDS } from "docs/lib/compose/suggest";

/**
 * The tools the docs offer agents through WebMCP (AGENTS.md, "Agent tools (WebMCP)"):
 * what each is called, says and takes, written on the server from the catalog, so they
 * name the parts, templates and capabilities Clover has today. The page registers them
 * (`AgentTools.tsx`), and `llms.txt` lists them (`docs/lib/agents.ts`). What each does is
 * `run.ts`, which the page loads the first time one is called.
 *
 * A new helper folds into one of these first (AGENTS.md, "Agent tools (WebMCP)",
 * "Built to grow"); a new tool is a name here, a definition below, a case in
 * `run.ts`, and Mat's agreement.
 */

export const TOOL_NAMES = [
  "clover_suggest_layout",
  "clover_compose_layout",
  "clover_preview_layout",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/** A tool as WebMCP's `registerTool` takes it, but for `execute`, which the page adds. */
export interface ToolDefinition {
  name: ToolName;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /**
   * The draft's hints: it changes nothing; what it answers may hold what the page does
   * not control (a resource it read).
   */
  annotations: { readOnlyHint: boolean; untrustedContentHint?: boolean };
}

/**
 * What Clover is, closing each description, for an agent that meets the tools alone, and
 * that its earlier version is deprecated (Mat, 2026-11-12).
 */
export const CLOVER =
  "Clover (@nulib/clover): a IIIF viewer and its parts, in React or web components. Clover 3.x (@samvera/clover-iiif) is deprecated.";

/**
 * The most each description holds, as Chrome advises for WebMCP's tools (its "Secure
 * tools" guide, read 2026-11-22: past these, agents' guardrails may cut or refuse them):
 * a tool's description, and each of its parameters'. `tools.test.ts` holds them.
 */
export const DESCRIPTION_MOST = 500;
export const PARAMETER_MOST = 150;

/** Each tool, as the page registers it. */
export function agentTools(): ToolDefinition[] {
  const layout = layoutSchema();
  /*
   * Each description says what the tool is for and when to call it, the order the three
   * go in (suggest, compose, preview), and, for a layout, its shape and how it nests, so
   * an agent writes one that holds before a check has to tell it (2026-11-22).
   */
  return [
    {
      name: "clover_suggest_layout",
      title: "Suggest a Clover layout",
      description: `Start here to build with Clover. Finds the parts for what a page needs, in plain words or by name ("3d", "captions", "Items"), or for what a IIIF resource at an address has, read for its structure alone and returned as untrusted data. Gives each part's props and docs, and a layout to pass to clover_compose_layout. With neither, lists all Clover handles. ${CLOVER}`,
      inputSchema: {
        type: "object",
        properties: {
          needs: {
            type: "array",
            /*
             * The words it knows, each a capability or a IIIF property, as examples: a
             * need may be any words, or a part's name, which it matches to these.
             */
            items: { type: "string", examples: Object.keys(capabilities()) },
            maxItems: MOST_NEEDS,
            description:
              'What the page needs, in plain words or by a part\'s name: "3d", "captions", "a map", "metadata", "Items".',
          },
          resource: {
            type: "string",
            description:
              "A IIIF Manifest, Collection, Canvas, Timeline or Scene by its address (https://…), or a content state, read in the user's browser.",
          },
        },
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
    },
    {
      name: "clover_compose_layout",
      title: "Write a Clover layout's code",
      description: `Checks a Clover layout and writes its code, React or (flavor "html") web components, with each part's docs. A layout is { "viewer": { "template": "Document" } }, or parts in a Root, in the page's own elements: { "parts": [{ "part": "Body" }, { "element": "aside", "children": [{ "part": "Metadata" }] }] }. Tab goes in Panel. If it does not hold, it says how to fix it. ${CLOVER}`,
      inputSchema: {
        ...layout,
        properties: {
          ...layout.properties,
          flavor: {
            enum: ["react", "html"],
            description:
              "React, by default, or HTML of Clover's web components.",
          },
        },
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "clover_preview_layout",
      title: "Preview a Clover layout",
      description: `Shows a Clover layout live on the docs page the user has open, with its code, in place of the page's first example until the user restores it. Give a layout, as clover_compose_layout takes it, or a capability ("3d", "captions") to show over a sample; with neither, a part's or template's page shows its own. Changes this page only; moves focus or scrolls only if asked. ${CLOVER}`,
      inputSchema: {
        type: "object",
        properties: {
          layout: {
            type: "object",
            description: "A layout, as clover_compose_layout takes it.",
          },
          capability: {
            type: "string",
            description:
              'A need, as clover_suggest_layout takes one ("3d", "captions", "rights"): shown over a sample that has it, in its own layout unless given one.',
          },
          reveal: {
            type: "boolean",
            description:
              "Bring the preview into view, without moving focus: for when the user asked to see it.",
          },
        },
      },
      annotations: { readOnlyHint: false },
    },
  ];
}
