import React, { useEffect, useRef, useState } from "react";

import { Panel, type PanelProps, Tab } from "../../components/Panel/Panel";
import type { HostedProps } from "../host";
import { Copy, Moved, slotOf, useWatched } from "./nodes";

interface TabRead {
  element: Element;
  value: string;
  label: string;
  /** Its `slot="label"` child, markup for what it says. */
  labelSlot: Element | null;
}

/** A panel's `<clover-tab>`s, in their order: each one's value, label and label slot. */
const tabsOf = (panel: Element): TabRead[] =>
  [...panel.children]
    .filter((child) => child.localName === "clover-tab")
    .map((tab, index) => {
      const value = tab.getAttribute("value") || String(index);
      return {
        element: tab,
        value,
        // A tab with no words of its own is called by its value, never left unnamed.
        label: tab.getAttribute("label") || value,
        labelSlot: slotOf(tab, "label"),
      };
    });

const sameTabs = (a: TabRead[], b: TabRead[]) =>
  a.length === b.length &&
  a.every(
    (tab, index) =>
      tab.element === b[index].element &&
      tab.value === b[index].value &&
      tab.label === b[index].label &&
      tab.labelSlot === b[index].labelSlot,
  );

/** A tab's label stays in it; the rest of what it holds is its section's. */
const isLabel = (node: Node) =>
  node instanceof Element && node.getAttribute("slot") === "label";

/** A key for each tab, for as long as the tab is on the page. */
const keys = new WeakMap<Element, number>();
let made = 0;
const keyOf = (tab: Element) => {
  if (!keys.has(tab)) keys.set(tab, ++made);
  return keys.get(tab)!;
};

/**
 * What a closed panel hides: what its toggle shows (the nearest element around it, or
 * itself, that a control's `aria-controls` names), else the panel itself.
 */
function hideClosed(panel: HTMLElement) {
  const doc = panel.ownerDocument;
  for (
    let node: HTMLElement | null = panel;
    node && node !== doc.body;
    node = node.parentElement
  ) {
    if (!node.id) continue;
    const named = node.id.replace(/["\\]/g, "\\$&");
    if (doc.querySelector(`[aria-controls~="${named}"]`)) {
      node.hidden = true;
      return;
    }
  }
  panel.hidden = true;
}

/**
 * `<clover-panel>` (`specs/containers.ts`): `Panel`, with the sections Clover has data
 * for, or a `Tab` for each `<clover-tab>` in it, in their order. A tab's own content is
 * moved into its section when the section first opens, and its label is its `label`, or a
 * copy of its `slot="label"` child. `value` is where it opens, and shows another tab when
 * it changes; the reader's choice is told by `clover-value-change`. Closable, it closes as
 * `clover-close` lets it: what its toggle shows, or itself, hidden.
 */
export function PanelElement({ hosted, props }: HostedProps) {
  const element = hosted.element;
  const tabs = useWatched(element, () => tabsOf(element), sameTabs);
  const { value, closable, onValueChange, onClose, ...rest } =
    props as unknown as {
      value?: string;
      closable?: boolean;
      onValueChange: (value: string) => void;
      onClose: () => boolean;
    } & PanelProps;

  const [shown, setShown] = useState(value);
  // Changed later, the attribute shows that tab, as the reader's choice would.
  const given = useRef(value);
  useEffect(() => {
    if (value === given.current) return;
    given.current = value;
    if (value) setShown(value);
  }, [value]);

  return (
    <Panel
      {...rest}
      value={shown}
      onValueChange={(next) => {
        setShown(next);
        onValueChange(next);
      }}
      onClose={
        closable
          ? () => {
              if (onClose()) hideClosed(element);
            }
          : undefined
      }
    >
      {tabs.length
        ? tabs.map((tab) => (
            <Tab
              key={keyOf(tab.element)}
              value={tab.value}
              label={tab.labelSlot ? <Copy of={tab.labelSlot} /> : tab.label}
            >
              <Moved from={tab.element} stays={isLabel} />
            </Tab>
          ))
        : null}
    </Panel>
  );
}
