import { capabilities, catalog, findPart } from "docs/lib/compose/catalog";
import {
  type Issue,
  type Layout,
  type LayoutNode,
  checkLayout,
  isViewer,
} from "docs/lib/compose/layout";
import { suggest } from "docs/lib/compose/suggest";
import { treeOf } from "docs/lib/compose/write";
import { type CodeTree, publishedAddress } from "docs/lib/live-code";
import { type PartDemoResource, RESOURCES } from "docs/lib/part-demo-resources";

/**
 * What an agent's preview draws (WEBMCP.md, phase 4), worked out before the page draws it:
 * the layout, checked; the resource it is drawn over, the agent's own or a sample that has
 * what was asked for (`capabilities.ts`); and its code. It knows the page it is on: on a
 * part's page, given nothing, it shows that part, and on the Viewer's, the Viewer
 * (Mat, 2026-10-26: "would show_capability not help for primitives? context of each
 * page?"). Plain data, so the tool works it out and the page draws it
 * (`AgentPreview.tsx`).
 */

export interface PreviewPlan {
  /** The layout, checked, as the page draws it. */
  layout: Layout;
  /** The sample it is drawn over, where the layout names no resource. */
  sample?: PartDemoResource;
  /** The resource it is drawn over, as a page would read it: a sample's published address. */
  address: string;
  /** Its code, over that resource. */
  tree: CodeTree;
  /** What it shows, by name: `Label, Body and Items`, or `the Viewer (Document)`. */
  shows: string;
  /** The page's own part, when the preview started from it. */
  page?: string;
  notes: string[];
}

export type Planned =
  | { ok: true; plan: PreviewPlan }
  | { ok: false; says: string; issues?: Issue[] };

/** What a docs page is about: its part, or the Viewer; nothing for the rest. */
export function pageSubject(route: string) {
  if (route === "/docs/viewer") return "Viewer";
  return catalog().parts.find((part) => part.ownPage && part.docs === route)
    ?.name;
}

/** A part's sample: the first of its capabilities with one. */
const sampleOfPart = (name: string) => {
  const all = capabilities();
  return findPart(name)
    ?.capabilities.map((capability) => all[capability]?.resource)
    .find(Boolean);
};

/** The parts a layout places, in order. */
export function partsOf(nodes: LayoutNode[]): string[] {
  return nodes.flatMap((node) => [
    ...("part" in node ? [node.part] : []),
    ...partsOf(node.children ?? []),
  ]);
}

const listed = (names: string[]) =>
  names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
    : (names[0] ?? "");

/**
 * The layout as the page draws it: a part that titles what it holds takes the level one
 * below the page's title (`headingLevel` 2), where the preview sits, so the page's outline
 * stays true (AGENTS.md), unless the layout set it.
 */
function outlined(layout: Layout, notes: string[]): Layout {
  if (isViewer(layout)) return layout;
  const inRoot = layout.root !== false;
  const set: string[] = [];
  const walk = (nodes: LayoutNode[]): LayoutNode[] =>
    nodes.map((node) => {
      if ("element" in node)
        return node.children
          ? { ...node, children: walk(node.children) }
          : node;
      const info = findPart(node.part)?.props.find(
        (prop) => prop.prop === "headingLevel",
      );
      const where = info?.description.match(/^(Alone|Inside a root):/)?.[1];
      const reads = info && !(where === "Alone" && inRoot);
      if (!reads || node.props?.headingLevel !== undefined) return node;
      set.push(node.part);
      return { ...node, props: { ...node.props, headingLevel: 2 } };
    });
  const parts = walk(layout.parts);
  if (set.length)
    notes.push(
      `Gave ${listed(set)} headingLevel 2: the preview sits under the page's title.`,
    );
  return { ...layout, parts };
}

/**
 * A preview, from what an agent gives (`layout`, `capability`) on the page at `route`.
 */
export function planPreview(input: unknown, route: string): Planned {
  const given =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const notes: string[] = [];
  const all = capabilities();
  let layout: Layout | undefined;
  let sample: PartDemoResource | undefined;
  let page: string | undefined;

  if (given.capability !== undefined && typeof given.capability !== "string")
    return { ok: false, says: 'The capability is a word: "3d", "captions".' };

  // What it asks for: a capability's sample, and, without a layout, its layout.
  if (typeof given.capability === "string") {
    const asked = suggest({ needs: [given.capability] });
    if (!asked.ok || !("handled" in asked))
      return { ok: false, says: "No capability given." };
    const [handled] = asked.handled;
    if (!handled)
      return {
        ok: false,
        says: asked.unknown?.[0]?.says ?? "Clover has nothing by that name.",
      };
    sample = handled.capability
      ? all[handled.capability].resource
      : sampleOfPart(handled.part!);
    if (given.layout === undefined) {
      if (!asked.layout)
        return {
          ok: false,
          says: asked.notes[0] ?? `Nothing to show for "${given.capability}".`,
        };
      layout = asked.layout;
      notes.push(...asked.notes);
    }
  }

  if (given.layout !== undefined) {
    const checked = checkLayout(given.layout);
    if (!checked.ok || !checked.layout)
      return {
        ok: false,
        says: "The layout does not hold.",
        issues: checked.issues,
      };
    layout = checked.layout;
    notes.push(...checked.issues.map((issue) => `${issue.at}: ${issue.says}`));
  }

  // Given nothing, the page's own part, or its Viewer.
  if (!layout) {
    page = pageSubject(route);
    if (!page)
      return {
        ok: false,
        says: "Give a layout or a capability. On a component's page, or the Viewer's, given neither, it shows the page's own.",
      };
    if (page === "Viewer") layout = { viewer: {} };
    else {
      const own = suggest({ needs: [page] });
      if (!own.ok || !("handled" in own) || !own.layout)
        return {
          ok: false,
          says:
            (own.ok && "notes" in own && own.notes[0]) ||
            `${page} needs your page's own content: see its docs.`,
        };
      layout = own.layout;
      notes.push(...own.notes);
      sample = sampleOfPart(page);
    }
  }

  // Drawn over the agent's resource, else a sample that has what it shows.
  if (!layout.resource && !sample) {
    const placed = isViewer(layout) ? [] : partsOf(layout.parts);
    sample = placed.map(sampleOfPart).find(Boolean);
  }
  if (!layout.resource) sample ??= "paged";
  const drawn = outlined(layout, notes);
  const address = layout.resource ?? publishedAddress(RESOURCES[sample!]);
  const shows = isViewer(drawn)
    ? `the Viewer${drawn.viewer.template ? ` (${drawn.viewer.template})` : ""}`
    : listed([...new Set(partsOf(drawn.parts))]);
  return {
    ok: true,
    plan: {
      layout: drawn,
      ...(!layout.resource && { sample }),
      address,
      tree: treeOf({ ...drawn, resource: address }),
      shows,
      ...(page && { page }),
      notes,
    },
  };
}
