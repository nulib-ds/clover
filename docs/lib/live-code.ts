/**
 * The code of a live example (Mat, 2026-10-22: "like we do on the homepage"): a component
 * page's first example, and the Viewer's, whose code a reader edits as the homepage's
 * editor is edited, the demo above it following. Its values are knobs: a switch for a
 * boolean, a number to type, step or drag, a word to pick, text to type. The page names
 * them as plain data; the server lays out the elements they sit on, each prop under the
 * attribute its element's spec reads it from (`LiveExample.tsx`); the client draws the
 * code, in React and as HTML, its knobs live (`LiveCode.tsx`). This module writes the
 * code from those, on both sides, so what is copied, what is shown and what agents read
 * are one text. Its tests are `live-code.test.ts`.
 */

export type Plain = string | number | boolean;

/**
 * Where a knob's prop is written: on the part, on the `Root` around it, or on its box; or
 * in the code alone, its value read by the example itself (the Viewer's template, which
 * picks the code shown).
 */
export type KnobOn = "part" | "root" | "box" | "code";

/** A value in an example's code that the reader can change. */
export interface Knob {
  /**
   * The prop it sets (`controls`), a style's property (`style.height`), or a key of an
   * object a prop takes (`options.gestures.scrollToZoom`).
   */
  prop: string;
  on?: KnobOn;
  /**
   * Its value as the example opens. A boolean is a switch; a number is typed, stepped or
   * dragged; a string with `options` is picked from them, one without is typed.
   */
  value: Plain;
  min?: number;
  max?: number;
  step?: number;
  /** A number written as a string around it: `{}rem` writes `"8rem"`. */
  format?: string;
  /** The values to pick from; `false` among them for a prop that turns off. */
  options?: Plain[];
  /**
   * Shown and set only while another of the element's knobs holds one of these values:
   * a slider's height while `layout` is `slider`.
   */
  when?: Record<string, Plain[]>;
  /** Read only as the part mounts (`defaultValue`): the demo draws again for each value. */
  remount?: boolean;
  /** Its name for assistive technology, where its element and prop do not say it well. */
  label?: string;
  /**
   * Its own id among the example's values, where two of its elements' knobs set the same
   * prop (a title's `as` and a Summary's): `summary:as`.
   */
  key?: string;
}

export type Values = Record<string, Plain>;

/**
 * A live part beside its example's Body while its knobs hold `when`'s values: the Root a
 * grid, the part's column `width`, `height` tall.
 */
export interface LiveBeside {
  when: Record<string, Plain[]>;
  width: string;
  height: number;
}

/** A knob's key among an example's values: where it is written, and its prop. */
export const knobId = (knob: Pick<Knob, "prop" | "on" | "key">) =>
  knob.key ?? `${knob.on ?? "part"}:${knob.prop}`;

export const initialValues = (knobs: Knob[]): Values =>
  Object.fromEntries(knobs.map((knob) => [knobId(knob), knob.value]));

/** Whether a knob is shown and set: always, or while those its `when` names allow. */
export function isLive(knob: Knob, knobs: Knob[], values: Values) {
  if (!knob.when) return true;
  return Object.entries(knob.when).every(([prop, allowed]) => {
    const other = knobs.find(
      (each) =>
        each.prop === prop && (each.on ?? "part") === (knob.on ?? "part"),
    );
    return !other || allowed.includes(values[knobId(other)]);
  });
}

/** A knob's value as its prop takes it: a number with a `format` is a string (`"8rem"`). */
export const propValue = (knob: Knob, value: Plain): Plain =>
  knob.format && typeof value === "number"
    ? knob.format.replace("{}", String(value))
    : value;

/**
 * The props live knobs give the element they sit on, a style's properties in `style`:
 * what the demo is drawn with.
 */
export function knobProps(
  knobs: Knob[],
  values: Values,
  on: KnobOn = "part",
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const style: Record<string, Plain> = {};
  for (const knob of knobs) {
    if ((knob.on ?? "part") !== on || !isLive(knob, knobs, values)) continue;
    const value = propValue(knob, values[knobId(knob)]);
    if (knob.prop.startsWith("style.")) style[knob.prop.slice(6)] = value;
    else if (knob.prop.includes(".")) {
      // A key of an object the prop takes, inside the objects its path names.
      const path = knob.prop.split(".");
      let into = props;
      for (const name of path.slice(0, -1))
        into = (into[name] ??= {}) as Record<string, unknown>;
      into[path.at(-1)!] = value;
    } else props[knob.prop] = value;
  }
  if (Object.keys(style).length) props.style = style;
  return props;
}

