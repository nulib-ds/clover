"use client";

import React from "react";

import { Choice, Scrub, Switch, Text } from "docs/components/CodeValues";
import live from "docs/components/Clover4/LiveCode.module.css";
import { type Knob, type Plain, type TokenKind } from "docs/lib/live-code";

/**
 * A knob's value in a live example's code, as the control its kind is: a menu, a switch,
 * a number to type, step or drag, or text to type (`LiveCode.tsx`, `PartsEditor.tsx`).
 */
export function Control({
  knob,
  value,
  choices,
  kind,
  onChange,
}: {
  knob: Knob;
  value: Plain;
  choices?: string[];
  kind?: TokenKind;
  onChange: (value: Plain) => void;
}) {
  const label = knob.label ?? knob.prop;
  const color = kind === "string" ? live.string : live.number;
  if (knob.options)
    return (
      <Choice
        label={label}
        options={knob.options}
        value={value}
        onChange={onChange}
        written={(option, index) => choices?.[index] ?? String(option)}
        className={`${live.value} ${live.choice} ${color}`}
      />
    );
  if (typeof value === "boolean")
    return (
      <Switch
        label={label}
        value={value}
        onChange={onChange}
        className={`${live.value} ${live.number}`}
      />
    );
  if (typeof value === "number") {
    const min = knob.min ?? 0;
    const max = knob.max ?? 100;
    const step = knob.step ?? 1;
    return (
      <Scrub
        label={label}
        min={min}
        max={max}
        step={step}
        // A pixel a pixel, or across its range in some 200, whichever is slower.
        rate={Math.min(1, (max - min) / step / 200)}
        value={value}
        onChange={onChange}
        className={`${live.value} ${live.scrub} ${live.number}`}
        // As wide as its value, so the code around it reads as written (`"8rem"`).
        style={{ width: `${Math.max(String(value).length, 1)}ch` }}
      />
    );
  }
  return (
    <Text
      label={label}
      value={value}
      onChange={onChange}
      className={`${live.value} ${live.text} ${live.string}`}
    />
  );
}
