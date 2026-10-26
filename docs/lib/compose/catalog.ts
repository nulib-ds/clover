import docsMenu from "content/docs/_meta";
import primitivesMenu from "content/docs/primitives/_meta";
import { elementLoads, partLoads, sizes, kB } from "docs/lib/sizes";
import { CAPABILITIES, type Capability } from "docs/lib/compose/capabilities";
import type {
  AttributeType,
  ElementDocs,
  ElementSpec,
} from "../../../packages/clover/src/web-components/spec";
import { DOCS, SPECS } from "../../../packages/clover/src/web-components/specs";

/**
 * What the compose helpers know of Clover (WEBMCP.md): its parts, the Root, the Viewer and
 * its templates, and what each part handles, read from where Clover already says it, so the
 * catalog grows as Clover does:
 *
 * - each part and its props: its element's spec (`SPECS`, with its docs, `DOCS()`), which
 *   every part has for its web component. A new element is a new part here.
 * - the templates: the Viewer's spec, its `template` words, and the props whose
 *   description opens with the templates that read them ("Default and Document: …").
 * - where each is documented: the docs' menus, else `DOCUMENTED_ON`.
 * - what each adds to a page: `sizes.json` (`docs/lib/sizes.ts`).
 * - what each handles: `capabilities.ts`, the one table kept by hand, and the IIIF
 *   property each property part reads, its own name.
 *
 * Kept by hand besides: the few facts no source holds, each a small table below with a
 * test that fails when Clover outgrows it (`catalog.test.ts`).
 */

export type PropType = AttributeType;

/** A prop a layout can give as a plain value: one an attribute carries. */
export interface PropInfo {
  /** Its name in React: `headingLevel`. */
  prop: string;
  /** Its name in HTML: `heading-level`. */
  attribute: string;
  type: PropType;
  /** A number's least value. */
  min?: number;
  description: string;
  default?: string;
}

export interface PartInfo {
  /** As `@nulib/clover` exports it: `RequiredStatement`. */
  name: string;
  /** Its element: `clover-required-statement`. */
  tag: string;
  /** As React's code writes it: `Clover.RequiredStatement`, or `Map`. */
  jsx: string;
  /** Where React imports it from. */
  from: string;
  kind: ElementSpec["kind"];
  /** It draws nothing outside a Root. */
  needsRoot: boolean;
  /** It is read by, and so sits in, one of these parts only: a Tab in a Panel. */
  inside?: readonly string[];
  description: string;
  props: PropInfo[];
  /**
   * What only code can give it, never a layout's plain values: a function, a callback,
   * an object the page builds (`renderers`, `onCanvasChange`).
   */
  codeProps: string[];
  /** Its page in the docs, under the site: `/docs/primitives/rights`; "" for none. */
  docs: string;
  /** The page is its own, in the docs' menu, not one it shares with another part. */
  ownPage: boolean;
  /** What it adds to a page with a Root (or, alone, what a page with it loads), in kB. */
  loads?: { react?: string; html?: string };
  /** What it handles (`capabilities.ts`), and for a property part the property it reads. */
  capabilities: string[];
}

export interface TemplateInfo {
  /** As `@nulib/clover/templates` exports it: `Document`. */
  name: string;
  /** As the element's `template` attribute says it: `document`. */
  word: string;
  description: string;
  /** Its own props, besides the Viewer's. */
  props: PropInfo[];
  /** What a page with a Viewer in it loads, in kB. */
  loads?: string;
}

/** Where React imports a part from, where it is not `@nulib/clover`. */
const ENTRY: Record<string, string> = { Map: "@nulib/clover/map" };

/**
 * The parts whose element only the part around it reads (`kind: "config"`), and those that
 * divide the part around them: where each must sit.
 */
const INSIDE: Record<string, readonly string[]> = {
  Tab: ["Panel"],
  SplitPane: ["Split"],
  SplitHandle: ["Split"],
};

/**
 * What Body draws each container with, as the reader moves (`content/docs/body.mdx`): a
 * layout places Body in a Root, and these alone, for one kind of container.
 */
export const BODY_DRAWS: readonly string[] = ["Canvas", "Timeline", "Scene"];

/**
 * Where a part with no page of its own is documented, as Composing's table of parts
 * links it.
 */
const DOCUMENTED_ON: Record<string, string> = {
  About: "/docs/panel",
  CollectionSelect: "/docs/collection",
  Next: "/docs/items",
  PanelToggle: "/docs/panel",
  Position: "/docs/items",
  Previous: "/docs/items",
  ReadMore: "/docs/composing",
  Split: "/docs/composing",
  SplitHandle: "/docs/composing",
  SplitPane: "/docs/composing",
  Status: "/docs/composing",
  Tab: "/docs/panel",
  Tip: "/docs/composing",
};

