import React, {
  Component,
  type ErrorInfo,
  type ReactNode,
  memo,
  useCallback,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";

import { IdPrefixContext } from "../ui/useUniqueId";

/**
 * The host: one render tree for the page, whatever Clover elements it holds, loaded the
 * first time one connects. Each `<clover-root>` is a provider in it, and each part is
 * drawn into its own element by a portal, inside its root's provider. So a part reads its
 * root's context as it does in React, and the page's markup inside an element stays as
 * written: a portal adds to an element, it does not replace what is in it.
 *
 * The tree is rendered into an element the page never holds: the host draws nothing of
 * its own, only what its portals put into the elements.
 */

/** What the host needs of an element it draws. */
export interface Hosted {
  /** The element: what it reads its props from, and where a part is drawn. */
  readonly element: HTMLElement;
  /**
   * A `<clover-root>`, which provides for the parts inside it; a part, drawn inside its
   * root or by itself; or one always drawn by itself (`<clover-viewer>`).
   */
  readonly kind: "root" | "part" | "alone";
  /** A part with nothing to show outside a `<clover-root>`. */
  readonly needsRoot?: boolean;
  /** What it draws: a root's provider, its parts as children, or a part. */
  readonly Component: React.ComponentType<HostedProps>;
  /** Its props, as its attributes and properties give them: one object until they change. */
  getProps(): Readonly<Record<string, unknown>>;
  subscribe(listener: () => void): () => void;
}

export interface HostedProps {
  hosted: Hosted;
  props: Readonly<Record<string, unknown>>;
  children?: ReactNode;
}

const ROOT = "clover-root";

interface Entry {
  readonly hosted: Hosted;
  /** Its key in the tree, for as long as it is on the page. */
  readonly key: number;
  /** The `<clover-root>` a part is inside (defined yet or not), or null. */
  readonly root: HTMLElement | null;
}

/**
 * A list the tree draws: the roots (`ROOTS`), a root's parts (by its element), or what is
 * drawn by itself (`null`).
 */
type ListKey = HTMLElement | null | typeof ROOTS;
const ROOTS = Symbol("roots");
const NONE: Entry[] = [];

/** The elements on one page, by element, and the lists the tree draws of them. */
export class Registry {
  private readonly entries = new Map<HTMLElement, Entry>();
  private readonly lists = new Map<ListKey, Entry[]>();
  private readonly listeners = new Map<ListKey, Set<() => void>>();
  private readonly languages = new LanguageWatch((element) =>
    this.entries.has(element),
  );

  /** `count`: the page's, which every copy of Clover's elements on it counts in. */
  constructor(private readonly count: { made: number }) {}

  /** A list, the same array until it changes. */
  list(key: ListKey): Entry[] {
    return this.lists.get(key) ?? NONE;
  }

  /** Hear of changes to one list alone, so an element's coming troubles no other root. */
  subscribe(key: ListKey, listener: () => void) {
    let heard = this.listeners.get(key);
    if (!heard) this.listeners.set(key, (heard = new Set()));
    heard.add(listener);
    return () => {
      heard.delete(listener);
    };
  }

  /**
   * An element is on the page: new, or moved, when it may be inside another root now. A
   * part waits for its root, which may be defined after it.
   */
  connect(hosted: Hosted) {
    const root =
      hosted.kind === "part"
        ? (hosted.element.parentElement?.closest<HTMLElement>(ROOT) ?? null)
        : null;
    const entry = this.entries.get(hosted.element);
    if (entry && entry.root === root) return;
    const next = { hosted, key: entry?.key ?? ++this.count.made, root };
    this.entries.set(hosted.element, next);
    if (entry)
      this.change(listOf(entry), (list) => list.filter((e) => e !== entry));
    this.change(listOf(next), (list) => [...list, next]);
    if (hosted.needsRoot && !root) {
      console.warn(
        `<${hosted.element.localName}> shows a <clover-root>'s state: put it inside one.`,
      );
    }
    if (hosted.kind !== "root") this.languages.draws(hosted.element.localName);
    if (hosted.kind !== "part" || !root) this.languages.watch(hosted.element);
  }

  /** An element has left the page (not moved: a move connects it again at once). */
  disconnect(element: HTMLElement) {
    const entry = this.entries.get(element);
    if (!entry) return;
    this.entries.delete(element);
    this.change(listOf(entry), (list) => list.filter((e) => e !== entry));
  }

  private change(key: ListKey, edit: (list: Entry[]) => Entry[]) {
    this.lists.set(key, edit(this.list(key)));
    this.listeners.get(key)?.forEach((listener) => listener());
  }
}

/** The list an entry is drawn in. */
const listOf = (entry: Entry): ListKey =>
  entry.hosted.kind === "root" ? ROOTS : entry.root;

/**
 * Where Clover drops a `lang` (its words now in the page's language), React removes the
 * attribute but Preact empties it, and `lang=""` says the language is unknown (WCAG
 * 3.1.2). One observer for the page removes it from what the host draws: inside a part,
 * or a root's live region, never the page's own markup between them.
 */
class LanguageWatch {
  private observer: MutationObserver | null = null;
  private readonly tags = new Set<string>();

  constructor(private readonly isElement: (element: HTMLElement) => boolean) {}

  /** A kind of element the host draws into. */
  draws(tag: string) {
    this.tags.add(tag);
  }

  watch(element: HTMLElement) {
    this.observer ??= new MutationObserver((records) => {
      const drawn = [...this.tags, ".clover-announcer"].join(",");
      for (const { target } of records) {
        const node = target as HTMLElement;
        if (node.getAttribute("lang") !== "" || this.isElement(node)) continue;
        if (node.closest(drawn)) node.removeAttribute("lang");
      }
    });
    this.observer.observe(element, {
      subtree: true,
      attributes: true,
      attributeFilter: ["lang"],
    });
  }
}

/** One of the registry's lists, re-rendering only when it changes. */
function useList(registry: Registry, key: ListKey): Entry[] {
  const subscribe = useCallback(
    (listener: () => void) => registry.subscribe(key, listener),
    [registry, key],
  );
  const read = () => registry.list(key);
  return useSyncExternalStore(subscribe, read, read);
}

/** An element's props, re-rendering only it when they change. */
function useProps(hosted: Hosted) {
  return useSyncExternalStore(
    hosted.subscribe,
    hosted.getProps,
    hosted.getProps,
  );
}

function Host({ registry }: { registry: Registry }) {
  const roots = useList(registry, ROOTS);
  const alone = useList(registry, null);
  return (
    <>
      {roots.map((entry) => (
        <RootSlot key={entry.key} entry={entry} registry={registry} />
      ))}
      {alone.map((entry) => (
        <PartSlot key={entry.key} entry={entry} />
      ))}
    </>
  );
}

/*
 * Each element's ids start with its own number. One tree does not make them unique by
 * itself: Preact counts `useId` afresh in each portal (unless the tree's root has used one
 * first, an implementation detail not to lean on). And Preact's ids alone are a page's own
 * Preact's too.
 */
const idPrefix = (entry: Entry) => `clover-${entry.key}-`;

/** A `<clover-root>`'s provider, around its parts. */
const RootSlot = memo(function RootSlot({
  entry,
  registry,
}: {
  entry: Entry;
  registry: Registry;
}) {
  const { hosted } = entry;
  const parts = useList(registry, hosted.element);
  const props = useProps(hosted);
  const Draw = hosted.Component;
  return (
    <Boundary hosted={hosted} props={props}>
      <IdPrefixContext.Provider value={idPrefix(entry)}>
        <Draw hosted={hosted} props={props}>
          {parts.map((part) => (
            <PartSlot key={part.key} entry={part} />
          ))}
        </Draw>
      </IdPrefixContext.Provider>
    </Boundary>
  );
});

/** A part, drawn into its element. */
const PartSlot = memo(function PartSlot({ entry }: { entry: Entry }) {
  const { hosted } = entry;
  const props = useProps(hosted);
  // Outside a root it has nothing to show (the registry has said so).
  if (hosted.needsRoot && !entry.root) return null;
  const Draw = hosted.Component;
  // The boundary inside the portal, so it catches what the part's own effects throw.
  return createPortal(
    <Boundary hosted={hosted} props={props}>
      <IdPrefixContext.Provider value={idPrefix(entry)}>
        <Draw hosted={hosted} props={props} />
      </IdPrefixContext.Provider>
    </Boundary>,
    hosted.element,
  );
});

/**
 * One element's failure stays its own: with one tree for the page, an error left to rise
 * would take every Clover element on it down. It draws nothing until its props change.
 */
class Boundary extends Component<
  { hosted: Hosted; props: unknown; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void info;
    console.error(`<${this.props.hosted.element.localName}>:`, error);
  }

  componentDidUpdate(previous: { props: unknown }) {
    if (this.state.failed && previous.props !== this.props.props) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const hosts = new WeakMap<Document, Registry>();

/**
 * The count of the page's elements, kept on its document for every copy of Clover's
 * elements there: a page that loads both entries, `web-components` and
 * `web-components/viewer`, has two hosts, whose ids (`clover-<n>-`) must never meet.
 */
const COUNT = Symbol.for("clover.elements");

/** The page's host, made the first time a Clover element connects to it. */
export function hostOf(doc: Document): Registry {
  let registry = hosts.get(doc);
  if (!registry) {
    const page = doc as unknown as Record<symbol, { made: number } | undefined>;
    if (page[COUNT])
      console.warn("Clover is loaded twice on this page: load one entry.");
    registry = new Registry((page[COUNT] ??= { made: 0 }));
    hosts.set(doc, registry);
    createRoot(doc.createElement("div")).render(<Host registry={registry} />);
  }
  return registry;
}
