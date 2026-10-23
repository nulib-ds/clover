import React from "react";

import { elementTag } from "docs/components/Flavored";
import { type LiveDemo, LiveFrame } from "docs/components/Clover4/LiveCode";
import type { PartName } from "docs/components/Clover4/PartDemo";
import {
  LiveTemplates,
  type TemplateName,
} from "docs/components/Clover4/ViewerDocs";
import { resourceByKey } from "docs/components/Playground/playground-config";
import {
  type CodeAttr,
  type CodeNode,
  type CodeStyle,
  type CodeTree,
  type Knob,
  knobId,
  publishedAddress,
} from "docs/lib/live-code";
import { type PartDemoResource, RESOURCES } from "docs/lib/part-demo-resources";
import { SPECS } from "../../../packages/clover/src/web-components/specs";

/**
 * The live examples (Mat, 2026-10-22: the major props of a component, "adjusted by a
 * visiting user", as the homepage's editor adjusts its own): a component page's first
 * example (`LivePart`) and the Viewer's (`LiveTemplates`), whose code the reader edits, the
 * demo following. A page names its knobs as plain data (`Knob`, `docs/lib/live-code.ts`);
 * this, on the server, lays out the elements they sit on, each prop under the attribute
 * its element's spec reads it from, and throws, failing the build, where an element has
 * none for it. The client draws the code and the demo (`LiveCode.tsx`).
 *
 * ```mdx
 * <LivePart
 *   part="Body"
 *   knobs={[
 *     { prop: "controls", value: true },
 *     { prop: "style.height", value: 320, min: 160, max: 560 },
 *   ]}
 *   head={<PartHead part="Body" />}
 * />
 * ```
 *
 * Pick knobs that change what the demo shows at once: a layout, a size, a control.
 */

/** The attribute an element's spec reads a prop from: `headingLevel` is `heading-level`. */
function attributeOf(tag: string, prop: string) {
  if (prop === "style") return "style";
  const spec = SPECS.find((each) => each.tag === tag);
  if (!spec) throw new Error(`LiveExample: no element ${tag}`);
  // An attribute is where it opens and what moves it later: React's `defaultX` is `x`.
  const read = (name: string) =>
    Object.entries(spec.attributes).find(
      ([, attribute]) => attribute.prop === name,
    );
  const found =
    read(prop) ??
    (/^default[A-Z]/.test(prop)
      ? read(prop[7].toLowerCase() + prop.slice(8))
      : undefined);
  if (!found)
    throw new Error(`LiveExample: <${tag}> has no attribute for ${prop}`);
  return found[0];
}

/** A prop's words, as speech says them: `panelLayout` is "panel layout" (WCAG 2.5.3). */
const wordsOf = (name: string) =>
  name
    .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
    .replace(/-/g, " ");

/** A knob's name for assistive technology, from its element and prop, its unit after. */
function labelOf(element: string, knob: Knob) {
  if (knob.label) return knob.label;
  if (!knob.prop.startsWith("style."))
    return `${element} ${wordsOf(knob.prop)}`;
  const name = knob.prop.slice(6);
  const words = wordsOf(name.replace(/^--clover-[a-z]+-/, ""));
  const unit =
    knob.format?.replace("{}", "") ||
    (typeof knob.value === "number" && !name.startsWith("--") ? "px" : "");
  return `${element} ${words}${unit ? `, in ${unit === "px" ? "pixels" : unit}` : ""}`;
}

/**
 * An element's props, as its code writes them: the fixed ones, then its knobs, a style's
 * properties together last.
 */
function attrsOf(
  tag: string,
  fixed: Record<string, unknown>,
  knobs: Knob[],
  style: CodeStyle[] = [],
): CodeAttr[] {
  const attrs: CodeAttr[] = Object.entries(fixed)
    .filter(([prop]) => prop !== "style")
    .map(([prop, value]) => ({
      prop,
      attribute: attributeOf(tag, prop),
      value,
    }));
  const styled = [
    ...style,
    ...Object.entries((fixed.style as Record<string, string>) ?? {}).map(
      ([name, value]) => ({ name, value }),
    ),
  ];
  for (const knob of knobs) {
    if (knob.prop.startsWith("style."))
      styled.push({ name: knob.prop.slice(6), knob: knobId(knob) });
    else
      attrs.push({
        prop: knob.prop,
        attribute: attributeOf(tag, knob.prop),
        knob: knobId(knob),
      });
  }
  if (styled.length)
    attrs.push({ prop: "style", attribute: "style", style: styled });
  return attrs;
}

const url = (tag: string): CodeAttr => ({
  prop: "iiifContent",
  attribute: attributeOf(tag, "iiifContent"),
  url: true,
});

