import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";

import { ScrollTable } from "docs/components/ScrollTable";

/*
 * The components MDX renders with: the docs theme's, but for tables, which scroll in a
 * box a keyboard can reach (`ScrollTable`).
 */
const themeComponents = getThemeComponents();

export function useMDXComponents(components?: Record<string, unknown>) {
  return { ...themeComponents, table: ScrollTable, ...components };
}
