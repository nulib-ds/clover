import React, { useState } from "react";

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
   * The controls to render, given whether the cluster sits inside whatever is full
   * screen — so the full-screen control can name and draw the way out.
   */
  controls: (isFullscreen: boolean) => ControlSpec[];
  /** Consumer replacements, keyed like `ControlSpec.key`. */
  controlButtons?: ControlButtons;
  hasPlaceholder?: boolean;
  /** Rendered after the controls: a host's own controls. */
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
 * The zoom, full-screen, rotate and reset cluster over a Canvas: its markup, its layout
 * hooks, and the `controlButtons` replacement contract — and nothing else. Presentational:
 * the host hands it click handlers.
 */
const ControlCluster: React.FC<ControlClusterProps> = ({
  controls,
  controlButtons,
  hasPlaceholder = false,
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
  /*
   * Full screen ends the view's controls, over every picture alike, whichever of them a
   * Canvas offers: left of what follows them, the `i` among it (Mat, 2026-10-29).
   */
  const specs = controls(isFullscreen);
  const ordered = [
    ...specs.filter((spec) => spec.key !== "fullPage"),
    ...specs.filter((spec) => spec.key === "fullPage"),
  ];

  return (
    <div
      className="clover-canvas-controls"
      data-fullscreen={isFullscreen}
      data-has-placeholder={hasPlaceholder}
      data-testid="clover-canvas-controls"
      ref={setElement}
    >
      {ordered.map((spec) => renderControl(spec, controlButtons))}
      {children}
    </div>
  );
};

export default ControlCluster;
