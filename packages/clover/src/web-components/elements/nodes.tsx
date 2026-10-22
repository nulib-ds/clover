import React, {
  useCallback,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

/*
 * What a container element reads of the page's markup inside it (a panel's tabs, a
 * status's slots, a stage's toggle), and how the page's own nodes are shown where the part
 * draws them: copied (a slot), moved (a tab's content), or handed back by a function of the
 * page's (`renderItem`).
 */

/** Every element and text the page writes inside an element can change what it reads. */
const WATCHED = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["value", "label", "slot", "controls"],
};

/**
 * What a part reads of its element's children, read again whenever the page changes them,
 * and the same value until what is read changes (`same`). The part's own drawing inside
 * the element is read past: it changes nothing read.
 */
export function useWatched<T>(
  element: HTMLElement,
  read: () => T,
  same: (a: T, b: T) => boolean,
): T {
  const last = useRef<{ value: T } | null>(null);
  const subscribe = useCallback(
    (listener: () => void) => {
      const observer = new MutationObserver(listener);
      observer.observe(element, WATCHED);
      return () => observer.disconnect();
    },
    [element],
  );
  const snapshot = () => {
    const value = read();
    if (last.current && same(last.current.value, value))
      return last.current.value;
    last.current = { value };
    return value;
  };
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** An element's child by its `slot`, or null. */
export const slotOf = (element: Element, name: string) =>
  [...element.children].find((child) => child.getAttribute("slot") === name) ??
  null;

/** An element's child that is a slot (`slot="loading"`…), watched. */
export function useSlot(element: HTMLElement, name: string) {
  return useWatched(element, () => slotOf(element, name), Object.is);
}

/**
 * A copy of what a slot holds, where the part draws it, kept in step as the page changes
 * it. The slot itself stays where the page wrote it, hidden (`base.ts`), so there is one of
 * it for assistive technology. A copy repeats any id, so a slot's markup takes none.
 */
export function Copy({ of }: { of: Element }) {
  const box = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const into = box.current;
    if (!into) return;
    const copy = () =>
      into.replaceChildren(
        ...[...of.childNodes].map((node) => node.cloneNode(true)),
      );
    copy();
    const observer = new MutationObserver(copy);
    observer.observe(of, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    return () => observer.disconnect();
  }, [of]);
  return <span ref={box} style={{ display: "contents" }} />;
}

/**
 * What the page wrote in an element (a tab's content), moved where the part draws it, and
 * back where it was when the part lets it go, so the page's markup is never lost, nor its
 * listeners: the page's own nodes, not copies. What the page adds there later follows.
 * `stays` keeps a node where it is (a tab's label).
 */
export function Moved({
  from,
  stays,
}: {
  from: Element;
  stays: (node: Node) => boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const into = box.current;
    if (!into) return;
    const move = () => {
      for (const node of [...from.childNodes])
        if (!stays(node)) into.append(node);
    };
    move();
    const observer = new MutationObserver(move);
    observer.observe(from, { childList: true });
    return () => {
      observer.disconnect();
      from.append(...into.childNodes);
    };
  }, [from, stays]);
  return <div ref={box} style={{ display: "contents" }} />;
}

/** What a function of the page's drew, a node or text, where the part draws it. */
function Drawn({ value }: { value: unknown }) {
  const box = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    box.current?.replaceChildren(value instanceof Node ? value : String(value));
  }, [value]);
  return <span ref={box} style={{ display: "contents" }} />;
}

/**
 * The page's functions that draw part of a part (`renderItem`…), each made to hand the part
 * what it drew: a node or text, shown where the part draws its own. `undefined` stays
 * `undefined` (Metadata draws its own value then) and `null` draws nothing.
 */
export function withNodes(
  props: Readonly<Record<string, unknown>>,
  names: readonly string[],
): Readonly<Record<string, unknown>> {
  let given = props;
  for (const name of names) {
    const draw = props[name];
    if (typeof draw !== "function") continue;
    given = {
      ...given,
      [name]: (...args: unknown[]) => {
        const value = (draw as (...args: unknown[]) => unknown)(...args);
        return value == null ? value : <Drawn value={value} />;
      },
    };
  }
  return given;
}
