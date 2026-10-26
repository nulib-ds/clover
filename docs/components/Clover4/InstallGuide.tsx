"use client";

import React, { useId, useState } from "react";
import { setCodeFlavor, useCodeFlavor } from "docs/lib/code-flavor";

type Way = "react" | "bundler" | "cdn";

const WAYS: { value: Way; label: string }[] = [
  { value: "react", label: "React" },
  { value: "bundler", label: "Web components" },
  { value: "cdn", label: "Web components from a CDN" },
];

/**
 * Get started's install, in steps, three ways (Mat, 2026-10-26): React, web components
 * through a bundler, or web components from a CDN. Its choice is drawn as the header's
 * code switch is (`CodeSwitch.tsx`), and is that switch's too: React chooses React's code
 * across the docs, either of the others the web components'. Each way is an `InstallWay`,
 * marked with its flavor (`data-code-flavor`), so the page's CSS shows the reader's before
 * it hydrates; which of the two web components ways shows is this guide's own
 * (`data-web`), the bundler's to start.
 */
export function InstallGuide({ children }: { children: React.ReactNode }) {
  const name = useId();
  const flavor = useCodeFlavor();
  const [web, setWeb] = useState<"bundler" | "cdn">("bundler");
  const chosen: Way = flavor === "react" ? "react" : web;
  const choose = (way: Way) => {
    if (way === "react") return setCodeFlavor("react");
    setWeb(way);
    setCodeFlavor("web-components");
  };
  return (
    <div className="install-guide" data-web={web}>
      <div className="code-switch" role="radiogroup" aria-label="Install with">
        {WAYS.map((way) => (
          <label
            key={way.value}
            className="code-switch-option"
            data-option={way.value}
          >
            <input
              type="radio"
              name={name}
              value={way.value}
              checked={chosen === way.value}
              onChange={() => choose(way.value)}
            />
            <span>{way.label}</span>
          </label>
        ))}
      </div>
      {children}
    </div>
  );
}

/** One way to install, its steps the page's MDX. */
export function InstallWay({
  way,
  children,
}: {
  way: Way;
  children: React.ReactNode;
}) {
  return (
    <div
      className="install-way"
      data-install={way}
      data-code-flavor={way === "react" ? "react" : "web-components"}
    >
      {children}
    </div>
  );
}
