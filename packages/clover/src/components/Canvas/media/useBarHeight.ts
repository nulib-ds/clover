import { type RefObject, useLayoutEffect } from "react";

/**
 * A transport bar's height, written to its Canvas as `--clover-transport-bar-height`,
 * for what has to clear the bar (`--clover-transport-room`, `Transport.css`): a narrow
 * stage wraps it onto two rows, and larger text or text spacing make a row taller.
 */
export function useBarHeight(bar: RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    const element = bar.current;
    const canvas = element?.closest<HTMLElement>(".clover-canvas");
    if (!element || !canvas) return;
    const write = () => {
      const height = element.offsetHeight;
      if (height) {
        canvas.style.setProperty(
          "--clover-transport-bar-height",
          `${height}px`,
        );
      }
    };
    write();
    const observer = new ResizeObserver(write);
    observer.observe(element);
    return () => {
      observer.disconnect();
      canvas.style.removeProperty("--clover-transport-bar-height");
    };
  }, [bar]);
}