/** What the demo must draw again for: the values of the knobs read only as it mounts. */
export const remountKey = (knobs: Knob[], values: Values) =>
  knobs
    .filter((knob) => knob.remount)
    .map((knob) => String(values[knobId(knob)]))
    .join("|");

/* ── The code ─────────────────────────────────────────────────────────────────────── */

/** A style's property, fixed or set by a knob. */
export interface CodeStyle {
  /** As React writes it: `height`, `overflowY`, `--clover-items-height`. */
  name: string;
  value?: Plain;
  knob?: string;
  /** Written only while the part's knobs hold one of these values, as a knob's `when`. */
  when?: Record<string, Plain[]>;
}

/** A key of an object a prop takes: fixed, set by a knob, or an object of keys. */
export interface CodeEntry {
  name: string;
  value?: Plain;
  knob?: string;
  entries?: CodeEntry[];
}

/** A prop as an element's code writes it. */
export interface CodeAttr {
  /** Its name in React: a prop, or `style`. */
  prop: string;
  /** Its name in HTML: the attribute the element's spec reads it from. */
  attribute: string;
  /** What it says, fixed: a plain value, or data (a language map). */
  value?: unknown;
  /** Or the knob that sets it, by its id (`knobId`). */
  knob?: string;
  /** The example's resource: `{url}` in React, or, where the code imports, its address. */
  url?: boolean;
  /**
   * A template, by its name in React (`Document`); HTML gives its word (`document`).
   * With a `knob`, the reader picks it in the code, the knob's options its names.
   */
  template?: string;
  /** A style: its properties. */
  style?: CodeStyle[];
  /**
   * An object of keys (`options`): React writes it `options={{ … }}`, a key a line. HTML
   * has no attribute for it: a module script after the markup sets the element's property,
   * named by `attribute`, as the site's twins do.
   */
  entries?: CodeEntry[];
  /** Script of the host's own, as React writes it: `{manifest.label}`. */
  expression?: string;
}

/** An element in an example's code, and the elements in it. */
export interface CodeNode {
  /** Its name in React: `Clover.Root`, `Viewer`, `div`. */
  jsx: string;
  /** Its name in HTML: `clover-root`, `clover-viewer`, `div`. */
  html: string;
  attrs: CodeAttr[];
  children?: CodeNode[];
  /** The lines the example is about, marked as a fence's `{2}` marks them. */
  mark?: boolean;
  /**
   * A part the reader can move to another place among its siblings: every line it
   * writes carries it (`Line.part`), so its lines move together (`ComposeExample.tsx`).
   */
  key?: string;
  /** Written only while the part's knobs hold one of these values, as a knob's `when`. */
  when?: Record<string, Plain[]>;
  /** Written except while the part's knobs hold one of these values. */
  unless?: Record<string, Plain[]>;
}

export interface CodeTree {
  nodes: CodeNode[];
  /** React's imports, where the code is a whole module; the HTML then imports the elements. */
  imports?: string[];
  /**
   * The page has loaded the elements already (Get started's install steps do), so the
   * HTML is the markup alone, without the script that imports them.
   */
  loaded?: boolean;
  /** The example's resource, its published address. */
  url: string;
  /**
   * Lines of the host's own before the markup, as written (`const views = …`, or HTML's
   * `<!-- … -->`); `""` is a line left empty. With them, React's markup is a statement.
   */
  before?: string[];
}

export type Flavor = "react" | "html";

export type TokenKind =
  | "keyword"
  | "string"
  | "tag"
  | "attr"
  | "punctuation"
  | "number"
  | "property"
  | "comment";

/**
 * A run of code: its text, its color, and, for a knob's value, the knob's id and, for a
 * word to pick, each option as this place writes it.
 */
export interface Token {
  kind?: TokenKind;
  text: string;
  knob?: string;
  choices?: string[];
}

/**
 * A line of code: its depth, its runs, whether it is one the example is about, and the
 * movable part that wrote it, if any (`CodeNode.key`): `part` the innermost, `parts` every
 * one around it, outermost first, as a part moves inside another (a header's title).
 */
