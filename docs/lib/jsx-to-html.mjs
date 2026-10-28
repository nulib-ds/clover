/**
 * An example's JSX as the HTML of Clover's elements (AGENTS.md: every page in both
 * flavors), for the docs' "Web components" code: each part as its element
 * (`<Clover.Label as="h2" />` is `<clover-label as="h2"></clover-label>`), each prop as
 * the attribute its element's spec reads it from, an object a property takes set by a
 * module script, a style object as CSS text, `{url}` as the example's resource, and the
 * package's imports as the one import of `@nulib/clover/web-components`. What HTML cannot
 * say (a function, a hook, a component of the page's, a prop the element has no attribute
 * or property for) is not turned: the reason comes back instead, and the example keeps a
 * twin written by hand, or React alone.
 *
 * Plain JavaScript, so `next.config.mjs` (`mdx-code-flavors-loader.cjs`, through
 * `code-flavors.mjs`) runs it as the docs build; its tests are `jsx-to-html.test.ts`.
 */
import ts from "typescript";

/** Where an example's `{url}` points when its frame names no resource. */
export const DEFAULT_URL =
  "https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json";

/** The template a name imported from `@nulib/clover/templates` is. */
const TEMPLATES = {
  Default: "default",
  Document: "document",
  Gallery: "gallery",
};

/** What `@nulib/clover/web-components` exports besides the elements, by the same names. */
const ELEMENT_EXPORTS = new Set(["initCloverI18n", "defineCloverElements"]);

/** HTML's elements that never close. */
const VOID = new Set([
  "area",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/** React's names for HTML's attributes. */
const HTML_NAMES = { className: "class", htmlFor: "for", tabIndex: "tabindex" };

/** CSS properties React writes without a unit. */
const UNITLESS = new Set([
  "flex",
  "flexGrow",
  "flexShrink",
  "fontWeight",
  "lineHeight",
  "opacity",
  "order",
  "zIndex",
  "zoom",
]);

class Unsupported extends Error {}
const refuse = (reason) => {
  throw new Unsupported(reason);
};

const kebab = (name) =>
  name.replace(
    /[A-Z]/g,
    (letter, at) => `${at ? "-" : ""}${letter.toLowerCase()}`,
  );

const escapeText = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** An attribute, quoted so its value needs the fewest escapes (JSON keeps its own quotes). */
function attribute(name, value) {
  if (value === true) return name;
  const text = String(value).replace(/&/g, "&amp;");
  if (!text.includes('"')) return `${name}="${text}"`;
  if (!text.includes("'")) return `${name}='${text}'`;
  return `${name}="${text.replace(/"/g, "&quot;")}"`;
}

/** A literal's value: a string, a number, a boolean, null, or arrays and objects of them. */
function literal(node, source) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  )
    return -Number(node.operand.text);
  if (ts.isParenthesizedExpression(node))
    return literal(node.expression, source);
  if (ts.isArrayLiteralExpression(node))
    return node.elements.map((element) => literal(element, source));
  if (ts.isObjectLiteralExpression(node)) {
    const value = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property))
        refuse("an object with more than plain values");
      const key = property.name;
      const name =
        ts.isIdentifier(key) ||
        ts.isStringLiteral(key) ||
        ts.isNumericLiteral(key)
          ? key.text
          : refuse("an object with a computed key");
      value[name] = literal(property.initializer, source);
    }
    return value;
  }
  return refuse(`${node.getText(source)}, which is not a plain value`);
}

/** A style object as CSS text, as React writes it: camelCase to kebab, numbers in px. */
function css(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    refuse("a style that is not an object");
  return Object.entries(value)
    .map(([name, given]) => {
      const property = name.startsWith("--")
        ? name
        : kebab(name).replace(/^(webkit|moz|ms)-/, "-$1-");
      const text =
        typeof given === "number" &&
        given !== 0 &&
        !UNITLESS.has(name) &&
        !name.startsWith("--")
          ? `${given}px`
          : String(given);
      return `${property}: ${text}`;
    })
    .join("; ");
}

/** JSX text as React reads it: lines trimmed, blank ones dropped, the rest joined by spaces. */
function jsxText(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length === 1) return text;
  return lines
    .map((line, index) => {
      let kept = index === 0 ? line : line.replace(/^\s+/, "");
      if (index < lines.length - 1) kept = kept.replace(/\s+$/, "");
      return kept;
    })
    .filter((line) => line.length)
    .join(" ");
}

/**
 * The JSX of an example (statements: imports, then markup), as HTML. `specs` are the
 * elements' (`SPECS`, `src/web-components/specs`); `url` is what `{url}` stands for.
 * Returns `{ html }`, or `{ reason }` where HTML cannot say what the JSX does.
 *
 * @param {string} code
 * @param {{ specs?: ReadonlyArray<object>; url?: string }} [options]
 * @returns {{ html?: string; reason?: string }}
 */
export function jsxToHtml(code, { specs, url = DEFAULT_URL } = {}) {
  try {
    return { html: convert(code, specs ?? [], url) };
  } catch (error) {
    if (error instanceof Unsupported) return { reason: error.message };
    throw error;
  }
}

