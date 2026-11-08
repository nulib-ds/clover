/*
 * The stylesheet in tiers (`build/tiers.mjs`): base.css and spacing.css, derived from the
 * same sheets as styles.css, each holding what its tier is and nothing else, together
 * deciding every margin and padding as styles.css does, and base.css alone drawing a
 * layout that works. The last test reads `dist/`: run `npm run build -w @nulib/clover`
 * first.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { SHEETS, rulesOf } from "./clover-sheets.mjs";
import {
  BARS,
  MARK,
  SEE_THROUGH,
  SURFACES,
  UNDERLAID,
  baseReaders,
  customTiers,
  drawnByTheLook,
  parseCss,
  printCss,
  roomOf,
  rulesIn,
  splitTop,
  structural,
  tierOf,
  tierSheets,
  tiersOf,
} from "./tiers.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FULL = await rulesOf(...SHEETS.filter(({ layered }) => layered));
const TIERED = await tierSheets();

/** Every declaration in order, with its rule and the conditions around it. */
function declarationsIn(nodes, conditions = "") {
  const found = [];
  for (const node of nodes) {
    if (node.kind === "group")
      found.push(
        ...declarationsIn(node.children, `${conditions}${node.prelude}|`),
      );
    else if (node.kind === "rule")
      for (const [property, value] of node.declarations)
        found.push({ conditions, rule: node, property, value });
  }
  return found;
}

const key = ({ conditions, rule, property, value }) =>
  `${conditions}${rule.prelude}{${property}:${value}}`;
