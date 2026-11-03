"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** The languages a terminal speaks: a command to run, drawn as the homepage's install is. */
const TERMINAL = new Set(["bash", "sh", "shell", "zsh", "console"]);

/**
 * The lines an example's code shows until its button shows them all (Mat, 2026-11-03),
 * as `.docs-code[data-clipped]` cuts them (`docs/styles/code.css`, which says 20 too).
 */
export const CLIP_LINES = 20;
/** Code only a few lines longer shows whole: a button for two more lines is no help. */
const CLIP_SLACK = 5;

/** Whether code blocks inside are cut short: an example's code is (`CodeArea`). */
export const ClipContext = createContext(false);

/**
 * Every code block on the site (Mat, 2026-10-22), around Nextra's own (`mdx-components.tsx`'s
 * `pre`): code drawn as the homepage's editor is, its language over it, its lines numbered
 * (`docs-code`, `docs/styles/code.css`); a command drawn as the homepage's install is, on the
 * editor's black (`docs-terminal`). Each has Copy, which says Copied for a moment, in its own
 * words and, for a screen reader, in a status that stays mounted (WCAG 4.1.3).
 *
 * An example's code longer than `CLIP_LINES` (and its slack) shows its first lines, as
 * Clover's `ReadMore` cuts text short, and a button under them shows them all
 * (`aria-expanded`) and cuts them short again. The lines cut are out of sight and out of
 * the accessibility tree, but still in the page, for Copy, agents and search. Cut on the
 * server, so nothing moves as the page loads; whole where scripts do not run
 * (`app/layout.tsx`'s `noscript`).
 */
export function CodeBlock({
  lang,
  lines = 0,
  children,
}: {
  lang?: string;
  /** How many lines the code has (`mdx-components.tsx`). */
  lines?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const clips = useContext(ClipContext) && lines > CLIP_LINES + CLIP_SLACK;
  const [open, setOpen] = useState(false);
  const toggled = useRef(false);
  // Cut short again, the button rises with the code: keep it, and focus on it, in view.
  useLayoutEffect(() => {
    if (!toggled.current || open) return;
    more.current?.scrollIntoView({ block: "nearest" });
  }, [open]);
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
    <div
      ref={ref}
      className={terminal ? "docs-terminal" : "docs-code"}
      data-clips={clips ? "" : undefined}
      data-clipped={clips && !open ? "" : undefined}
    >
      {children}
      {clips && (
        <button
          ref={more}
          type="button"
          className="docs-code-more"
          aria-expanded={open}
          data-pagefind-ignore
          onClick={() => {
            toggled.current = true;
            setOpen((was) => !was);
          }}
        >
          {open ? "Show fewer lines" : `Show all ${lines} lines`}
        </button>
      )}
      <button type="button" className="docs-code-copy" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <span role="status" className="docs-code-status">
        {copied ? (terminal ? "Copied the command" : "Copied the code") : ""}
      </span>
    </div>
  );
}