interface LivePartProps {
  /** The part, as `@nulib/clover` exports it, or `Canvas` or `Map`, alone. */
  part: PartName | "Canvas" | "Map";
  /** The values the reader can change, in the order its code writes them. */
  knobs?: Knob[];
  /** Props its code writes, fixed: `of="canvas"`. */
  shown?: Record<string, unknown>;
  /** Props given to the demo alone, as a `PartDemo`'s: a heading level for the page. */
  props?: Record<string, unknown>;
  /** The mock it reads (`part-demo-resources.ts`). Default `paged`. */
  resource?: PartDemoResource;
  /** A `Body` above it, as `PartDemo`'s. */
  body?: boolean;
  /** A box of this height round it, which scrolls, as `PartDemo`'s. */
  box?: string;
  /** Its code without a `Root` (`Value`); `Canvas` and `Map` are always alone. */
  alone?: boolean;
  /** React's imports, where the code is a whole module (`Map`'s own import). */
  imports?: string[];
  /** The page's head, under the code (`PartHead`). */
  head?: React.ReactNode;
}

export function LivePart({
  part,
  knobs = [],
  shown = {},
  props = {},
  resource = "paged",
  body = false,
  box,
  alone = false,
  imports,
  head,
}: LivePartProps) {
  const tag = elementTag(part);
  const named = knobs.map((knob) => ({
    ...knob,
    label: labelOf(knob.on === "root" ? "Root" : part, knob),
  }));
  const on = (where: Knob["on"]) =>
    named.filter((knob) => (knob.on ?? "part") === where);
  const canvas = part === "Canvas";
  const single = alone || canvas || part === "Map";
  const own: CodeNode = {
    jsx: part === "Map" ? "Map" : `Clover.${part}`,
    html: tag,
    attrs: [
      ...(canvas || part === "Map" ? [url(tag)] : []),
      ...attrsOf(tag, shown, on("part")),
    ],
    mark: !single,
  };
  // The box round it: `Canvas` fills one with a height; a tall part scrolls in one.
  const boxed = canvas || box;
  const wrapped: CodeNode = boxed
    ? {
        jsx: "div",
        html: "div",
        attrs: [
          {
            prop: "style",
            attribute: "style",
            style: [
              on("box").some((knob) => knob.prop === "style.height")
                ? { name: "height", knob: "box:style.height" }
                : { name: "height", value: box ?? 420 },
              ...(box ? [{ name: "overflowY", value: "auto" }] : []),
            ],
          },
        ],
        children: [own],
      }
    : own;
  const tree: CodeTree = {
    url: publishedAddress(RESOURCES[resource]),
    imports,
    nodes: [
      single
        ? wrapped
        : {
            jsx: "Clover.Root",
            html: "clover-root",
            attrs: [
              url("clover-root"),
              ...attrsOf("clover-root", {}, on("root")),
            ],
            children: [
              ...(body
                ? [{ jsx: "Clover.Body", html: "clover-body", attrs: [] }]
                : []),
              wrapped,
            ],
          },
    ],
  };
  const demo: LiveDemo = {
    kind: canvas ? "canvas" : part === "Map" ? "map" : "part",
    part,
    props: { ...props, ...shown },
    resource,
    body,
    box,
  };
  return <LiveFrame tree={tree} knobs={named} demo={demo} head={head} />;
}

/**
 * The Viewer page's first example: the template, switched by its large control, and its
 * code live, each template with its own knobs (`templates`, in the order the switch
 * lists them), its imports and its address written out, as a page would write them.
 */
export function LiveViewerExample({
  resource,
  templates,
  headingLevel,
  height,
}: {
  /** A key of the homepage's resources (`playground-config.ts`). */
  resource: string;
  templates: Partial<Record<TemplateName, Knob[]>>;
  headingLevel?: number;
  height?: string;
}) {
  const found = resourceByKey(resource);
  if (!found) throw new Error(`LiveViewerExample: no resource ${resource}`);
  const address = found.mock
    ? publishedAddress(found.resource)
    : found.resource;
  const entries = Object.entries(templates) as [TemplateName, Knob[]][];
  const options = entries.map(([name, knobs]) => {
    const named = knobs.map((knob) => ({
      ...knob,
      label: labelOf(name === "Default" ? "Viewer" : `${name} template`, knob),
    }));
    const own = name !== "Default";
    const tree: CodeTree = {
      url: address,
      imports: [
        'import Viewer from "@nulib/clover";',
        ...(own ? [`import { ${name} } from "@nulib/clover/templates";`] : []),
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
              ? [{ prop: "template", attribute: "template", template: name }]
              : []),
            ...attrsOf("clover-viewer", {}, named),
          ],
        },
      ],
    };
    return { name, knobs: named, tree };
  });
  return (
    <LiveTemplates
      options={options}
      resource={resource}
      headingLevel={headingLevel}
      height={height}
    />
  );
}