export interface Line {
  depth: number;
  tokens: Token[];
  mark?: boolean;
  part?: string;
  parts?: string[];
}

const run =
  (kind?: TokenKind) =>
  (text: string): Token => ({ kind, text });
const plain = run();
const keyword = run("keyword");
const str = run("string");
const tag = run("tag");
const attr = run("attr");
const punct = run("punctuation");
const num = run("number");
const property = run("property");

/** How wide a line may run before its props go a line each, as Prettier's does. */
const WIDTH = 80;

/** A word picked from a knob's options, as its flavor writes the value: `"grid"`, `{false}`. */
export function writtenOption(value: Plain, flavor: Flavor) {
  if (flavor === "html") return `"${String(value)}"`;
  return typeof value === "string" ? `"${value}"` : `{${String(value)}}`;
}

/** A plain value or data as React's code writes it: `{ en: ["…"] }`. */
function literal(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(literal).join(", ")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(
      ([key, given]) =>
        `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${literal(given)}`,
    );
    return entries.length ? `{ ${entries.join(", ")} }` : "{}";
  }
  return JSON.stringify(value);
}

/** An attribute's value in HTML, quoted so it needs the fewest escapes (JSON keeps its own). */
function quoted(text: string) {
  const value = text.replace(/&/g, "&amp;");
  if (!value.includes('"')) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;
  return `"${value.replace(/"/g, "&quot;")}"`;
}

/** CSS properties React writes without a unit. */
const UNITLESS = new Set([
  "flex",
  "fontWeight",
  "lineHeight",
  "opacity",
  "order",
  "zIndex",
]);

const kebab = (name: string) =>
  name.startsWith("--")
    ? name
    : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

interface Context {
  knobs: Knob[];
  values: Values;
  url: string;
  /** The code imports, so it says the resource's address, not `{url}`. */
  whole: boolean;
  /** Every knob taken as live: to measure a line at its longest. */
  measure?: boolean;
}

const knobOf = (context: Context, id: string) =>
  context.knobs.find((knob) => knobId(knob) === id);

/** Whether a knob's value is written: it is live, or the line is being measured. */
function shows(id: string, context: Context) {
  const knob = knobOf(context, id);
  if (!knob) return false;
  return context.measure || isLive(knob, context.knobs, context.values);
}

/** Whether the part's knobs hold the values `when` names, as `isLive` reads a knob's. */
export function holds(
  when: Record<string, Plain[]> | undefined,
  knobs: Knob[],
  values: Values,
) {
  return isLive({ prop: "", value: "", when }, knobs, values);
}

/** Whether an object's key is written: fixed, its knob live, or an object with a key to say. */
function entryShows(entry: CodeEntry, context: Context): boolean {
  if (entry.entries)
    return entry.entries.some((each) => entryShows(each, context));
  return !entry.knob || shows(entry.knob, context);
}

/**
 * Whether a prop is written: fixed, its knob live, or a style or an object with a key to
 * say.
 */
function written(attribute: CodeAttr, context: Context) {
  if (attribute.style)
    return attribute.style.some((entry) => styleShows(entry, context));
  if (attribute.entries)
    return attribute.entries.some((entry) => entryShows(entry, context));
  return !attribute.knob || shows(attribute.knob, context);
}

const KEYWORDS = new Set([
  "async",
  "await",
  "const",
  "default",
  "export",
  "from",
  "function",
  "import",
  "let",
  "new",
  "return",
]);

/**
 * A line of the host's own script (`tree.before`, an `expression`), or HTML's comment, as
 * runs colored as the editor colors them: keywords, strings, numbers, a property or a
 * method after its dot, a function called.
 */
function scriptTokens(line: string): Token[] {
  if (line.startsWith("<!--")) return [run("comment")(line)];
  const tokens: Token[] = [];
  const pattern =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+|=>|[^\w\s])/g;
  for (const match of line.matchAll(pattern)) {
    const [text, string, number, name] = match;
    const at = match.index! + text.length;
    if (string) tokens.push(str(text));
    else if (number) tokens.push(num(text));
    else if (name && KEYWORDS.has(name)) tokens.push(keyword(text));
    else if (name && (line[match.index! - 1] === "." || line[at] === "("))
      tokens.push(property(text));
    else if (name) tokens.push(plain(text));
    else tokens.push(/^\s+$/.test(text) ? plain(text) : punct(text));
  }
  return tokens;
}

