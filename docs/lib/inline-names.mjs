/**
 * Clover's names in a page's prose, as web components write them (Mat, 2026-10-22: the
 * header's switch drives everything a reader sees, not only the examples' code): a part,
 * `Root` or `<Clover.Root>`, is `<clover-root>`; a prop, `iiifContent`, its attribute,
 * `iiif-content`, or its property, `.renderValue`; a callback, `onCanvasChange`, its event,
 * `clover-canvas-change`; a hook, `useNavigation()`, the root's API, `root.clover.navigation()`;
 * a part written as JSX, `<Clover.Items layout="pager" />`, its element's HTML. From the
 * elements' specs, so a name the elements have no word for stays as written, in both.
 */
import { jsxToHtml } from "./jsx-to-html.mjs";

/** `see-also` as `SeeAlso`. */
const pascal = (name) =>
  name.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase());

/** React's hooks for a part of your own, and what `root.clover` has for each. */
const HOOKS = {
  useClover: "root.clover",
  useNavigation: "root.clover.navigation()",
  useVisibleCanvases: "root.clover.visibleCanvases()",
  useActiveCanvas: "root.clover.activeCanvas()",
  useSequence: "root.clover.sequence()",
  useManifest: "root.clover.manifest()",
  useStatus: "root.clover.status()",
  useAnnotationSets: "root.clover.annotationSets()",
  useOneOpen: "root.clover.oneOpen()",
};

/** React's helpers that `root.clover` has a method for. */
const HELPERS = {
  tableOfContents: "root.clover.contents()",
};

/** The elements' words, read once from their specs. */
export function namesOf(specs) {
  const tags = new Map();
  const props = new Map();
  for (const spec of specs) {
    tags.set(pascal(spec.tag.replace(/^clover-/, "")), spec.tag);
    for (const [attribute, { prop }] of Object.entries(spec.attributes))
      if (!props.has(prop)) props.set(prop, attribute);
    for (const [event, { prop }] of Object.entries(spec.events ?? {}))
      if (!props.has(prop)) props.set(prop, event);
  }
  // A property only where no element has the prop as an attribute.
  for (const spec of specs)
    for (const prop of spec.properties ?? [])
      if (!props.has(prop)) props.set(prop, `.${prop}`);
  return { tags, props, specs };
}

/**
 * A name as web components write it, or `null` where they write it the same or have no
 * word for it.
 */
export function webNameOf(text, names) {
  const value = text.trim();
  // A part, however React writes it: `Clover.Label`, `<Clover.Label />`, `<Label>`, `Label`.
  const part = value.match(
    /^(?:<\/?)?(?:Clover\.)?([A-Z][A-Za-z]*)(?:\s*\/?>)?$/,
  );
  if (part && names.tags.has(part[1])) return `<${names.tags.get(part[1])}>`;
  // A part written as JSX, with its props: its element's HTML, on one line.
  if (/^<Clover\.[A-Z]/.test(value)) {
    const turned = jsxToHtml(value, { specs: names.specs });
    if (turned.html && !turned.html.includes("\n")) return turned.html;
    return null;
  }
  // A hook, or a helper the root has a method for.
  const hook = value.match(/^(use[A-Z]\w*)(\(\))?$/);
  if (hook && HOOKS[hook[1]]) return HOOKS[hook[1]];
  const helper = value.match(/^([a-z]\w*)(\([^)]*\))?$/);
  if (helper && HELPERS[helper[1]]) return HELPERS[helper[1]];
  // A prop or a callback, alone or with a plain value.
  const prop = value.match(
    /^([a-z][A-Za-z]*)(?:=(?:\{(true|false|-?\d+(?:\.\d+)?)\}|"([^"]*)"))?$/,
  );
  if (prop && names.props.has(prop[1])) {
    const name = names.props.get(prop[1]);
    const given = prop[2] ?? prop[3];
    const web =
      given === undefined || name.startsWith(".") || name.startsWith("clover-")
        ? name
        : `${name}="${given}"`;
    return web === value ? null : web;
  }
  return null;
}