/*
 * Markup after the imports, read as one fragment: sibling elements with nothing around
 * them (`<Clover.Body />` then `<Clover.Id />`) are no statement JSX can parse.
 */
function siblings(code) {
  const head = ts.createSourceFile(
    "example.tsx",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const imports = head.statements.filter(ts.isImportDeclaration);
  const end = imports.length ? imports.at(-1).end : 0;
  // The markup, without the semicolon that ends it as a statement (`<Viewer />;`).
  const rest = code.slice(end).replace(/;\s*$/, "");
  if (!rest.trim().startsWith("<")) return code;
  return `${code.slice(0, end)}\n<>\n${rest}\n</>;\n`;
}

/*
 * Code with no markup that calls only what the element module also exports
 * (`initCloverI18n`): the same code, in a module script that imports it from there.
 */
function script(source) {
  const named = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const from = statement.moduleSpecifier.text;
    const bound = statement.importClause?.namedBindings;
    if (from !== "@nulib/clover" || !bound || !ts.isNamedImports(bound))
      return null;
    for (const element of bound.elements) {
      if (!ELEMENT_EXPORTS.has(element.name.text)) return null;
      named.push(element.name.text);
    }
  }
  const body = source.statements.filter(
    (statement) => !ts.isImportDeclaration(statement),
  );
  if (!named.length || !body.length) return null;
  if (body.some((statement) => /<[A-Za-z]/.test(statement.getText(source))))
    return null;
  const lines = body.map((statement) => statement.getText(source)).join("\n");
  return `<script type="module">\n  import { ${named.join(", ")} } from "@nulib/clover/web-components";\n\n${lines
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n")}\n</script>`;
}

function convert(code, specs, url) {
  const plain = ts.createSourceFile(
    "example.tsx",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const scripted = script(plain);
  if (scripted) return scripted;
  const source = ts.createSourceFile(
    "example.tsx",
    siblings(code),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const byTag = new Map(specs.map((spec) => [spec.tag, spec]));
  const names = {
    clover: "Clover",
    viewer: new Set(["Viewer"]),
    map: new Set(["Map"]),
    templates: { ...TEMPLATES },
  };
  let imports = false;
  const markup = [];
  /** Properties to set from a script, by the element they are set on. */
  const assignments = [];

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const from = statement.moduleSpecifier.text;
      if (/\.css$/.test(from)) continue; // The elements inject their own styles.
      if (!from.startsWith("@nulib/clover")) refuse(`an import from ${from}`);
      imports = true;
      const clause = statement.importClause;
      if (clause?.name && from === "@nulib/clover")
        names.viewer.add(clause.name.text);
      const bound = clause?.namedBindings;
      if (bound && ts.isNamespaceImport(bound)) names.clover = bound.name.text;
      if (bound && ts.isNamedImports(bound))
        for (const element of bound.elements) {
          const imported = (element.propertyName ?? element.name).text;
          const local = element.name.text;
          if (from === "@nulib/clover/templates" && TEMPLATES[imported])
            names.templates[local] = TEMPLATES[imported];
          else if (from === "@nulib/clover/map" && imported === "Map")
            names.map.add(local);
          else if (from === "@nulib/clover" && imported === "Viewer")
            names.viewer.add(local);
          else refuse(`${imported}, imported by name`);
        }
      continue;
    }
    if (ts.isExpressionStatement(statement)) {
      markup.push(
        element(unwrap(statement.expression), "", {
          source,
          byTag,
          names,
          url,
          assignments,
        }),
      );
      continue;
    }
    refuse("code beside the markup");
  }
  if (!markup.length) refuse("no markup");

  const parts = [];
  if (imports)
    parts.push(
      `<script type="module">\n  import "@nulib/clover/web-components";\n</script>`,
    );
  parts.push(markup.join("\n\n"));
  if (assignments.length) {
    const seen = new Map();
    const lines = [];
    for (const { tag, prop, value } of assignments) {
      const name = kebab(tag.replace(/^clover-/, "")).replace(
        /-(\w)/g,
        (_, letter) => letter.toUpperCase(),
      );
      if (!seen.has(tag)) {
        seen.set(tag, name);
        lines.push(`  const ${name} = document.querySelector("${tag}");`);
      }
      lines.push(`  ${seen.get(tag)}.${prop} = ${value};`);
    }
    parts.push(`<script type="module">\n${lines.join("\n")}\n</script>`);
  }
  return parts.join("\n\n");
}

const unwrap = (node) =>
  ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;

/** The element a JSX tag is: one of Clover's (its spec), or HTML's own. */
function tagOf(name, context) {
  const { names, byTag } = context;
  const clover = name.match(new RegExp(`^${names.clover}\\.([A-Z]\\w*)$`));
  const part =
    clover?.[1] ??
    (names.viewer.has(name) ? "Viewer" : names.map.has(name) ? "Map" : null);
  if (part) {
    const tag = `clover-${kebab(part)}`;
    const spec = byTag.get(tag);
    if (!spec) refuse(`${name}, which has no element`);
    return { tag, spec };
  }
  if (/^[a-z][\w-]*$/.test(name)) return { tag: name, spec: null };
  return refuse(`${name}, a component of the page's`);
}

