import React from "react";

/**
 * A page with a side pane, the pane filled while `open`, so open and closed differ by
 * more than color: the Panel's toggle, its pane at the end (a toggle for a pane at the
 * start mirrors it), and Document's thumbnails' toggle.
 */
export const PanelGlyph = ({ open = false }: { open?: boolean } = {}) => (
  <>
    <rect
      x="66"
      y="98"
      width="380"
      height="316"
      rx="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="40"
    />
    <path d="M320 98v316" fill="none" stroke="currentColor" strokeWidth="40" />
    {open && (
      <path
        fill="currentColor"
        stroke="none"
        d="M320 98h86a40 40 0 0 1 40 40v236a40 40 0 0 1-40 40h-86z"
      />
    )}
  </>
);
