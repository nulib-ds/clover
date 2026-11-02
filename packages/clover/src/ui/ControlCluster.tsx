import React, { useCallback, useState } from "react";

import Button from "./Button";
import { type Shortcut, Tip } from "./Tip";
import { ControlIcon } from "./controlGlyphs";
import type { ControlButtons } from "./controlButtons";
import { useClusterReach } from "./useClusterReach";
import useWithinFullscreen from "../hooks/useWithinFullscreen";

export interface ControlSpec {
  key: keyof ControlButtons;
  /** `<key>-<instance>`: `Button` derives its `data-button` from the prefix. */
  id: string;
  label: string;
  glyph: React.ReactElement;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** For a control that opens a menu: whether it is open, and the menu's id. */
  expanded?: boolean;
  controls?: string;
  /** The key the Canvas answers to for it, shown in its popover. */
  shortcut?: Shortcut;
  /** The language of `label`, where it is not the page's: Clover's, or a Choice's. */
  lang?: string;
}

export interface ControlClusterProps {
  /**
   * One row that never wraps, the controls that do not fit behind More: a Canvas's
   * (`Canvas/ImageControls.tsx`, measured by `Canvas/RowFits.tsx`), which lays them out. Otherwise rows that wrap: a Timeline's, a
   * Scene's.
   */
  fit?: boolean;
  /** The cluster's element, for a host that measures it (a Canvas, for its row). */
  clusterRef?: (element: HTMLDivElement | null) => void;
  /** The controls: a host's (a Canvas's, a Scene's), and a page's own after them. */
  children?: React.ReactNode;
}

/**
 * A control, or a consumer's in its place when one is configured (`controlButtons`). The
 * replacement owns the element, so it is handed props to spread rather than being told
 * what to render: the accessible name has to survive whatever markup the consumer
 * chooses. The cluster's, and a Scene's rotate pad's (`Scene/RotatePad.tsx`).
 */
export function renderControl(
  {
    key,
    id,
    label,
    glyph,
    onClick,
    expanded,
    controls,
    shortcut,
    lang,
  }: ControlSpec,
  controlButtons?: ControlButtons,
) {
  const Custom = controlButtons?.[key];
  if (Custom)
    return (
      <Custom
        key={key}
        buttonProps={{
          id,
          type: "button",
          "aria-label": label,
          ...(lang && { lang }),
          ...(shortcut && { "aria-keyshortcuts": shortcut.keys }),
          onClick,
          ...(expanded !== undefined && {
            "aria-expanded": expanded,
            "aria-controls": controls,
          }),
        }}
        icon={<ControlIcon label={label}>{glyph}</ControlIcon>}
        label={label}
        tip={<Tip label={label} shortcut={shortcut} />}
      />
    );
  return (
    <Button
      key={key}
      id={id}
      label={label}
      onClick={onClick}
      expanded={expanded}
      controls={controls}
      shortcut={shortcut}
      lang={lang}
    >
      {glyph}
    </Button>
  );
}

/**
 * The cluster of controls over a Body, in its top end: its box, its layout hooks, and
 * nothing else. What it holds is its host's: a Canvas's controls (`Canvas/Controls.tsx`,
 * fitted to one row), a Scene's `i`, and the controls a page gives either.
 */
const ControlCluster: React.FC<ControlClusterProps> = ({
  fit = false,
  clusterRef,
  children,
}) => {
  /*
   * Whether these controls are inside whatever is full screen.
   *
   * Containment rather than identity, because the control cannot know which root the browser
   * put in full screen: the `Viewer`'s when nested, the Canvas's own when standalone.
   */
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const isFullscreen = useWithinFullscreen(element);
  // How far it reaches, wrapped on a small Body, for the popups it opens to clear.
  useClusterReach(element);
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      setElement(node);
      clusterRef?.(node);
    },
    [clusterRef],
  );

  return (
    <div
      className="clover-canvas-controls"
      data-fit={fit || undefined}
      data-fullscreen={isFullscreen}
      data-testid="clover-canvas-controls"
      ref={ref}
    >
      {children}
    </div>
  );
};

export default ControlCluster;
