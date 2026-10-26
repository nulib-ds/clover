"use client";

import React, { useState } from "react";

import { type RadioCard, RadioCards } from "docs/components/RadioCards";
import { setCodeFlavor, useCodeFlavor } from "docs/lib/code-flavor";

type Way = "react" | "bundler" | "cdn";

const WAYS: RadioCard<Way>[] = [
  {
    value: "react",
    title: "React",
    note: "You build your site with React. Add Clover to your app like any other package.",
  },
  {
    value: "bundler",
    title: "Web components (npm)",
    note: "Your site has a build step, but no React. Install Clover once, then use it on any page.",
  },
  {
    value: "cdn",
    title: "Web components (CDN)",
    note: "Plain HTML or an embed, no build step. Paste one line into a CMS or a blog post.",
  },
];

/**
 * Get started's install, in steps, three ways (Mat, 2026-10-26): React, web components
 * through a bundler, or web components from a CDN. Its choice is radio cards, as the
 * step's after it (`RadioCards`; Mat, 2026-10-26), and is the header's code switch's too
 * (`CodeSwitch.tsx`): React chooses React's code across the docs, either of the others
 * the web components'. Each way is an `InstallWay`, marked with its flavor
 * (`data-code-flavor`), so the page's CSS shows the reader's before it hydrates; which
 * of the two web components ways shows is this guide's own (`data-web`), the bundler's
 * to start.
 */
export function InstallGuide({ children }: { children: React.ReactNode }) {
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
      <RadioCards
        label="Your setup"
        options={WAYS}
        value={chosen}
        onChange={choose}
      />
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