/** A value as script writes it: `true`, `0.25`, `"auto"`. */
const scripted = (value: Plain) =>
  typeof value === "string" ? JSON.stringify(value) : String(value);

/**
 * A knob's value, as runs: the value itself, the knob's to change, and what its flavor
 * writes around it, on a prop, in a style, or as an object's key. In HTML's style it is
 * CSS, unquoted; as a key, script in both flavors.
 */
function knobTokens(
  id: string,
  context: Context,
  flavor: Flavor,
  where: "prop" | "style" | "entry",
): Token[] {
  const knob = knobOf(context, id)!;
  const value = context.values[id];
  const css = where === "style" && flavor === "html";
  const live = (kind: TokenKind, text: string, choices?: string[]): Token => ({
    kind,
    text,
    knob: id,
    ...(choices ? { choices } : {}),
  });
  // A word to pick: the whole value, as its place writes it, is the menu.
  if (knob.options) {
    const write = (option: Plain) =>
      css
        ? String(option)
        : where === "style"
          ? JSON.stringify(String(option))
          : where === "entry"
            ? scripted(option)
            : writtenOption(option, flavor);
    return [
      live(
        typeof value === "string" ? "string" : "number",
        write(value),
        knob.options.map(write),
      ),
    ];
  }
  const shown = String(value);
  if (typeof value === "number" && knob.format) {
    const [before, after = ""] = knob.format.split("{}");
    const around = css ? plain : str;
    return [
      around(css ? before : `"${before}`),
      live("number", shown),
      around(css ? after : `${after}"`),
    ].filter((token) => token.text);
  }
  if (typeof value === "number" && where === "style") {
    const name = knob.prop.slice(6);
    const px = css && !UNITLESS.has(name) && !name.startsWith("--");
    return px ? [live("number", shown), plain("px")] : [live("number", shown)];
  }
  if (
    where === "entry" &&
    (typeof value === "number" || typeof value === "boolean")
  )
    return [live("number", shown)];
  if (typeof value === "number" || typeof value === "boolean")
    return flavor === "html"
      ? [punct('"'), live("number", shown), punct('"')]
      : [punct("{"), live("number", shown), punct("}")];
  // Text to type.
  return [str('"'), live("string", shown), str('"')];
}

function styleShows(entry: CodeStyle, context: Context) {
  return (
    (!entry.knob || shows(entry.knob, context)) &&
    holds(entry.when, context.knobs, context.values)
  );
}

/** A style's properties, on one line. */
function styleTokens(
  style: CodeStyle[],
  context: Context,
  flavor: Flavor,
): Token[][] {
  return style
    .filter((entry) => styleShows(entry, context))
    .map((entry) => {
      const name =
        flavor === "html"
          ? property(kebab(entry.name))
          : entry.name.startsWith("--")
            ? str(JSON.stringify(entry.name))
            : property(entry.name);
      const value = entry.knob
        ? knobTokens(entry.knob, context, flavor, "style")
        : flavor === "html"
          ? [
              plain(
                typeof entry.value === "number" &&
                  entry.value !== 0 &&
                  !UNITLESS.has(entry.name) &&
                  !entry.name.startsWith("--")
                  ? `${entry.value}px`
                  : String(entry.value),
              ),
            ]
          : [
              typeof entry.value === "number"
                ? num(String(entry.value))
                : str(JSON.stringify(entry.value)),
            ];
      return [name, punct(": "), ...value];
    });
}

/**
 * An object's keys as script writes them, in both flavors, a key a line, an object of keys
 * opening and closing on lines of its own (`gestures: {` … `},`), each `indent` in.
 */
function entryLines(
  entries: CodeEntry[],
  context: Context,
  flavor: Flavor,
  indent: string,
): Token[][] {
  const lead = indent ? [plain(indent)] : [];
  return entries
    .filter((entry) => entryShows(entry, context))
    .flatMap((entry) => {
      if (entry.entries)
        return [
          [...lead, property(entry.name), punct(": {")],
          ...entryLines(entry.entries, context, flavor, `${indent}  `),
          [...lead, punct("},")],
        ];
      const value = entry.knob
        ? knobTokens(entry.knob, context, flavor, "entry")
        : [
            typeof entry.value === "string"
              ? str(JSON.stringify(entry.value))
              : num(String(entry.value)),
          ];
      return [
        [...lead, property(entry.name), punct(": "), ...value, punct(",")],
      ];
    });
}

