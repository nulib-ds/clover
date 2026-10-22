/**
 * The elements' types and their Custom Elements Manifest, written from their specs
 * (`src/web-components/specs/`), so what an editor completes, what the docs' tables say and
 * what the elements do come from one table. Run by `npm run build:web-components`, after
 * the element build:
 *
 * - `dist/web-components/index.d.mts`: each element's interface (its properties), every
 *   tag in `HTMLElementTagNameMap`, every event in `GlobalEventHandlersEventMap`, and the
 *   entry's exports.
 * - `dist/web-components/custom-elements.json`: the manifest (schema 2.0.0), for editors,
 *   the docs and agents.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "dist/web-components");
const MODULE = "dist/web-components/index.mjs";

/** The specs and their docs, read from source: plain data, bundled for node. */
export async function readSpecs() {
  const { outputFiles } = await build({
    entryPoints: [resolve(root, "src/web-components/specs/index.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
  });
  const code = Buffer.from(outputFiles[0].text).toString("base64");
  const { SPECS, DOCS, HANDLE } = await import(
    `data:text/javascript;base64,${code}`
  );
  return { SPECS, DOCS: typeof DOCS === "function" ? DOCS() : DOCS, HANDLE };
}

/** An attribute's type, as the manifest and the docs write it. */
function attributeType(type) {
  if (Array.isArray(type)) return type.map((word) => `"${word}"`).join(" | ");
  return type === "data" ? "string" : type;
}

/** What an element's events keep, as read-only properties (`keeps`): its handle, its API. */
const keptOf = (spec) =>
  Object.values(spec.events ?? {})
    .map((event) => event.keeps)
    .filter(Boolean);

/** Every doc an element needs, present: a spec without one fails the build. */
function checkDocs(spec, docs) {
  if (!docs) throw new Error(`${spec.tag} has no docs`);
  const missing = [
    ...Object.keys(spec.attributes).filter((name) => !docs.attributes[name]),
    ...[...(spec.properties ?? []), ...keptOf(spec)].filter(
      (name) => !docs.properties?.[name],
    ),
    ...Object.keys(spec.events ?? {}).filter((name) => !docs.events?.[name]),
    ...(spec.slots ?? [])
      .filter((name) => !docs.slots?.[name])
      .map((name) => `slot ${name}`),
  ];
  if (missing.length) {
    throw new Error(`${spec.tag}: no docs for ${missing.join(", ")}`);
  }
}

export function manifestOf(SPECS, DOCS) {
  const declarations = SPECS.map((spec) => {
    const docs = DOCS[spec.tag];
    checkDocs(spec, docs);
    return {
      kind: "class",
      customElement: true,
      tagName: spec.tag,
      name: docs.name,
      description: docs.description,
      superclass: { name: "HTMLElement" },
      attributes: Object.entries(spec.attributes).map(([name, attribute]) => ({
        name,
        type: { text: attributeType(attribute.type) },
        description: docs.attributes[name].description,
        ...(docs.attributes[name].default !== undefined
          ? { default: docs.attributes[name].default }
          : {}),
        ...((spec.properties ?? []).includes(attribute.prop)
          ? { fieldName: attribute.prop }
          : {}),
      })),
      members: [...keptOf(spec), ...(spec.properties ?? [])].map((name) => ({
        kind: "field",
        name,
        type: { text: docs.properties[name].type },
        description: docs.properties[name].description,
        ...(docs.properties[name].readonly ? { readonly: true } : {}),
      })),
      events: Object.keys(spec.events ?? {}).map((name) => ({
        name,
        type: { text: `CustomEvent<${docs.events[name].detail}>` },
        description: docs.events[name].description,
      })),
      slots: (spec.slots ?? []).map((name) => ({
        name,
        description: docs.slots[name].description,
      })),
    };
  });
  return {
    schemaVersion: "2.0.0",
    readme: "",
    modules: [
      {
        kind: "javascript-module",
        path: MODULE,
        declarations,
        exports: declarations.map((declaration) => ({
          kind: "custom-element-definition",
          name: declaration.tagName,
          declaration: { name: declaration.name, module: MODULE },
        })),
      },
    ],
  };
}

const comment = (text, indent = "") =>
  `${indent}/** ${text.replace(/\*\//g, "* /")} */\n`;

/** A method as the types declare it: `zoomBy(factor: number, at?: CloverPoint): void`. */
const signature = (name, { parameters, returns }) =>
  `${name}(${parameters.map(([given, type]) => `${given}: ${type}`).join(", ")}): ${returns}`;

/** The types the API is written in (`web-components-api.d.ts`), its own comment dropped. */
const API = readFileSync(
  resolve(root, "build/web-components-api.d.ts"),
  "utf8",
).replace(/^\/\*[\s\S]*?\*\/\n\n/, "");

/** The Canvas's handle, from its methods' docs (`HANDLE`, `specs/canvas.ts`). */
function handleOf(methods) {
  let text =
    comment(
      "The Canvas's handle (onReady in React): the camera and its coordinates. The stage's elements keep it as handle.",
    ) +
    "export interface CloverCanvasHandle {\n" +
    '  readonly backendKind: "webgl2" | "canvas2d" | "none";\n' +
    comment(
      "Whether the view is at home, fitted whole: false once the reader zooms, pans or turns it.",
      "  ",
    ) +
    "  readonly atHome: boolean;\n";
  for (const [name, method] of Object.entries(methods)) {
    text += comment(method.description, "  ");
    text += `  ${signature(name, method)};\n`;
  }
  return `${text}}\n`;
}

/** The viewer entry's types: what it exports, and the elements' declarations with them. */
export const VIEWER_TYPES =
  "/*\n * @nulib/clover/web-components/viewer: `<clover-viewer>` alone, built whole. Its types\n" +
  " * are the elements' (`../index.d.mts`), whose declarations come with them.\n */\n\n" +
  'export { initCloverI18n } from "../index.mjs";\n' +
  'export type { CloverI18nOptions, CloverViewerElement } from "../index.mjs";\n';

export function typesOf(SPECS, DOCS, HANDLE = {}) {
  const events = new Map();
  let text =
    "/*\n * @nulib/clover/web-components: Clover's elements, for pages without React. Written\n" +
    " * from the elements' specs by build/custom-elements.mjs.\n */\n\n" +
    "export interface CloverI18nOptions {\n" +
    comment(
      "The language to use: else the page's `<html lang>`, then the browser's.",
      "  ",
    ) +
    "  lng?: string;\n" +
    comment(
      "Languages to try, in order, when a string is missing. English is always last.",
      "  ",
    ) +
    "  fallbackLng?: string | readonly string[] | false;\n" +
    comment(
      "Strings to add or replace: `resources[language].clover[key]`.",
      "  ",
    ) +
    "  resources?: Record<string, Record<string, Record<string, string>>>;\n}\n\n" +
    comment(
      "Set the language of Clover's own words, or add strings, for every element on the page.",
    ) +
    "export declare function initCloverI18n(options?: CloverI18nOptions): Promise<unknown>;\n\n" +
    comment(
      "Define Clover's elements: done for you on import; for a build of your own with its own assets.",
    ) +
    "export declare function defineCloverElements(assets: unknown, tags?: readonly string[]): void;\n\n" +
    API +
    "\n" +
    handleOf(HANDLE);
  for (const spec of SPECS) {
    const docs = DOCS[spec.tag];
    text += "\n" + comment(docs.description);
    text += `export interface ${docs.name} extends HTMLElement {\n`;
    for (const name of keptOf(spec)) {
      text += comment(docs.properties[name].description, "  ");
      text += `  readonly ${name}: ${docs.properties[name].type};\n`;
    }
    for (const name of spec.properties ?? []) {
      text += comment(docs.properties[name].description, "  ");
      text += `  ${name}: ${docs.properties[name].type};\n`;
    }
    text += "}\n";
    // An event two elements send, each with a detail of its own, is either.
    for (const [name, event] of Object.entries(docs.events ?? {})) {
      const known = events.get(name) ?? [];
      if (!known.includes(event.detail))
        events.set(name, [...known, event.detail]);
    }
  }
  text += "\ndeclare global {\n  interface HTMLElementTagNameMap {\n";
  for (const spec of SPECS) {
    text += `    "${spec.tag}": ${DOCS[spec.tag].name};\n`;
  }
  text += "  }\n  interface GlobalEventHandlersEventMap {\n";
  for (const [name, details] of events) {
    text += `    "${name}": CustomEvent<${details.join(" | ")}>;\n`;
  }
  text += "  }\n}\n";
  return text;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { SPECS, DOCS, HANDLE } = await readSpecs();
  writeFileSync(
    resolve(out, "custom-elements.json"),
    `${JSON.stringify(manifestOf(SPECS, DOCS), null, 2)}\n`,
  );
  writeFileSync(resolve(out, "index.d.mts"), typesOf(SPECS, DOCS, HANDLE));
  // `@nulib/clover/web-components/viewer`: the Viewer's element alone, typed as above.
  writeFileSync(resolve(out, "viewer/index.d.mts"), VIEWER_TYPES);
  console.log(`custom-elements.json and index.d.mts: ${SPECS.length} elements`);
}
