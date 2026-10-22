"use client";

import React from "react";
import { Select } from "nextra/components";
import { useMounted } from "nextra/hooks";
import { MoonIcon, SunIcon } from "nextra/icons";
import { useTheme } from "nextra-theme-docs";

const OPTIONS = [
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
  { id: "system", name: "System" },
];

/**
 * The site's appearance, Light, Dark or System, in the footer's row of links after
 * Clover 3.x, on every page (Mat, 2026-10-21). Nextra's own switch, drawn as Nextra draws
 * it (its `Select`, a listbox), here rather than in the sidebar's foot, the phone's menu
 * and a band over the footer, where the layout turns Nextra's off (`darkMode={false}`,
 * `app/layout.tsx`). Until the page hydrates it shows Light, as Nextra's does.
 */
export function ThemeSwitch() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const mounted = useMounted();
  const value = (mounted && theme) || "light";
  const Icon = mounted && resolvedTheme === "dark" ? MoonIcon : SunIcon;
  return (
    <Select
      className="site-footer-theme"
      title="Change theme"
      options={OPTIONS}
      onChange={setTheme}
      value={value}
      selectedOption={
        <>
          <Icon height="12" aria-hidden="true" />
          {OPTIONS.find((option) => option.id === value)?.name}
        </>
      }
    />
  );
}