const readsOf = (value) =>
  [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(([, name]) => name);

test("the tree is the CSS it was read from, quoted braces and all", () => {
  const css =
    '@media (width<31rem){.a{--b: x;content:"};{"}}.c{background:url(data:image/svg+xml;utf8,<svg/>)}@keyframes k{0%{opacity:0}}@layer a,b;@supports (height:1svh){@container n (width<2rem){.d{top:0}}}';
  assert.equal(printCss(parseCss(css)), css);
  assert.equal(printCss(parseCss(FULL)), FULL);
});

test("every property is in one tier, its shorthands and longhands with it", () => {
  const cases = {
    base: [
      "display",
      "inset-inline-end",
      "grid-template-columns",
      "column-count",
      "cursor",
    ],
    spacing: [
      "padding-inline",
      "margin-block-start",
      "gap",
      "column-gap",
      "row-gap",
    ],
    look: [
      "border-start-start-radius",
      "outline-offset",
      "transition-property",
    ],
  };
  for (const [tier, properties] of Object.entries(cases))
    for (const property of properties)
      assert.equal(tierOf(property), tier, property);
  assert.equal(tierOf("-webkit-line-clamp"), "base");
  assert.equal(tierOf("-webkit-mask-image"), "look");
  assert.throws(() => tierOf("zoom"), /add it to BASE, SPACING or LOOK/);
  // Every property of every sheet: `tierOf` throws on one in no tier.
  for (const { property } of declarationsIn(parseCss(FULL)))
    if (!property.startsWith("--")) tierOf(property);
});

test("a custom property is in the lowest tier that reads it, the scale in base", () => {
  const nodes = parseCss(
    ".a{--pad: 1rem;padding:var(--pad);--top: var(--pad);top:var(--top)}" +
      ".b{--ink: red;color:var(--ink);--gap: 2px;gap:var(--gap)}" +
      ".c{--unread: 3px}",
  );
  const tiers = customTiers(nodes, { scale: new Set(["--unread"]) });
  assert.equal(tiers.get("--pad"), "base");
  assert.equal(tiers.get("--top"), "base");
  assert.equal(tiers.get("--gap"), "spacing");
  assert.equal(tiers.get("--ink"), "look");
  assert.equal(tiers.get("--unread"), "base");
});

test("spacing.css holds every margin, padding and gap of styles.css, in its order", () => {
  const spacing = (css) =>
    declarationsIn(parseCss(css))
      .filter(({ property }) => !property.startsWith("--"))
      .map(key);
  const full = declarationsIn(parseCss(FULL))
    .filter(({ property }) => !property.startsWith("--"))
    .filter(({ property }) => tierOf(property) === "spacing")
    .map(key);
  assert.deepEqual(spacing(TIERED.spacing), full);
});

test("base.css holds the structure of styles.css, and of the rest only what is structure too", async () => {
  const nodes = parseCss(FULL);
  const room = roomOf(nodes);
  const custom = customTiers(nodes, await baseReaders());
  const expected = declarationsIn(nodes)
    .filter(({ rule }) => !drawnByTheLook(rule))
    .filter(({ rule, property, value }) =>
      property.startsWith("--")
        ? true
        : tierOf(property) === "base" ||
          structural(property, value, room, rule.prelude),
    )
    .map(key);
  const base = declarationsIn(parseCss(TIERED.base));
  const marked = base.filter(
    ({ rule }) => rule.prelude === ":root" && rule.declarations[0][0] === MARK,
  );
  assert.equal(marked.length, 1, "base.css marks itself on :root");
  const surfaces = base.filter(({ rule }) =>
    rule.prelude.startsWith(":where(.clover-tip"),
  );
  assert.deepEqual(
    surfaces.map(({ property, value }) => `${property}:${value}`),
    ["background-color:Canvas", "color:CanvasText"],
  );
  const bars = base.filter(({ rule }) =>
    rule.prelude.startsWith(`:where(.${BARS[0]}`),
  );
  assert.deepEqual(
    bars.map(
      ({ rule, property, value }) => `${rule.prelude}{${property}:${value}}`,
    ),
    [`:where(${BARS.map((name) => `.${name}`).join(",")}){background-color:currentColor}`],
    "base.css paints each bar a press drags in the text's own color",
  );
  const own = base
    .filter(
      (each) =>
        !marked.includes(each) &&
        !surfaces.includes(each) &&
        !bars.includes(each),
    )
    .filter(({ property }) => !property.startsWith("--"));
  assert.deepEqual(
    own.map(key),
    expected.filter((each) => !/\{--/.test(each.slice(each.lastIndexOf("{")))),
  );
  // What base.css copies of the rest: aligning margins, a control's room, Items' zero
  // margins, a glyph's paint, a hotspot's see-through ground.
  for (const { rule, property, value } of own)
    if (tierOf(property) !== "base")
      assert.ok(
        structural(property, value, room, rule.prelude),
        `${rule.prelude}{${property}:${value}}`,
      );
  // The custom properties it keeps are those the structure reads (directly or through
  // others), the scale's and those a script reads.
  for (const { property } of base.filter(({ property }) =>
    property.startsWith("--"),
  ))
    if (property !== MARK)
      assert.equal(custom.get(property) ?? "base", "base", property);
});

test("base.css keeps Items' zero margins, a hotspot's see-through ground and every cursor", () => {
  const nodes = parseCss(FULL);
  const base = declarationsIn(parseCss(TIERED.base));
  const kept = (pattern, property, value) =>
    base.some(
      (each) =>
        pattern.test(each.rule.prelude) &&
        each.property === property &&
        each.value.trim() === value,
    );
  // A figure's margins are the browser's, 40px each side: an item is as wide as its pictures.
  assert.ok(kept(/^\.clover-items-figure$/, "margin", "0"));
  // Only Items': a zero margin elsewhere stays spacing.css's alone.
  const room = roomOf(nodes);
  assert.equal(structural("margin", "0", room, ".clover-about p"), false);
  assert.equal(
    structural(
      "padding",
      "0",
      room,
      ":is(button.clover-canvas-button,button.clover-items-scroll-prev)",
    ),
    false,
  );
  // A hotspot over the picture is see-through, never the browser's gray button; a button
  // beside it keeps the browser's ground.
  for (const name of SEE_THROUGH)
    assert.ok(
      kept(
        new RegExp(`^\\.${name}(?![\\w-])`),
        "background-color",
        "transparent",
      ),
      name,
    );
  assert.equal(
    structural("background", "none", room, "button.clover-sections-button"),
    false,
  );
  // Every cursor of styles.css, but in a rule base.css leaves to the browser.
  const cursors = (found) =>
    found
      .filter(
        ({ rule, property }) => property === "cursor" && !drawnByTheLook(rule),
      )
      .map(key);
  assert.ok(cursors(declarationsIn(nodes)).length > 0);
  assert.deepEqual(cursors(base), cursors(declarationsIn(nodes)));
});

test("every custom property a tier reads is in the tier or one under it", () => {
  const defined = (css) =>
    new Set(
      declarationsIn(parseCss(css))
        .map(({ property }) => property)
        .filter((property) => property.startsWith("--")),
    );
  const everywhere = defined(FULL);
  const base = defined(TIERED.base);
  const spacing = defined(TIERED.spacing);
  const check = (css, reach) => {
    for (const { property, value } of declarationsIn(parseCss(css)))
      for (const name of readsOf(value))
        if (everywhere.has(name))
          assert.ok(
            reach.some((tier) => tier.has(name)),
            `${property}:${value} reads ${name}, which no tier it needs defines`,
          );
  };
  check(TIERED.base, [base]);
  check(TIERED.spacing, [base, spacing]);
});

test("base.css leaves to the browser the form controls the look draws", () => {
  const hidden = [...rulesIn(parseCss(FULL))].filter(drawnByTheLook);
  assert.ok(
    hidden.length > 0,
    "the look hides some inputs to draw them its way",
  );
  const base = [...rulesIn(parseCss(TIERED.base))];
  for (const rule of hidden)
    assert.ok(
      !base.some((each) => each.prelude === rule.prelude),
      `${rule.prelude} stays the browser's in base.css`,
    );
});

test("what lies over other content has a surface in base.css, or needs none", () => {
  const classesOf = (selector) => {
    let depth = 0;
    let from = 0;
    for (let at = 0; at < selector.length; at++) {
      const char = selector[at];
      if ("([".includes(char)) depth++;
      else if (")]".includes(char)) depth--;
      else if (depth === 0 && " >+~".includes(char)) from = at + 1;
    }
    const subject = selector.slice(from);
    if (/::?(before|after|marker|placeholder|backdrop)/.test(subject))
      return [];
    return [
      ...subject.replace(/:not\([^()]*\)/g, "").matchAll(/\.([\w-]+)/g),
    ].map(([, name]) => name);
  };
  const positioned = new Set();
  const filled = new Set();
  for (const rule of rulesIn(parseCss(FULL)))
    for (const [property, value] of rule.declarations) {
      const selectors = splitTop(rule.prelude, ",");
      if (property === "position" && /absolute|fixed|sticky/.test(value))
        for (const selector of selectors)
          positioned.add(classesOf(selector.trim()).join("."));
      if (
        /^background(-color)?$/.test(property) &&
        !/gradient|^\s*(transparent|none|inherit|initial|unset)\s*$/.test(value)
      )
        for (const selector of selectors)
          filled.add(classesOf(selector.trim()).join("."));
    }
  const listed = new Set([...SURFACES, ...UNDERLAID]);
  for (const compound of positioned)
    if (compound && filled.has(compound))
      assert.ok(
        compound.split(".").some((name) => listed.has(name)),
        `.${compound} is positioned over other content and filled: add it to SURFACES or UNDERLAID (build/tiers.mjs)`,
      );
  for (const name of listed)
    assert.ok(FULL.includes(`.${name}`), `${name} is in no stylesheet`);
});

test("the sheets that load with their code know base.css's mark", () => {
  const adopt = readFileSync(resolve(root, "src/ui/adoptSheet.ts"), "utf8");
  assert.ok(adopt.includes(`"${MARK}"`), `adoptSheet reads ${MARK}`);
  assert.equal(
    tiersOf(".a{top:0}").base.startsWith(`:root{${MARK}:base}`),
    true,
  );
});

test("dist/base.css and dist/spacing.css are the tiers, each in the clover layer", () => {
  for (const name of ["base", "spacing"])
    assert.equal(
      readFileSync(resolve(root, `dist/${name}.css`), "utf8"),
      `@layer clover{${TIERED[name]}}\n`,
    );
});