/** An element's part: `clover-required-statement` is `RequiredStatement`. */
export const partName = (tag: string) =>
  tag
    .replace(/^clover-/, "")
    .replace(/(^|-)([a-z])/g, (_, __, letter: string) => letter.toUpperCase());

type Entry = string | { title?: string; display?: string };
const titleOf = (entry: Entry) =>
  typeof entry === "string" ? entry : (entry.title ?? "");

/** Each page the docs' menus give a part, by its title, which is the part's name. */
function menuPages(): Record<string, string> {
  const pages: Record<string, string> = {};
  for (const [key, entry] of Object.entries(docsMenu) as [string, Entry][])
    if (!key.startsWith("--")) pages[titleOf(entry)] = `/docs/${key}`;
  for (const [key, entry] of Object.entries(primitivesMenu) as [
    string,
    Entry,
  ][])
    pages[titleOf(entry)] = `/docs/primitives/${key}`;
  return pages;
}

/** The property parts: one IIIF property each, in the primitives' menu. */
const PRIMITIVES = new Set(
  Object.values(primitivesMenu as Record<string, Entry>).map(titleOf),
);

/** An element's props a layout can give, from its spec and its docs. */
function propsOf(spec: ElementSpec, docs: ElementDocs): PropInfo[] {
  return Object.entries(spec.attributes).map(([attribute, read]) => ({
    prop: read.prop,
    attribute,
    type: read.type,
    ...(read.min !== undefined && { min: read.min }),
    description: docs.attributes[attribute]?.description ?? "",
    ...(docs.attributes[attribute]?.default !== undefined && {
      default: docs.attributes[attribute].default,
    }),
  }));
}

/** What only code can give an element: its properties no attribute carries, its callbacks. */
function codePropsOf(spec: ElementSpec) {
  const carried = new Set(Object.values(spec.attributes).map((a) => a.prop));
  return [
    ...(spec.properties ?? []).filter((prop) => !carried.has(prop)),
    ...Object.values(spec.events ?? {}).map((event) => event.prop),
  ];
}

/**
 * The IIIF property a property part reads: its name, as the property is written
 * (`RequiredStatement` reads `requiredStatement`), for a part that reads its root's
 * Manifest or Canvas (`of`).
 */
function propertyOf(name: string, spec: ElementSpec) {
  const of = Object.values(spec.attributes).find((a) => a.prop === "of");
  if (!PRIMITIVES.has(name) || !Array.isArray(of?.type)) return undefined;
  if (!of.type.includes("manifest")) return undefined;
  return name[0].toLowerCase() + name.slice(1);
}

/** The parts each capability names, inverted: what each part handles. */
function capabilitiesByPart() {
  const by: Record<string, string[]> = {};
  for (const [capability, { parts }] of Object.entries(CAPABILITIES) as [
    string,
    Capability,
  ][])
    for (const part of parts) (by[part] ??= []).push(capability);
  return by;
}

/** The elements that are no part to place: the Viewer and the Root, which hold parts. */
const HOLDERS = new Set(["clover-viewer", "clover-root"]);

let built: Catalog | undefined;

export interface Catalog {
  parts: PartInfo[];
  /** The Root's props. */
  root: PropInfo[];
  rootCodeProps: string[];
  /** The Viewer's own props, which every template reads. */
  viewer: PropInfo[];
  viewerCodeProps: string[];
  templates: TemplateInfo[];
}

