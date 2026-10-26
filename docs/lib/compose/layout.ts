import {
  type PropInfo,
  catalog,
  findPart,
  findTemplate,
} from "docs/lib/compose/catalog";

/**
 * A layout, as the compose helpers take it (WEBMCP.md): plain data an agent can write, from
 * which `write.ts` writes the code in either flavor. Either the Viewer in a template, or a
 * layout of the reader's own: parts in a Root, in the page's own elements where it needs
 * them (an `aside`). Every name and prop is checked against the catalog, which reads
 * Clover's specs, so a part or prop Clover gains is one a layout can name.
 *
 * ```json
 * { "resource": "https://…/manifest.json",
 *   "parts": [{ "part": "Body" }, { "part": "Items", "props": { "layout": "grid" } }] }
 * ```
 */

export type Props = Record<string, unknown>;

/** The page's own elements a layout may arrange parts in. */
export const ELEMENTS = [
  "div",
  "section",
  "aside",
  "header",
  "footer",
  "nav",
] as const;

export type ElementName = (typeof ELEMENTS)[number];

export interface PartNode {
  /** The part, as `@nulib/clover` exports it: `Body`. */
  part: string;
  props?: Props;
  children?: LayoutNode[];
}

export interface ElementNode {
  element: ElementName;
  /** `id`, `className` and `style` only. */
  props?: Props;
  children?: LayoutNode[];
}

export type LayoutNode = PartNode | ElementNode;

export interface ViewerLayout {
  /** What to show: a Manifest, Collection or Canvas by its address, or a content state. */
  resource?: string;
  viewer: { template?: string; props?: Props };
}

export interface ComposedLayout {
  resource?: string;
  /** The Root's props; `false` for parts drawn alone, with no Root (`Canvas`, `Map`). */
  root?: Props | false;
  parts: LayoutNode[];
}

export type Layout = ViewerLayout | ComposedLayout;

export const isViewer = (layout: Layout): layout is ViewerLayout =>
  "viewer" in layout;

/** Something a check found: an error stops the code; a note says what was changed. */
export interface Issue {
  level: "error" | "note";
  /** Where: `parts[1].props.layout`. */
  at: string;
  says: string;
}

/** Props any part or element takes as the page's own: written as HTML writes them. */
export const OWN_PROPS = ["id", "className", "style"] as const;

/** The closest of some names to one that is not among them, for "Did you mean…". */
export function closest(name: string, names: readonly string[]) {
  const lower = name.toLowerCase();
  const same = names.find((each) => each.toLowerCase() === lower);
  if (same) return same;
  let best: string | undefined;
  let least = Math.max(2, Math.floor(name.length / 3)) + 1;
  for (const each of names) {
    const other = each.toLowerCase();
    if (other.includes(lower) || lower.includes(other)) return each;
    const apart = distance(lower, other);
    if (apart < least) [best, least] = [each, apart];
  }
  return best;
}

/** Levenshtein's distance: the edits from one word to another. */
function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, at) => at);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        row[j] + 1,
        next[j - 1] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
}