/**
 * A prop as its flavor writes it, as lines: one, but for a style too long for its line,
 * which React writes a property a line (`style={{` … `}}`), and an object, which React
 * writes a key a line (HTML sets it by script, `propertyLines`).
 */
function attrLines(
  attribute: CodeAttr,
  context: Context,
  flavor: Flavor,
  room: number,
): Token[][] {
  const html = flavor === "html";
  const name = attr(html ? attribute.attribute : attribute.prop);
  if (attribute.style) {
    const entries = styleTokens(attribute.style, context, flavor);
    if (html)
      return [
        [
          name,
          punct('="'),
          ...entries.flatMap((entry, at) =>
            at ? [punct("; "), ...entry] : entry,
          ),
          punct('"'),
        ],
      ];
    const one = [
      name,
      punct("={{ "),
      ...entries.flatMap((entry, at) => (at ? [punct(", "), ...entry] : entry)),
      punct(" }}"),
    ];
    if (width(one, context) <= room || entries.length < 2) return [one];
    return [
      [name, punct("={{")],
      ...entries.map((entry) => [plain("  "), ...entry, punct(",")]),
      [punct("}}")],
    ];
  }
  if (attribute.entries)
    return [
      [name, punct("={{")],
      ...entryLines(attribute.entries, context, flavor, "  "),
      [punct("}}")],
    ];
  if (attribute.expression !== undefined)
    return [
      [name, punct("={"), ...scriptTokens(attribute.expression), punct("}")],
    ];
  if (attribute.url) {
    if (html) return [[name, punct("="), str(quoted(context.url))]];
    return context.whole
      ? [[name, punct("="), str(JSON.stringify(context.url))]]
      : [[name, punct("={"), plain("url"), punct("}")]];
  }
  if (attribute.template && attribute.knob) {
    /*
     * A template the reader picks in the code (the Viewer's first example): React
     * names its component, `{Document}`, HTML its word, `"document"`, each option
     * written as that place writes it.
     */
    const knob = knobOf(context, attribute.knob);
    const value = String(context.values[attribute.knob] ?? attribute.template);
    const options = (knob?.options ?? [value]).map(String);
    if (html) {
      const word = (option: string) => `"${option.toLowerCase()}"`;
      return [
        [
          name,
          punct("="),
          {
            kind: "string",
            text: word(value),
            knob: attribute.knob,
            choices: options.map(word),
          },
        ],
      ];
    }
    return [
      [
        name,
        punct("={"),
        { text: value, knob: attribute.knob, choices: options },
        punct("}"),
      ],
    ];
  }
  if (attribute.template) {
    if (html)
      return [[name, punct("="), str(`"${attribute.template.toLowerCase()}"`)]];
    return [[name, punct("={"), plain(attribute.template), punct("}")]];
  }
  if (attribute.knob)
    return [
      [
        name,
        punct("="),
        ...knobTokens(attribute.knob, context, flavor, "prop"),
      ],
    ];
  const value = attribute.value;
  if (value === true) return [[name]];
  if (typeof value === "string")
    return [
      [name, punct("="), str(html ? quoted(value) : JSON.stringify(value))],
    ];
  if (html)
    return [
      [
        name,
        punct("="),
        str(
          quoted(
            typeof value === "object" ? JSON.stringify(value) : String(value),
          ),
        ),
      ],
    ];
  return [
    [
      name,
      punct("={"),
      typeof value === "number" || typeof value === "boolean"
        ? num(String(value))
        : plain(literal(value)),
      punct("}"),
    ],
  ];
}

/**
 * How wide runs are, at their widest: a knob's word as its longest option, its number as
 * its largest, so a line does not break and join again as the reader changes a value.
 */
