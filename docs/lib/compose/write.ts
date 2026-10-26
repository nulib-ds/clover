import {
  type PartInfo,
  attributeFor,
  findPart,
  findTemplate,
} from "docs/lib/compose/catalog";
import {
  type ComposedLayout,
  type Issue,
  type Layout,
  type LayoutNode,
  type Props,
  type ViewerLayout,
  checkLayout,
  isViewer,
} from "docs/lib/compose/layout";
import {
  type CodeAttr,
  type CodeNode,
  type CodeTree,
  type Flavor,
  codeLines,
  pageAddress,
  textOf,
} from "docs/lib/live-code";

/**
 * A checked layout's code, in React or as HTML (WEBMCP.md), written by the docs' own
 * writer (`live-code.ts`), as every live example's code is: what an agent is handed is
 * what a reader copies from the docs. A whole module, its imports and its resource's
 * address written out, so it runs as it is.
 */

/**
 * The resource a layout without one reads, as the docs' examples do: the IIIF Cookbook's
 * book (`DEFAULT_URL` in `jsx-to-html.mjs`, which a test holds this to; that module
 * loads TypeScript, so it is never imported here).
 */
export const DEFAULT_RESOURCE =
  "https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json";

/** React's names for HTML's own attributes. */
const HTML_NAMES: Record<string, string> = { className: "class" };

/** A node's props as its code writes them, each under the attribute its element reads. */
function attrsOf(tag: string, props: Props = {}): CodeAttr[] {
  const attrs: CodeAttr[] = [];
  for (const [prop, value] of Object.entries(props)) {
    if (prop === "style") continue;
    const attribute =
      HTML_NAMES[prop] ?? (prop === "id" ? "id" : attributeFor(tag, prop));
    // A checked layout names no prop its element lacks; one that did would be left out.
    if (attribute) attrs.push({ prop, attribute, value });
  }
  if (props.style)
    attrs.push({
      prop: "style",
      attribute: "style",
      style: Object.entries(props.style as Record<string, string | number>).map(
        ([name, value]) => ({ name, value }),
      ),
    });
  return attrs;
}

const url = (tag: string): CodeAttr => ({
  prop: "iiifContent",
  attribute: attributeFor(tag, "iiifContent")!,
  url: true,
});

function nodeOf(
  node: LayoutNode,
  inRoot: boolean,
  used: Set<PartInfo>,
): CodeNode {
  const children = (node.children ?? []).map((child) =>
    nodeOf(child, inRoot, used),
  );
  if ("element" in node)
    return {
      jsx: node.element,
      html: node.element,
      attrs: attrsOf(node.element, node.props),
      ...(children.length && { children }),
    };
  const part = findPart(node.part)!;
  used.add(part);
  // Alone, a part that reads a resource reads the layout's.
  const reads =
    !inRoot && part.props.some((prop) => prop.prop === "iiifContent");
  return {
    jsx: part.jsx,
    html: part.tag,
    attrs: [
      ...(reads ? [url(part.tag)] : []),
      ...attrsOf(part.tag, node.props),
    ],
    ...(children.length && { children }),
  };
}

function viewerTree(layout: ViewerLayout, resource: string): CodeTree {
  const template = findTemplate(layout.viewer.template ?? "Default")!;
  const own = template.name !== "Default";
  return {
    url: resource,
    imports: [
      'import Viewer from "@nulib/clover";',
      ...(own
        ? [`import { ${template.name} } from "@nulib/clover/templates";`]
        : []),
      'import "@nulib/clover/styles.css";',
      ...(own ? ['import "@nulib/clover/templates.css";'] : []),
    ],
    nodes: [
      {
        jsx: "Viewer",
        html: "clover-viewer",
        attrs: [
          url("clover-viewer"),
          ...(own
            ? [
                {
                  prop: "template",
                  attribute: "template",
                  template: template.name,
                },
              ]
            : []),
          ...attrsOf("clover-viewer", layout.viewer.props),
        ],
      },
    ],
  };
}

function composedTree(
  layout: ComposedLayout,
  resource: string,
  used: Set<PartInfo>,
): CodeTree {
  const alone = layout.root === false;
  const nodes = layout.parts.map((node) => nodeOf(node, !alone, used));
  const froms = new Set([...used].map((part) => part.from));
  const imports = [
    ...(froms.has("@nulib/clover") || !alone
      ? ['import * as Clover from "@nulib/clover";']
      : []),
    ...[...used]
      .filter((part) => part.from !== "@nulib/clover")
      .map((part) => `import { ${part.name} } from "${part.from}";`),
    'import "@nulib/clover/styles.css";',
  ];
  return {
    url: resource,
    imports: [...new Set(imports)],
    nodes: alone
      ? nodes
      : [
          {
            jsx: "Clover.Root",
            html: "clover-root",
            attrs: [
              url("clover-root"),
              ...attrsOf("clover-root", layout.root || undefined),
            ],
            children: nodes,
          },
        ],
  };
}

/** A part a layout uses: its docs and what it adds to a page, in the chosen flavor. */
export interface UsedPart {
  name: string;
  docs: string;
  /** What it adds to a page, gzipped, as the build measures it: `10.1 kB`. */
  loads?: string;
}

export interface Written {
  flavor: Flavor;
  code: string;
  install: string;
  /** The Viewer's template, with what a page with it loads. */
  template?: { name: string; docs: string; loads?: string };
  parts: UsedPart[];
}

/**
 * A checked layout's code, as the docs' writer takes it (`live-code.ts`): what a live
 * example draws in both flavors, and an agent's preview (`AgentPreview.tsx`).
 */
export function treeOf(layout: Layout, used = new Set<PartInfo>()): CodeTree {
  const resource = layout.resource ?? DEFAULT_RESOURCE;
  return isViewer(layout)
    ? viewerTree(layout, resource)
    : composedTree(layout, resource, used);
}

/** A checked layout's code in one flavor, with what it uses. */
export function writeLayout(layout: Layout, flavor: Flavor = "react"): Written {
  const used = new Set<PartInfo>();
  const tree = treeOf(layout, used);
  const template = isViewer(layout)
    ? findTemplate(layout.viewer.template ?? "Default")!
    : undefined;
  return {
    flavor,
    code: textOf(codeLines(tree, [], {}, flavor)),
    install: "npm install @nulib/clover",
    ...(template && {
      template: {
        name: template.name,
        docs: pageAddress("/docs/viewer#templates"),
        ...(template.loads && { loads: `${template.loads} kB` }),
      },
    }),
    parts: [...used].map((part) => {
      const loads = flavor === "html" ? part.loads?.html : part.loads?.react;
      return {
        name: part.name,
        docs: pageAddress(part.docs),
        ...(loads && { loads: `${loads} kB` }),
      };
    }),
  };
}

export type Composed =
  | ({ ok: true; notes: Issue[] } & Written)
  | { ok: false; issues: Issue[] };

/**
 * A layout as an agent gives it, checked and, where it holds, written: the code, how to
 * install it, and each part's docs and size; else what is wrong with each place, and how
 * to put it right.
 */
export function compose(input: unknown, flavor: Flavor = "react"): Composed {
  const checked = checkLayout(input);
  if (!checked.ok || !checked.layout)
    return { ok: false, issues: checked.issues };
  return {
    ok: true,
    ...writeLayout(checked.layout, flavor),
    notes: checked.issues,
  };
}
