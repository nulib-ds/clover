import { type RefObject, useEffect } from "react";

import { useControlsVisibility } from "../Body/useControlsVisibility";

/**
 * A video's controls coming and going, as a Timeline's do (`useControlsVisibility`): a
 * part of its own, which `CanvasView` loads only for a Canvas that shows a video (Mat,
 * 2026-11-01), so a picture's page carries none of the hook's code. It says whether they
 * show (`onChange`) and draws nothing.
 */
export default function ControlsFade({
  element,
  hideDelay,
  picture,
  onChange,
}: {
  element: HTMLElement | null;
  hideDelay?: number;
  picture: RefObject<HTMLElement | null>;
  onChange: (visible: boolean) => void;
}) {
  const visible = useControlsVisibility(element, hideDelay, picture);
  useEffect(() => onChange(visible), [visible, onChange]);
  return null;
}
