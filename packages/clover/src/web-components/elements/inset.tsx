import React, { useLayoutEffect } from "react";

import { InsetExpand } from "../../ui/Inset";
import { useUniqueId } from "../../ui/useUniqueId";
import type { HostedProps } from "../host";
import { Placed } from "./nodes";

/** The page's own controls for its corner (`slot="actions"`). */
const isAction = (node: Node) =>
  node instanceof Element && node.getAttribute("slot") === "actions";

/**
 * `<clover-inset>` (`specs/inset.ts`): `Inset` for the page's own thumb, which `Inset`
 * cannot hold as React children. The element is the box (`clover-inset`), its children the
 * thumb; it draws its expand button after them, in its corner, the page's own controls
 * (`slot="actions"`) placed after that, as `Inset` takes `actions`. A press on it but on a
 * button or link, or its expand button, sends `clover-expand`. Expanded, or with no
 * `label` for its button, it is the page's content as it is: no box, no buttons, nothing a
 * press does, its controls back where the page wrote them. Its label's language is
 * `label-lang`, on the button alone: `lang` on the element would be the thumb's too.
 */
export function InsetElement({ hosted, props }: HostedProps) {
  const element = hosted.element;
  const expanded = props.expanded === true;
  const label = typeof props.label === "string" ? props.label.trim() : "";
  const lang = typeof props.lang === "string" ? props.lang : undefined;
  const own = useUniqueId();
  const expandId =
    typeof props.expandId === "string" && props.expandId ? props.expandId : own;
  const controls =
    typeof props.controls === "string" ? props.controls : undefined;
  const onExpand = props.onExpand as (() => void) | undefined;
  // Without its words, no box and no press: its button is the keyboard's way in (WCAG 2.1.1).
  const small = !expanded && Boolean(label);
  useLayoutEffect(() => {
    element.classList.toggle("clover-inset", small);
    return () => element.classList.remove("clover-inset");
  }, [element, small]);
  // A press on it, but on a button or link of its own or the page's, expands it: from the
  // moment its button shows.
  useLayoutEffect(() => {
    if (!small) return;
    const press = (event: MouseEvent) => {
      if (!(event.target as Element).closest("button, a")) onExpand?.();
    };
    element.addEventListener("click", press);
    return () => element.removeEventListener("click", press);
  }, [element, small, onExpand]);
  if (!small) return null;
  return (
    <div className="clover-inset-actions">
      <InsetExpand
        id={expandId}
        label={label}
        lang={lang}
        controls={controls}
        onClick={() => onExpand?.()}
      />
      <Placed from={element} picks={isAction} />
    </div>
  );
}