function element(node, indent, context) {
  if (ts.isJsxFragment(node))
    return children(node.children, indent, context).join("\n");
  if (!ts.isJsxElement(node) && !ts.isJsxSelfClosingElement(node))
    refuse("an expression that is not markup");
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  const { tag, spec } = tagOf(opening.tagName.getText(context.source), context);
  const written = attributes(opening.attributes, tag, spec, context);
  const open = `${indent}<${tag}${written.length ? " " + written.join(" ") : ""}>`;
  if (!spec && VOID.has(tag)) return open;
  const list = ts.isJsxElement(node) ? node.children : [];
  // Text among its children: they run inline, spaced as React spaces them.
  if (list.some((child) => ts.isJsxText(child) && jsxText(child.text).trim()))
    return `${open}${inline(list, context)}</${tag}>`;
  const inner = children(list, `${indent}  `, context);
  if (!inner.length) return `${open}</${tag}>`;
  if (
    inner.length === 1 &&
    !inner[0].includes("\n") &&
    !inner[0].trimStart().startsWith("<")
  )
    return `${open}${inner[0].trim()}</${tag}>`;
  return `${open}\n${inner.join("\n")}\n${indent}</${tag}>`;
}

function children(list, indent, context) {
  const out = [];
  for (const child of list) {
    if (ts.isJsxText(child)) {
      const text = jsxText(child.text);
      if (text.trim()) out.push(`${indent}${escapeText(text.trim())}`);
    } else if (ts.isJsxExpression(child)) {
      if (!child.expression) continue; // A comment.
      const value = literal(child.expression, context.source);
      if (typeof value !== "string")
        refuse("a child that is not text or markup");
      if (value.trim()) out.push(`${indent}${escapeText(value)}`);
    } else {
      out.push(element(child, indent, context));
    }
  }
  return out;
}

/** Children running inline: text as JSX keeps it on its line, elements in their place. */
function inline(list, context) {
  return list
    .map((child) => {
      if (ts.isJsxText(child)) return escapeText(jsxText(child.text));
      if (ts.isJsxExpression(child)) {
        if (!child.expression) return "";
        const value = literal(child.expression, context.source);
        if (typeof value !== "string")
          refuse("a child that is not text or markup");
        return escapeText(value);
      }
      return element(child, "", context).replace(/\n\s*/g, " ");
    })
    .join("");
}

/** A prop's value as the JSX writes it, `{url}` and template names read. */
function valueOf(initializer, prop, context) {
  if (!initializer) return true;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  const expression = initializer.expression;
  if (!expression) refuse("an empty value");
  if (ts.isIdentifier(expression)) {
    if (expression.text === "url") return context.url;
    if (prop === "template" && context.names.templates[expression.text])
      return context.names.templates[expression.text];
    if (expression.text === "undefined") return undefined;
  }
  return literal(expression, context.source);
}

function attributes(list, tag, spec, context) {
  const out = [];
  for (const given of list.properties) {
    if (ts.isJsxSpreadAttribute(given)) refuse("a spread of props");
    const prop = given.name.getText(context.source);
    if (prop === "key" || prop === "ref") refuse(`${prop}, which is React's`);
    if (/^on[A-Z]/.test(prop)) refuse(`${prop}, a function`);
    const value = valueOf(given.initializer, prop, context);
    if (value === undefined) continue;
    if (prop === "style") {
      out.push(attribute("style", css(value)));
      continue;
    }
    if (!spec) {
      out.push(attribute(HTML_NAMES[prop] ?? prop, value));
      continue;
    }
    // A Clover element is a box no reader is told of: its part names what it draws.
    if (/^(aria-|role$|tabIndex$)/.test(prop))
      refuse(
        `${prop} on <${tag}>, which names the part's own element in React`,
      );
    if (prop === "className") {
      out.push(attribute("class", value));
      continue;
    }
    if (prop === "id" || prop === "hidden" || prop === "lang") {
      out.push(attribute(prop, value));
      continue;
    }
    // An attribute is where it opens and what moves it later: React's `defaultX` is `x`.
    const read = (name) =>
      Object.entries(spec.attributes).find(
        ([, attribute]) => attribute.prop === name,
      );
    const named =
      read(prop) ??
      (/^default[A-Z]/.test(prop)
        ? read(prop[7].toLowerCase() + prop.slice(8))
        : undefined);
    const objectLike = value !== null && typeof value === "object";
    if (named && !(objectLike && named[1].type !== "data")) {
      const [name, { type }] = named;
      if (objectLike) out.push(attribute(name, JSON.stringify(value)));
      else if (value === true && type === "boolean")
        out.push(attribute(name, true));
      else if (value === false) out.push(attribute(name, "false"));
      else out.push(attribute(name, value));
      continue;
    }
    if ((spec.properties ?? []).includes(prop)) {
      context.assignments.push({
        tag,
        prop,
        value: given.initializer.expression.getText(context.source),
      });
      continue;
    }
    refuse(`${prop}, which <${tag}> has no attribute or property for`);
  }
  return out;
}
