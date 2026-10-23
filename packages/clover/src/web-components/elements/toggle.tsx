import React, { useCallback, useSyncExternalStore } from "react";

import { PanelToggle } from "../../components/Panel/PanelToggle";
import type { HostedProps } from "../host";

type Props = Readonly<Record<string, unknown>>;

/** What an element of Clover's says it is: its props, as it reads them, kept in step. */
interface Upgraded {
  getProps(): Props;
  subscribe(listener: () => void): () => void;
}

const NONE: Props = {};
const unsubscribed = () => () => undefined;

function useElementProps(element: HTMLElement): Props {
  const upgraded =
    "getProps" in element ? (element as unknown as Upgraded) : null;
  return useSyncExternalStore(
    upgraded?.subscribe ?? unsubscribed,
    upgraded?.getProps ?? (() => NONE),
    upgraded?.getProps ?? (() => NONE),
  );
}

/** Whether what a toggle controls shows: open while it is not `hidden`, whoever hides it. */
function useOpen(doc: Document, id: string | undefined) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const target = id ? doc.getElementById(id) : null;
      if (!target) return () => undefined;
      const observer = new MutationObserver(listener);
      observer.observe(target, {
        attributes: true,
        attributeFilter: ["hidden"],
      });
      return () => observer.disconnect();
    },
    [doc, id],
  );
  const read = () => {
    const target = id ? doc.getElementById(id) : null;
    return Boolean(target && !target.hidden);
  };
  return useSyncExternalStore(subscribe, read, read);
}

/**
 * The `PanelToggle` a `<clover-panel-toggle>` is, wherever it is drawn: what it controls,
 * by its id, shown and hidden as the reader presses it, unless the page cancels its
 * `clover-open-change`. Its state is the target's: a page that hides the panel itself, or
 * writes it `hidden` to start shut, is followed.
 */
export function Toggle({ element }: { element: HTMLElement }) {
  const props = useElementProps(element);
  const controls = (props.controls as string | undefined) ?? undefined;
  const doc = element.ownerDocument;
  const open = useOpen(doc, controls);
  return (
    <PanelToggle
      open={open}
      controls={controls}
      onOpenChange={(next) => {
        const allowed =
          (props.onOpenChange as ((open: boolean) => boolean) | undefined)?.(
            next,
          ) ?? true;
        const target = controls ? doc.getElementById(controls) : null;
        if (allowed && target) target.hidden = !next;
      }}
    />
  );
}

/**
 * `<clover-panel-toggle>` (`specs/containers.ts`): a button where it is; in a
 * `<clover-body>`, one of the stage's controls, which the stage draws (`content.tsx`).
 */
export function PanelToggleElement({ hosted }: HostedProps) {
  if (hosted.element.parentElement?.localName === "clover-body") return null;
  return <Toggle element={hosted.element} />;
}