const didYouMean = (name: string, names: readonly string[]) => {
  const near = closest(name, names);
  return near ? ` Did you mean \`${near}\`?` : "";
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A prop's value, as its type takes it, or why it cannot be: a word of a list in its own
 * case, `"false"` as `false`, a number or a boolean written as text read as itself.
 */
function valueOf(
  info: PropInfo,
  value: unknown,
): { value: unknown } | { error: string } {
  const { type } = info;
  if (Array.isArray(type)) {
    const words = type as readonly string[];
    if (value === false && words.includes("false")) return { value: false };
    if (typeof value === "string") {
      const word = words.find((each) => each === value.toLowerCase());
      if (word === "false") return { value: false };
      if (word) return { value: word };
    }
    return { error: `is one of ${words.join(", ")}.` };
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return { value };
    if (value === "true" || value === "false")
      return { value: value === "true" };
    return { error: "is true or false." };
  }
  if (type === "number") {
    const number =
      typeof value === "string" && value.trim() ? Number(value) : value;
    if (typeof number !== "number" || !Number.isFinite(number))
      return { error: "is a number." };
    if (info.min !== undefined && number < info.min)
      return { error: `is a number, ${info.min} or more.` };
    return { value: number };
  }
  if (type === "string") {
    if (typeof value === "string") return { value };
    return {
      error: info.default ? `is text, such as "${info.default}".` : "is text.",
    };
  }
  // Data: text (a URL), or JSON.
  if (value === undefined || typeof value === "function")
    return { error: "is text or JSON." };
  return { value };
}

/** What the page's own props may hold. */
function ownProp(name: string, value: unknown): string | undefined {
  if (name === "style")
    return isObject(value) &&
      Object.values(value).every(
        (each) => typeof each === "string" || typeof each === "number",
      )
      ? undefined
      : "is an object of CSS properties, as React writes them: { height: 320 }.";
  return typeof value === "string" ? undefined : "is text.";
}

interface PropsCheck {
  /** Where the props are: `parts[0].props`. */
  at: string;
  /** Whose: `Items`, `The Root`, `Default`. */
  whose: string;
  infos: PropInfo[];
  /** What only code gives it: left out, with a note. */
  codeProps?: string[];
  /** Props of other owners (another template's), and whose they are. */
  elsewhere?: Record<string, string>;
  /** Taken elsewhere in the layout: `iiifContent` is its `resource`. */
  skip?: Record<string, string>;
  /** A part's place: in a Root or alone, for the props it reads in one place only. */
  inRoot?: boolean;
  issues: Issue[];
}

/**
 * Where a part reads a prop, as its spec's description opens: "Alone: …" or "Inside a
 * root: …"; anywhere, else.
 */
const readWhere = (info: PropInfo) =>
  info.description.match(/^(Alone|Inside a root):/)?.[1];

/** Props, checked: each by its React name, an HTML name read as it, its value read. */
function checkProps(props: unknown, check: PropsCheck): Props {
  const { at, whose, infos, issues } = check;
  if (props === undefined) return {};
  if (!isObject(props)) {
    issues.push({ level: "error", at, says: "Props are an object." });
    return {};
  }
  const checked: Props = {};
  for (const [given, value] of Object.entries(props)) {
    const where = `${at}.${given}`;
    if ((OWN_PROPS as readonly string[]).includes(given)) {
      const wrong = ownProp(given, value);
      if (wrong)
        issues.push({
          level: "error",
          at: where,
          says: `\`${given}\` ${wrong}`,
        });
      else checked[given] = value;
      continue;
    }
    if (given === "class") {
      issues.push({
        level: "note",
        at: where,
        says: "Read `class` as `className`.",
      });
      checked.className = String(value);
      continue;
    }
    if (check.skip?.[given]) {
      issues.push({ level: "note", at: where, says: check.skip[given] });
      continue;
    }
    if (check.codeProps?.includes(given)) {
      issues.push({
        level: "note",
        at: where,
        says: `Left out \`${given}\`: only code gives it (a function or an object your page builds). Add it to the code by hand.`,
      });
      continue;
    }
    const info =
      infos.find((each) => each.prop === given) ??
      infos.find((each) => each.attribute === given) ??
      (/^default[A-Z]/.test(given)
        ? infos.find(
            (each) => each.prop === given[7].toLowerCase() + given.slice(8),
          )
        : undefined);
    if (!info) {
      const other = check.elsewhere?.[given];
      issues.push({
        level: "error",
        at: where,
        says: other
          ? `\`${given}\` is ${other}'s: ${whose} does not read it.`
          : `${whose} has no prop \`${given}\`.${didYouMean(
              given,
              infos.map((each) => each.prop),
            )} Its props: ${infos.map((each) => each.prop).join(", ") || "none"}.`,
      });
      continue;
    }
    if (info.prop !== given)
      issues.push({
        level: "note",
        at: where,
        says: `Read \`${given}\` as \`${info.prop}\`.`,
      });
    const read = valueOf(info, value);
    if ("error" in read) {
      issues.push({
        level: "error",
        at: where,
        says: `${whose}'s \`${info.prop}\` ${read.error}`,
      });
      continue;
    }
    checked[info.prop] = read.value;
    const only = readWhere(info);
    if (
      check.inRoot !== undefined &&
      only &&
      (only === "Alone") === check.inRoot
    )
      issues.push({
        level: "note",
        at: where,
        says: `${whose} reads \`${info.prop}\` only ${only === "Alone" ? "alone, outside a Root" : "inside a Root"}: here it does nothing.`,
      });
  }
  return checked;
}

/** A part's or an element's children, each checked in turn. */
function checkNodes(
  nodes: unknown,
  at: string,
  inRoot: boolean,
  parent: string | undefined,
  issues: Issue[],
): LayoutNode[] {
  if (nodes === undefined) return [];
  if (!Array.isArray(nodes)) {
    issues.push({ level: "error", at, says: "Children are a list of nodes." });
    return [];
  }
  return nodes.flatMap((node, index) => {
    const here = `${at}[${index}]`;
    const checked = checkNode(node, here, inRoot, parent, issues);
    return checked ? [checked] : [];
  });
}

function checkNode(
  node: unknown,
  at: string,
  inRoot: boolean,
  parent: string | undefined,
  issues: Issue[],
): LayoutNode | undefined {
  if (!isObject(node)) {
    issues.push({
      level: "error",
      at,
      says: 'A node is an object: { "part": "Body" } or { "element": "aside", "children": […] }.',
    });
    return undefined;
  }
  if (typeof node.element === "string") {
    const element = node.element.toLowerCase() as ElementName;
    if (!ELEMENTS.includes(element)) {
      issues.push({
        level: "error",
        at: `${at}.element`,
        says: `A layout's own elements are ${ELEMENTS.join(", ")}.${didYouMean(node.element, ELEMENTS)}`,
      });
      return undefined;
    }
    const props = checkProps(node.props, {
      at: `${at}.props`,
      whose: `An \`${element}\``,
      infos: [],
      issues,
    });
    const children = checkNodes(
      node.children,
      `${at}.children`,
      inRoot,
      parent,
      issues,
    );
    return {
      element,
      ...(Object.keys(props).length && { props }),
      ...(children.length && { children }),
    };
  }
  if (typeof node.part !== "string") {
    issues.push({
      level: "error",
      at,
      says: 'A node names a part ("part": "Body") or an element ("element": "aside").',
    });
    return undefined;
  }
  const part = findPart(node.part);
  if (!part) {
    issues.push({
      level: "error",
      at: `${at}.part`,
      says: `Clover has no part \`${node.part}\`.${didYouMean(
        node.part,
        catalog().parts.map((each) => each.name),
      )}`,
    });
    return undefined;
  }
  if (part.needsRoot && !inRoot)
    issues.push({
      level: "error",
      at,
      says: `${part.name} draws nothing outside a Root: place it in one (leave out \`root: false\`).`,
    });
  if (part.inside && !(parent && part.inside.includes(parent)))
    issues.push({
      level: "error",
      at,
      says: `${part.name} sits in ${part.inside.join(" or ")}, which reads it.`,
    });
  const props = checkProps(node.props, {
    at: `${at}.props`,
    whose: part.name,
    infos: part.props,
    codeProps: part.codeProps,
    inRoot,
    issues,
  });
  const children = checkNodes(
    node.children,
    `${at}.children`,
    inRoot,
    part.name,
    issues,
  );
  return {
    part: part.name,
    ...(Object.keys(props).length && { props }),
    ...(children.length && { children }),
  };
}

export interface Checked {
  /** The layout as it was read: names and values as Clover's code writes them. */
  layout?: Layout;
  issues: Issue[];
  ok: boolean;
}

const RESOURCE_NOTE =
  "Read `iiifContent` as the layout's `resource`, which the code writes there.";

/** A layout, checked against Clover's parts, props and templates, and read as its code is. */
export function checkLayout(input: unknown): Checked {
  const issues: Issue[] = [];
  const done = (layout?: Layout): Checked => ({
    ...(layout && { layout }),
    issues,
    ok: !issues.some((issue) => issue.level === "error"),
  });
  if (!isObject(input)) {
    issues.push({ level: "error", at: "", says: "A layout is an object." });
    return done();
  }
  let resource =
    typeof input.resource === "string" && input.resource.trim()
      ? input.resource.trim()
      : undefined;
  if (input.resource !== undefined && !resource)
    issues.push({
      level: "error",
      at: "resource",
      says: "The resource is an address, or a content state, as text.",
    });
  const {
    parts: allParts,
    root,
    rootCodeProps,
    viewer,
    viewerCodeProps,
    templates,
  } = catalog();

  if ("viewer" in input) {
    const given = isObject(input.viewer) ? input.viewer : {};
    const named =
      typeof given.template === "string" ? given.template : "Default";
    const template = findTemplate(named);
    if (!template) {
      issues.push({
        level: "error",
        at: "viewer.template",
        says: `The templates are ${templates.map((each) => each.name).join(", ")}.${didYouMean(
          named,
          templates.map((each) => each.name),
        )}`,
      });
      return done();
    }
    const elsewhere: Record<string, string> = {};
    for (const other of templates)
      for (const prop of other.props)
        if (!template.props.includes(prop))
          elsewhere[prop.prop] ??= templates
            .filter((each) => each.props.includes(prop))
            .map((each) => each.name)
            .join(" and ");
    const props = checkProps(given.props, {
      at: "viewer.props",
      whose: template.name === "Default" ? "The Viewer" : template.name,
      infos: [...viewer, ...template.props],
      codeProps: viewerCodeProps.filter((prop) => prop !== "iiifContent"),
      elsewhere,
      skip: {
        iiifContent: RESOURCE_NOTE,
        template: "The template is `viewer.template`.",
      },
      issues,
    });
    const iiifContent = isObject(given.props) && given.props.iiifContent;
    if (!resource && typeof iiifContent === "string") resource = iiifContent;
    return done({
      ...(resource && { resource }),
      viewer: {
        ...(template.name !== "Default" && { template: template.name }),
        ...(Object.keys(props).length && { props }),
      },
    });
  }

  if (!Array.isArray(input.parts)) {
    issues.push({
      level: "error",
      at: "",
      says: 'Give `parts`, a layout of your own ({ "parts": [{ "part": "Body" }] }), or `viewer`, the Viewer in a template ({ "viewer": { "template": "Document" } }).',
    });
    return done();
  }
  const alone = input.root === false;
  const rootProps = alone
    ? {}
    : checkProps(input.root, {
        at: "root",
        whose: "The Root",
        infos: root,
        codeProps: rootCodeProps.filter((prop) => prop !== "iiifContent"),
        skip: { iiifContent: RESOURCE_NOTE },
        issues,
      });
  const iiifContent = isObject(input.root) && input.root.iiifContent;
  if (!resource && typeof iiifContent === "string") resource = iiifContent;
  const parts = checkNodes(input.parts, "parts", !alone, undefined, issues);
  if (!parts.length && !issues.length)
    issues.push({
      level: "error",
      at: "parts",
      says: `Name a part or more: ${allParts.map((each) => each.name).join(", ")}.`,
    });
  return done({
    ...(resource && { resource }),
    ...(alone
      ? { root: false as const }
      : Object.keys(rootProps).length && { root: rootProps }),
    parts,
  });
}

/**
 * The layout's JSON Schema, for a tool's input: the names it may use, from the catalog;
 * the props it checks itself, saying what is wrong with the fix.
 */
export function layoutSchema() {
  const { parts, templates } = catalog();
  const props = {
    type: "object",
    description:
      "Props, by React's names (headingLevel), as plain values: text, numbers, true or false, or JSON. id, className and style (CSS as React writes it) on any.",
  };
  return {
    type: "object",
    properties: {
      resource: {
        type: "string",
        description:
          "What to show: a IIIF Manifest, Collection or Canvas by its address, or a content state.",
      },
      viewer: {
        type: "object",
        description: "The Viewer, in one of its templates. Give this or parts.",
        properties: {
          template: { enum: templates.map((each) => each.name) },
          props,
        },
      },
      root: {
        description:
          "The Root's props; false for parts drawn alone, with no Root (Canvas, Timeline, Scene, Map, Value).",
        oneOf: [props, { const: false }],
      },
      parts: {
        type: "array",
        description:
          "A layout of your own: parts in a Root, in elements of the page's where it needs them.",
        items: { $ref: "#/$defs/node" },
      },
    },
    $defs: {
      node: {
        type: "object",
        properties: {
          part: { enum: parts.map((each) => each.name) },
          element: { enum: [...ELEMENTS] },
          props,
          children: { type: "array", items: { $ref: "#/$defs/node" } },
        },
      },
    },
  };
}
