import type React from "react";
import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";

import { ScrollTable } from "docs/components/ScrollTable";

/*
 * The components MDX renders with: the docs theme's, but for tables, which scroll in a
 * box a keyboard can reach (`ScrollTable`), and code, which keeps its language as a class
 * (`language-jsx`), as the page's Markdown reads it (`scripts/build-agent-docs.mjs`):
 * Nextra's drops it.
 */
const themeComponents = getThemeComponents();
const ThemeCode = themeComponents.code as React.ComponentType<
  React.ComponentProps<"code">
>;

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
  return { ...themeComponents, table: ScrollTable, code: Code, ...components };
}