function width(tokens: Token[], context: Context) {
  return tokens.reduce((sum, token) => {
    const knob = token.knob ? knobOf(context, token.knob) : undefined;
    if (knob?.options)
      return (
        sum +
        Math.max(
          ...knob.options.map(
            (option) => writtenOption(option, "react").length,
          ),
        )
      );
    if (knob && typeof knob.value === "number" && knob.max !== undefined)
      return sum + Math.max(token.text.length, String(knob.max).length);
    if (knob && typeof knob.value === "boolean") return sum + 5;
    return sum + token.text.length;
  }, 0);
}

function nodeLines(
  node: CodeNode,
  depth: number,
  context: Context,
  flavor: Flavor,
  lines: Line[],
  mark = false,
  around: string[] = [],
) {
  const html = flavor === "html";
  const marked = mark || node.mark;
  const parts = node.key ? [...around, node.key] : around;
  const own = parts.at(-1);
  const push = (at: number, tokens: Token[]) =>
    lines.push({
      depth: at,
      tokens,
      ...(marked ? { mark: true } : {}),
      ...(own ? { part: own, parts } : {}),
    });
  const name = html ? node.html : node.jsx;
  // HTML sets an object by script, after the markup (`propertyLines`).
  const tagged = (each: CodeAttr) => !(html && each.entries);
  const attrs = node.attrs.filter(
    (each) => tagged(each) && written(each, context),
  );
  const children = (node.children ?? []).filter(
    (child) =>
      holds(child.when, context.knobs, context.values) &&
      !(child.unless && holds(child.unless, context.knobs, context.values)),
  );
  const room = WIDTH - 2 * (depth + 1);
  const close = html ? [punct(">")] : [punct(children.length ? ">" : " />")];
  const line = (shown: CodeAttr[], given: Context) => [
    punct("<"),
    tag(name),
    ...shown.flatMap((each) => [
      plain(" "),
      ...attrLines(each, given, flavor, Infinity)[0],
    ]),
    ...close,
    ...(html && !children.length ? [punct("</"), tag(name), punct(">")] : []),
  ];
  /*
   * React keeps a lone prop on the element's line, as Prettier does; HTML breaks it too.
   * Three or more go a line each, as the homepage's editor writes them, to edit one by one.
   * The line is measured with every prop its knobs can show, so it keeps its breaks as the
   * reader changes them.
   */
  const measure = { ...context, measure: true };
  const longest = node.attrs.filter(
    (each) => tagged(each) && written(each, measure),
  );
  // A lone style of several properties breaks, as Prettier breaks an object.
  const lone =
    !html &&
    longest.length <= 1 &&
    !(longest[0]?.style && longest[0].style.length > 1) &&
    !longest[0]?.entries;
  // So does an element with an object, which React writes a key a line.
  const fits =
    (width(line(longest, measure), context) <= WIDTH - 2 * depth &&
      longest.length < 3 &&
      !longest.some((each) => each.entries)) ||
    lone;
  if (fits) push(depth, line(attrs, context));
  else {
    push(depth, [punct("<"), tag(name)]);
    attrs.forEach((each, at) => {
      const own = attrLines(each, context, flavor, room);
      own.forEach((tokens, line) => {
        const last = at === attrs.length - 1 && line === own.length - 1;
        // HTML ends its tag on its last attribute's line, as the site's twins do.
        push(depth + 1, html && last ? [...tokens, punct(">")] : tokens);
      });
    });
    if (!html) push(depth, [punct(children.length ? ">" : "/>")]);
    else if (!children.length)
      push(depth, [punct("</"), tag(name), punct(">")]);
  }
  children.forEach((child) =>
    nodeLines(child, depth + 1, context, flavor, lines, marked, parts),
  );
  if (children.length) push(depth, [punct("</"), tag(name), punct(">")]);
}

