"use client";

import React, { useEffect, useRef } from "react";

import styles from "./Home.module.css";

/** How far into the window its words must come before a stroke draws: past its lower quarter. */
const POINT = "0px 0px -25% 0px";

/**
 * Words under the hero's stroke (`.mark`, `.figureMark`), the stroke drawn once they reach a
 * point in the window, and drawn from then on until the page loads again (Mat, 2026-10-22:
 * never by the scroll's own position). It writes `data-drawn`, which its CSS draws it by,
 * outside React, so a render never takes it back. The stroke is three spans, its box, a
 * window and its ink, so it can be drawn from end to end by transforms alone
 * (`Home.module.css`), never stretched.
 */
export function Swoosh({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const draw = () => element.setAttribute("data-drawn", "");
    if (typeof IntersectionObserver === "undefined") return draw();
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        draw();
        observer.disconnect();
      },
      { rootMargin: POINT, threshold: 1 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <span ref={ref} className={className}>
      {children}
      <span className={styles.stroke} aria-hidden="true">
        <span className={styles.strokeWindow}>
          <span className={styles.strokeInk} />
        </span>
      </span>
    </span>
  );
}
