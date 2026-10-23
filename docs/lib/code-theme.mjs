/*
 * The homepage editor's colors as a Shiki theme (Mat, 2026-10-22: the examples' code drawn
 * as that editor is): Prism's Material theme, each color the site's own token
 * (`--editor-*`, `docs/styles/tokens.css`: the editor's `--code-*` on black, or its light
 * version), so the two never drift. Nextra's highlighter gives every token this color
 * beside its light and dark ones (`--shiki-editor`, `next.config.mjs`), and only the
 * examples' code reads it (`ViewerDocs.module.css`). Every color holds 4.5:1 on its ground
 * (WCAG 1.4.3); comments take the editor's faint text, which does too, not Material's
 * gray, which does not.
 */
const color = (token) => ({ foreground: `var(--editor-${token})` });

export const editorTheme = {
  name: "clover-editor",
  type: "dark",
  colors: {
    "editor.background": "var(--editor-background)",
    "editor.foreground": "var(--editor-text)",
  },
  tokenColors: [
    { settings: color("text") },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: color("faint"),
    },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier"],
      settings: color("keyword"),
    },
    {
      scope: [
        "string",
        "string.quoted",
        "string.template",
        "punctuation.definition.string",
      ],
      settings: color("string"),
    },
    {
      scope: [
        "entity.name.tag",
        "support.class.component",
        "entity.name.tag.css",
        "meta.tag.sgml.doctype",
      ],
      settings: color("tag"),
    },
    {
      scope: [
        "entity.other.attribute-name",
        "entity.other.attribute-name.class.css",
        "entity.other.attribute-name.id.css",
      ],
      settings: color("attr"),
    },
    {
      scope: [
        "punctuation",
        "meta.brace",
        "keyword.operator",
        "punctuation.definition.tag",
        "punctuation.section.embedded",
      ],
      settings: color("punctuation"),
    },
    {
      scope: [
        "constant.numeric",
        "constant.language",
        "constant.other",
        "keyword.other.unit",
      ],
      settings: color("number"),
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "support.type.property-name",
        "variable.other.property",
        "meta.object-literal.key",
        "variable.css",
        "support.type.custom-property",
      ],
      settings: color("property"),
    },
  ],
};