/** A React import, colored: `import Viewer from "@nulib/clover";`. */
function importTokens(line: string): Token[] {
  const match = line.match(/^import\s+(?:(.+?)\s+from\s+)?("[^"]+");?$/);
  if (!match) return [plain(line)];
  const [, bound, from] = match;
  if (!bound) return [keyword("import"), plain(" "), str(from), punct(";")];
  const names = bound.match(/^\* as (\w+)$/);
  return [
    keyword("import"),
    ...(names
      ? [plain(" * "), keyword("as"), plain(` ${names[1]} `)]
      : [plain(` ${bound} `)]),
    keyword("from"),
    plain(" "),
    str(from),
    punct(";"),
  ];
}

/** An example's code in one flavor, as lines. */
export function codeLines(
  tree: CodeTree,
  knobs: Knob[],
  values: Values,
  flavor: Flavor,
): Line[] {
  const context: Context = {
    knobs,
    values,
    url: tree.url,
    whole: Boolean(tree.imports?.length),
  };
  const lines: Line[] = [];
  if (context.whole) {
    if (flavor === "react")
      tree.imports!.forEach((line) =>
        lines.push({ depth: 0, tokens: importTokens(line) }),
      );
    else if (!tree.loaded)
      lines.push(
        {
          depth: 0,
          tokens: [
            punct("<"),
            tag("script"),
            plain(" "),
            attr("type"),
            punct("="),
            str('"module"'),
            punct(">"),
          ],
        },
        {
          depth: 1,
          tokens: [
            keyword("import"),
            plain(" "),
            str('"@nulib/clover/web-components"'),
            punct(";"),
          ],
        },
        { depth: 0, tokens: [punct("</"), tag("script"), punct(">")] },
      );
    if (flavor === "react" || !tree.loaded)
      lines.push({ depth: 0, tokens: [] });
  }
  for (const line of tree.before ?? [])
    lines.push({
      depth: Math.floor(line.match(/^ */)![0].length / 2),
      tokens: line.trim() ? scriptTokens(line.trim()) : [],
    });
  tree.nodes.forEach((node) => nodeLines(node, 0, context, flavor, lines));
  // A module's markup is a statement, as is markup after script: it ends in a semicolon,
  // as Prettier writes it.
  if ((context.whole || tree.before?.length) && flavor === "react")
    lines.at(-1)!.tokens.push(punct(";"));
  if (flavor === "html") lines.push(...propertyLines(tree.nodes, context));
  return lines;
}

/**
 * HTML's script for the objects its elements take as properties, after the markup: each
 * element found, then its property set, as the site's twins write it
 * (`const canvas = document.querySelector("clover-canvas");`).
 */
function propertyLines(nodes: CodeNode[], context: Context): Line[] {
  const set: { node: CodeNode; attribute: CodeAttr }[] = [];
  const walk = (each: CodeNode) => {
    for (const attribute of each.attrs)
      if (attribute.entries && written(attribute, context))
        set.push({ node: each, attribute });
    each.children?.forEach(walk);
  };
  nodes.forEach(walk);
  if (!set.length) return [];
  const named = (node: CodeNode) =>
    node.html
      .replace(/^clover-/, "")
      .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
  const found = [...new Set(set.map(({ node }) => node))];
  return [
    { depth: 0, tokens: [] },
    {
      depth: 0,
      tokens: [
        punct("<"),
        tag("script"),
        plain(" "),
        attr("type"),
        punct("="),
        str('"module"'),
        punct(">"),
      ],
    },
    ...found.map((node) => ({
      depth: 1,
      tokens: [
        keyword("const"),
        plain(` ${named(node)} = document.querySelector(`),
        str(JSON.stringify(node.html)),
        punct(");"),
      ],
    })),
    ...set.flatMap(({ node, attribute }) => [
      {
        depth: 1,
        tokens: [plain(`${named(node)}.${attribute.attribute} = `), punct("{")],
      },
      ...entryLines(attribute.entries!, context, "html", "").map((tokens) => ({
        depth: 2,
        tokens,
      })),
      { depth: 1, tokens: [punct("};")] },
    ]),
    { depth: 0, tokens: [punct("</"), tag("script"), punct(">")] },
  ];
}

/** Lines as text: what Copy copies and agents read. */
export const textOf = (lines: Line[]) =>
  lines
    .map(
      (line) =>
        "  ".repeat(line.depth) +
        line.tokens.map((token) => token.text).join(""),
    )
    .join("\n");

/** Where the published site serves its mocks: what an example's HTML points to. */
const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://clover.iiif.library.northwestern.edu"
).replace(/\/$/, "");

/** A resource's published address: an address as it is, a mock's under the site. */
export const publishedAddress = (resource: string) =>
  /^https?:/.test(resource) ? resource : `${SITE}/mocks/${resource}`;

/** A page's published address, by its route: `/docs/items`. */
export const pageAddress = (route: string) => `${SITE}${route}`;