/** Clover's parts, Root, Viewer and templates, as the compose helpers know them. */
export function catalog(): Catalog {
  if (built) return built;
  const docs = DOCS();
  const pages = menuPages();
  const handles = capabilitiesByPart();
  const loads = (name: string) => {
    const react = (partLoads as Record<string, string>)[name];
    const html = (elementLoads as Record<string, string>)[name];
    return react || html ? { react, html } : undefined;
  };
  const parts = SPECS.filter((spec) => !HOLDERS.has(spec.tag)).map(
    (spec): PartInfo => {
      const name = partName(spec.tag);
      const from = ENTRY[name] ?? "@nulib/clover";
      const property = propertyOf(name, spec);
      return {
        name,
        tag: spec.tag,
        jsx: ENTRY[name] ? name : `Clover.${name}`,
        from,
        kind: spec.kind,
        needsRoot: Boolean(spec.needsRoot),
        ...(INSIDE[name] && { inside: INSIDE[name] }),
        description: docs[spec.tag].description,
        props: propsOf(spec, docs[spec.tag]),
        codeProps: codePropsOf(spec),
        docs: pages[name] ?? DOCUMENTED_ON[name] ?? "",
        ownPage: Boolean(pages[name]),
        ...(loads(name) && { loads: loads(name) }),
        capabilities: [
          ...(handles[name] ?? []),
          ...(property ? [property] : []),
        ],
      };
    },
  );
  const spec = (tag: string) => SPECS.find((each) => each.tag === tag)!;
  const viewerSpec = spec("clover-viewer");
  const viewerProps = propsOf(viewerSpec, docs["clover-viewer"]);
  const words = viewerProps.find((each) => each.prop === "template")!
    .type as readonly string[];
  const names = words.map((word) => word[0].toUpperCase() + word.slice(1));
  const owned = viewerProps.map((prop) => ({
    prop,
    owners: templatesOf(prop.description, names),
  }));
  const described = templateDescriptions(
    docs["clover-viewer"].description,
    names,
  );
  const templates = words.map((word, at): TemplateInfo => {
    const name = names[at];
    const size = (sizes as unknown as Record<string, number>)[
      `${word}TemplateGzip`
    ];
    return {
      name,
      word,
      description: described[name] ?? "",
      props: owned
        .filter(({ owners }) => owners?.includes(name))
        .map(({ prop }) => prop),
      ...(size !== undefined && { loads: kB(size) }),
    };
  });
  built = {
    parts,
    root: propsOf(spec("clover-root"), docs["clover-root"]),
    rootCodeProps: codePropsOf(spec("clover-root")),
    viewer: owned
      .filter(({ owners, prop }) => !owners && prop.prop !== "template")
      .map(({ prop }) => prop),
    viewerCodeProps: codePropsOf(viewerSpec),
    templates,
  };
  return built;
}

/**
 * The templates a Viewer prop belongs to, by its description's opening ("Default and
 * Document: …"), each a template's name; none for a prop every template reads.
 */
export function templatesOf(description: string, names: readonly string[]) {
  const opening = description.match(/^([A-Z]\w*(?:(?:, | and )[A-Z]\w*)*): /);
  if (!opening) return undefined;
  const owners = opening[1].split(/, | and /);
  return owners.every((owner) => names.includes(owner)) ? owners : undefined;
}

/**
 * Each template's description, from the Viewer's: "Default (the title over the Body, …),
 * Document (…) or Gallery (…)".
 */
export function templateDescriptions(
  description: string,
  names: readonly string[],
) {
  const found: Record<string, string> = {};
  for (const name of names) {
    const match = description.match(new RegExp(`\\b${name} \\(([^)]*)\\)`));
    if (match) found[name] = match[1];
  }
  return found;
}

/** A part by its name, as React or HTML writes it: `Label`, `Clover.Label`, `clover-label`. */
export function findPart(name: string) {
  const bare = name.replace(/^Clover\./, "").trim();
  const named = bare.startsWith("clover-") ? partName(bare) : bare;
  return catalog().parts.find((part) => part.name === named);
}

/** A template by its name or its word: `Document`, `document`. */
export const findTemplate = (name: string) =>
  catalog().templates.find(
    (template) => template.name === name || template.word === name,
  );

/**
 * The attribute an element reads a prop from: `headingLevel` is `heading-level`, and
 * React's `defaultX`, where it opens and what moves it later, is `x`'s. Undefined where
 * the element has none for it.
 */
export function attributeFor(tag: string, prop: string) {
  if (prop === "style") return "style";
  const spec = SPECS.find((each) => each.tag === tag);
  if (!spec) return undefined;
  const read = (name: string) =>
    Object.entries(spec.attributes).find(
      ([, attribute]) => attribute.prop === name,
    )?.[0];
  return (
    read(prop) ??
    (/^default[A-Z]/.test(prop)
      ? read(prop[7].toLowerCase() + prop.slice(8))
      : undefined)
  );
}

/** Each capability, with the parts that handle it: `capabilities.ts`, and the properties. */
export function capabilities(): Record<string, Capability> {
  const all: Record<string, Capability> = { ...CAPABILITIES };
  for (const part of catalog().parts)
    for (const name of part.capabilities)
      all[name] ??= {
        says: `The IIIF \`${name}\` property: ${part.description}`,
        parts: [part.name],
        resource: "paged",
      };
  return all;
}
