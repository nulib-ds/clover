"use client";

import React, { useEffect, useRef, useState } from "react";

/** The languages a terminal speaks: a command to run, drawn as the homepage's install is. */
const TERMINAL = new Set(["bash", "sh", "shell", "zsh", "console"]);

/**
 * Every code block on the site (Mat, 2026-10-22), around Nextra's own (`mdx-components.tsx`'s
 * `pre`): code drawn as the homepage's editor is, its language over it, its lines numbered
 * (`docs-code`, `docs/styles/code.css`); a command drawn as the homepage's install is, on the
 * editor's black (`docs-terminal`). Each has Copy, which says Copied for a moment, in its own
 * words and, for a screen reader, in a status that stays mounted (WCAG 4.1.3).
 */
export function CodeBlock({
  lang,
  children,
}: {
  lang?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  const terminal = TERMINAL.has(lang ?? "");
  const copy = () => {
    const text = ref.current?.querySelector("pre code")?.textContent;
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
      () => setCopied(true),
      () => undefined,
    );
  };
  return (
    <div ref={ref} className={terminal ? "docs-terminal" : "docs-code"}>
      {children}
      <button type="button" className="docs-code-copy" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <span role="status" className="docs-code-status">
        {copied ? (terminal ? "Copied the command" : "Copied the code") : ""}
      </span>
    </div>
  );
}
