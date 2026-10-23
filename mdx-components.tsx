import type React from "react";
import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";

import { CodeBlock } from "docs/components/CodeBlock";
import { ScrollTable } from "docs/components/ScrollTable";

/*
 * The components MDX renders with: the docs theme's, but for tables, which scroll in a
 * box a keyboard can reach (`ScrollTable`), code, which keeps its language as a class
 * (`language-jsx`), as the page's Markdown reads it (`scripts/build-agent-docs.mjs`):
 * Nextra's drops it, and a code block, which keeps its language.
 */
const themeComponents = getThemeComponents();
const ThemeCode = themeComponents.code as React.ComponentType<
  React.ComponentProps<"code">
>;
const ThemePre = themeComponents.pre as React.ComponentType<
  React.ComponentProps<"pre"> & { "data-language"?: string }
>;

/*
 * A code block, drawn as the homepage's editor draws code, or its install a command
 * (`CodeBlock`), its fence's language kept on it (`data-lang`; Nextra's takes
 * `data-language` for its icon and drops it), which its head shows (`docs/styles/code.css`).
 */
function Pre(
  props: React.ComponentProps<"pre"> & { "data-language"?: string },
) {
  return (
    <CodeBlock lang={props["data-language"]}>
      <ThemePre {...props} data-lang={props["data-language"]} />
    </CodeBlock>
  );
}

function Code({
  "data-language": language,
  className,
  ...props
}: React.ComponentProps<"code"> & { "data-language"?: string }) {
  const named = language ? `language-${language}` : undefined;
  return (
    <ThemeCode
      {...props}
      className={[className, named].filter(Boolean).join(" ") || undefined}
    />
  );
}

export function useMDXComponents(components?: Record<string, unknown>) {
  return {
    ...themeComponents,
    table: ScrollTable,
    code: Code,
    pre: Pre,
    ...components,
  };
}
