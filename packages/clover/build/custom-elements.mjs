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
import { writeFileSync } from "node:fs";
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
  const { SPECS, DOCS } = await import(`data:text/javascript;base64,${code}`);
  return { SPECS, DOCS: typeof DOCS === "function" ? DOCS() : DOCS };
}

/** An attribute's type, as the manifest and the docs write it. */
function attributeType(type) {
  if (Array.isArray(type)) return type.map((word) => `"${word}"`).join(" | ");
  return type === "data" ? "string" : type;
}

/** Every doc an element needs, present: a spec without one fails the build. */
function checkDocs(spec, docs) {
  if (!docs) throw new Error(`${spec.tag} has no docs`);
  const missing = [
    ...Object.keys(spec.attributes).filter((name) => !docs.attributes[name]),
    ...(spec.properties ?? []).filter((name) => !docs.properties?.[name]),
    ...Object.keys(spec.events ?? {}).filter((name) => !docs.events?.[name]),
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
      members: (spec.properties ?? []).map((name) => ({
        kind: "field",
        name,
        type: { text: docs.properties[name].type },
        description: docs.properties[name].description,
      })),
      events: Object.keys(spec.events ?? {}).map((name) => ({
        name,
        type: { text: `CustomEvent<${docs.events[name].detail}>` },
        description: docs.events[name].description,
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

export function typesOf(SPECS, DOCS) {
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
    "export declare function defineCloverElements(assets: unknown, tags?: readonly string[]): void;\n";
  for (const spec of SPECS) {
    const docs = DOCS[spec.tag];
    text += "\n" + comment(docs.description);
    text += `export interface ${docs.name} extends HTMLElement {\n`;
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
  const { SPECS, DOCS } = await readSpecs();
  writeFileSync(
    resolve(out, "custom-elements.json"),
    `${JSON.stringify(manifestOf(SPECS, DOCS), null, 2)}\n`,
  );
  writeFileSync(resolve(out, "index.d.mts"), typesOf(SPECS, DOCS));
  console.log(`custom-elements.json and index.d.mts: ${SPECS.length} elements`);
}
