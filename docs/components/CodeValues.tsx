"use client";

import React, { useRef, useState } from "react";

/**
 * The values a reader changes in live code, drawn in its runs: the homepage's editor's
 * (`PartsLive.tsx`) and the docs' live examples' (`Clover4/LiveCode.tsx`). Each is drawn
 * by the classes its editor gives it, in that editor's colors, and named for assistive
 * technology by its element and prop (`label`).
 */

/**
 * A number to type, step with the arrow keys (Shift for tens), or drag sideways, `rate`
 * steps a pixel: a press that does not drag puts the caret in it (WCAG 2.5.7). Out of
 * its range, what is typed comes back within it when the field is left.
 */
export function Scrub({
  label,
  min,
  max,
  step = 1,
  rate = 1,
  value,
  onChange,
  className,
  style,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  rate?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const from = useRef<{ x: number; value: number; moved: boolean } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);
  // What is typed, until it is a number in range or the field is left.
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (next: number) =>
    Math.min(max, Math.max(min, Math.round(next / step) * step));
  const stop = (event: React.PointerEvent<HTMLInputElement>) => {
    const pressed = from.current;
    from.current = null;
    setDragging(false);
    if (pressed && !pressed.moved) {
      event.currentTarget.focus();
      event.currentTarget.select();
    }
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={draft ?? value}
      className={className}
      style={style}
      data-dragging={dragging || undefined}
      onChange={(event) => {
        const typed = event.target.value;
        setDraft(typed);
        const next = Number(typed);
        if (typed !== "" && next >= min && next <= max) onChange(clamp(next));
      }}
      onBlur={() => {
        if (draft !== null && draft !== "") onChange(clamp(Number(draft)));
        setDraft(null);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // Not focused yet: a press that drags scrubs, one that does not types.
        if (document.activeElement === event.currentTarget) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        from.current = { x: event.clientX, value, moved: false };
      }}
      onPointerMove={(event) => {
        const pressed = from.current;
        if (!pressed) return;
        const dx = event.clientX - pressed.x;
        if (!pressed.moved && Math.abs(dx) < 3) return;
        pressed.moved = true;
        setDragging(true);
        onChange(clamp(pressed.value + dx * rate * step));
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          const next = Number(event.currentTarget.value);
          if (event.currentTarget.value !== "") onChange(clamp(next));
          setDraft(null);
          return;
        }
        const by =
          event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
        if (!by || !event.shiftKey) return;
        event.preventDefault();
        setDraft(null);
        onChange(clamp(value + by * 10 * step));
      }}
    />
  );
}

/** `true` or `false`, pressed to switch. */
export function Switch({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      className={className}
      onClick={() => onChange(!value)}
    >
      {String(value)}
    </button>
  );
}

/** One of a few values, picked from a menu, each as the code writes it (`"grid"`). */
export function Choice<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
  className,
  written = (option) => `"${String(option)}"`,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  written?: (option: T, index: number) => string;
}) {
  return (
    <select
      aria-label={label}
      className={className}
      value={String(options.indexOf(value))}
      onChange={(event) => onChange(options[Number(event.target.value)])}
    >
      {options.map((option, index) => (
        <option key={String(option)} value={String(index)}>
          {written(option, index)}
        </option>
      ))}
    </select>
  );
}

/** Text to type, as wide as what is typed. */
export function Text({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      aria-label={label}
      autoComplete="off"
      spellCheck={false}
      value={value}
      className={className}
      style={{ width: `${Math.max(value.length, 1) + 0.5}ch` }}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
