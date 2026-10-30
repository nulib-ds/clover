import React, { useEffect, useRef } from "react";

/**
 * The end of a list that loads as it is read (an AnnotationCollection's annotations, every
 * annotation in Annotations): as it comes into view, the list scrolled or a key moving
 * through it to its last, `onReached` asks for more. Nothing to see or read.
 */
export function ListEnd({ onReached }: { onReached: () => void }) {
  const end = useRef<HTMLSpanElement>(null);
  const reached = useRef(onReached);
  reached.current = onReached;
  useEffect(() => {
    const element = end.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((seen) => {
      if (seen.some((each) => each.isIntersecting)) reached.current();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <span
      ref={end}
      className="clover-list-end"
      aria-hidden="true"
      style={{ display: "block", height: 1 }}
    />
  );
}
