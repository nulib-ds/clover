"use client";

import React, { useEffect, useState } from "react";
import styles from "docs/components/Home/Home.module.css";

const COMMAND = "npm install @nulib/clover";

/**
 * The install command on the code editor's black, with a Copy button at its end (Mat,
 * 2026-10-22), as the example viewer's editor has one: it says Copied for a moment, in
 * its own words and, for a screen reader, in a status that stays mounted (WCAG 4.1.3).
 */
export function InstallCommand() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className={styles.install} id="install">
      <pre className={styles.installCode}>
        <code>{COMMAND}</code>
      </pre>
      <button
        type="button"
        className={styles.installCopy}
        onClick={() =>
          navigator.clipboard?.writeText(COMMAND).then(
            () => setCopied(true),
            () => undefined,
          )
        }
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <span role="status" className={styles.visuallyHidden}>
        {copied ? "Copied the install command" : ""}
      </span>
    </div>
  );
}
