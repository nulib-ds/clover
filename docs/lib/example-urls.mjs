/**
 * The address each example's resource has, for the "Web components" code of an example
 * (`code-flavors.mjs`): an HTML attribute takes the address itself, where the React
 * code says `{url}`. Read from where the examples get them, as written there: a part
 * demo's `resource` (`RESOURCES` in `docs/lib/part-demo-resources.ts`) and a Viewer
 * example's (`resources` in `docs/components/Playground/playground-config.ts`). A mock is
 * the published site's (`/mocks/…`). Plain JavaScript, run by `next.config.mjs`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** Where the published site's mocks are. */
const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nulib-ds.github.io/clover"
).replace(/\/$/, "");
const addressOf = (resource) =>
  /^https?:/.test(resource) ? resource : `${SITE}/mocks/${resource}`;

const parse = (file) =>
  ts.createSourceFile(
    file,
    readFileSync(path.join(root, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

/** An expression past `as const` and `satisfies`, as it is written. */
const bare = (node) =>
  node &&
  (ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node))
    ? bare(node.expression)
    : node;

/** A declaration's initializer, by the name it is declared as. */
function declared(source, name) {
  let found = null;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    )
      found = bare(node.initializer);
    if (!found) ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const text = (node) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;

/** A part demo's resources: `RESOURCES`, key to mock path or address. */
export function partDemoUrls() {
  const object = declared(
    parse("docs/lib/part-demo-resources.ts"),
    "RESOURCES",
  );
  const urls = new Map();
  for (const property of object?.properties ?? []) {
    if (!ts.isPropertyAssignment(property)) continue;
    const value = text(property.initializer);
    const key = property.name.text;
    if (value) urls.set(key, addressOf(value));
  }
  return urls;
}

/** A Viewer example's resources: the playground's, by `key`, those written as text. */
export function viewerUrls() {
  const array = declared(
    parse("docs/components/Playground/playground-config.ts"),
    "resources",
  );
  const urls = new Map();
  for (const element of array?.elements ?? []) {
    if (!ts.isObjectLiteralExpression(element)) continue;
    const field = (name) =>
      element.properties.find(
        (property) =>
          ts.isPropertyAssignment(property) && property.name.text === name,
      )?.initializer;
    const key = text(field("key"));
    const resource = text(field("resource"));
    if (key && resource) urls.set(key, addressOf(resource));
  }
  return urls;
}
