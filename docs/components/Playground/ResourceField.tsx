import React, { useEffect, useId, useRef, useState } from "react";
import { resources } from "docs/components/Playground/playground-config";

import styles from "docs/components/Playground/Playground.module.css";

/** The reader's own resource, where a resource's key would be. */
export const OWN = "own";

/** The list's first item: an empty field, for the reader's own. */
const NEW = "new";

/*
 * Not `validIiifContent` from `docs/lib/iiif-content`: it brings `@iiif/helpers`, an ESM
 * external on the server, and that makes this module async, so the homepage's import of
 * it is undefined while the page is rendered there. These two checks are its own.
 */
const webAddress = (value: string) => {
  try {
    const { protocol, hostname } = new URL(value);
    return (protocol === "http:" || protocol === "https:") && hostname
      ? value
      : undefined;
  } catch {
    return undefined;
  }
};

/** A IIIF Content State as a link carries it, base64url of the URI-encoded JSON, read. */
const decodeContentState = (value: string): Record<string, any> | undefined => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const state = JSON.parse(
      decodeURIComponent(
        atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
      ),
    );
    return typeof state === "object" && state !== null ? state : undefined;
  } catch {
    return undefined;
  }
};

/** What Clover can open: a web address, or an encoded content state. */
export const loadable = (value: string) => {
  const trimmed = value.trim();
  return (
    webAddress(trimmed) ?? (decodeContentState(trimmed) ? trimmed : undefined)
  );
};

const ROOTS = ["Manifest", "Collection", "sc:Manifest", "sc:Collection"];

/**
 * The address of the Manifest or Collection a reader's resource opens: the address itself,
 * or a content state's target where it is one, else the one its target is part of.
 */
const rootAddress = (content: string) => {
  const direct = webAddress(content);
  if (direct) return direct;
  const state = decodeContentState(content);
  if (!state) return undefined;
  const targets = state.target ?? state;
  const target = Array.isArray(targets) ? targets[0] : targets;
  if (typeof target === "string") return webAddress(target.split("#")[0]);
  const root = ROOTS.includes(target?.type)
    ? target
    : (target?.partOf ?? []).find((part: any) => ROOTS.includes(part?.type));
  const id = root?.id ?? root?.["@id"];
  return typeof id === "string" ? webAddress(id.split("#")[0]) : undefined;
};

/** The first picture a `thumbnail` names, as Presentation 3 writes it or 2. */
const firstThumbnail = (thumbnail: unknown) => {
  const first = Array.isArray(thumbnail) ? thumbnail[0] : thumbnail;
  const id = typeof first === "string" ? first : (first?.id ?? first?.["@id"]);
  return typeof id === "string" ? webAddress(id) : undefined;
};

interface Label {
  text: string;
  /** Its language, where it is not the page's English. */
  lang?: string;
}

/**
 * A `label`, as Presentation 3 writes it (a language map: English, else `none`, else the
 * first) or 2 (a string, or values with `@language`).
 */
const firstLabel = (label: unknown, lang?: string): Label | undefined => {
  if (typeof label === "string") {
    const text = label.trim();
    return text ? { text, lang: lang === "en" ? undefined : lang } : undefined;
  }
  if (Array.isArray(label)) return firstLabel(label[0], lang);
  if (!label || typeof label !== "object") return undefined;
  const value = label as Record<string, any>;
  if ("@value" in value) return firstLabel(value["@value"], value["@language"]);
  const key =
    ["en", "none"].find((tag) => tag in value) ?? Object.keys(value)[0];
  return key
    ? firstLabel(value[key], key === "none" ? undefined : key)
    : undefined;
};

interface Details {
  label?: Label;
  thumbnail?: string;
}

/**
 * What the reader's own resources name at their root: each Manifest's or Collection's own
 * `label` and `thumbnail`, never one of its Canvases' or members'. One request for each,
 * which the stage makes too; nothing where it names none, or cannot be read.
 */
function useDetails(contents: string[]) {
  const [details, setDetails] = useState<Record<string, Details>>({});
  const asked = useRef(new Set<string>());
  useEffect(() => {
    for (const content of contents) {
      if (asked.current.has(content)) continue;
      asked.current.add(content);
      const address = rootAddress(content);
      if (!address) continue;
      fetch(address)
        .then((response) => (response.ok ? response.json() : undefined))
        .then((resource) => {
          if (!resource) return;
          setDetails((known) => ({
            ...known,
            [content]: {
              label: firstLabel(resource.label),
              thumbnail: firstThumbnail(resource.thumbnail),
            },
          }));
        })
        .catch(() => undefined);
    }
  }, [contents]);
  return details;
}

/** A resource in the list: one of ours, or one the reader gave. */
interface Choice {
  key: string;
  label: Label;
  /** A few words under the label. */
  about: string;
  thumbnail?: string;
  /** The reader's: its address or content state. */
  content?: string;
  selected: boolean;
}

const PROBLEM =
  "Enter the web address of a IIIF Manifest or Collection, starting with https://, or choose one of ours";

export interface ResourceFieldProps {
  /** The resource on the stage: one of ours, by key, or `OWN`. */
  current: string;
  /** The reader's own address or content state, when it is on the stage. */
  own: string;
  /** One of ours was chosen, by key. */
  onPick: (key: string) => void;
  /** The reader's own was entered: an address or a content state. */
  onOwn: (content: string) => void;
}

/**
 * The playground's resource: one field for the address of the reader's own, with ours in
 * a list under it, each by its thumbnail and its own label, and a line on what it holds.
 * First, always, "View your own", which empties the field for an address. The reader's
 * own join the list as they open them, next, so they can switch between theirs and ours.
 *
 * An editable combobox (WAI-ARIA's pattern, with list autocomplete). The field shows the
 * label of the resource on the stage: for the reader's own, its root `label`, or its
 * address until that is read. Typing narrows the list
 * to the resources whose label or line holds what is typed, and an address matches none, so the
 * list goes away. Down and Up open it on the one on the stage, and move through
 * it; Enter opens the one marked, or else what is typed; Escape closes the list, and then
 * puts back what the stage shows. A press on the field or its chevron opens it too.
 * Focus stays in the field throughout.
 */
export default function ResourceField({
  current,
  own,
  onPick,
  onOwn,
}: ResourceFieldProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const optionId = (key: string) => `${id}-${key}`;

  /*
   * The reader's own resources, newest first: every one opened this visit, so they can
   * go back to one. Held here only, in memory, and gone with the page; never stored.
   */
  const [provided, setProvided] = useState<string[]>([]);
  useEffect(() => {
    if (current === OWN && own)
      setProvided((list) => (list.includes(own) ? list : [own, ...list]));
  }, [current, own]);
  const details = useDetails(provided);

  const choices: Choice[] = [
    // First, always: the way to one of the reader's own, an empty field to enter it in.
    {
      key: NEW,
      label: { text: "View your own" },
      about: "The address of a IIIF Manifest or Collection",
      selected: false,
    },
    ...provided.map((content, index) => {
      const address = rootAddress(content);
      return {
        // Counted from the first given, so each keeps its key as more arrive.
        key: `own-${provided.length - 1 - index}`,
        label: details[content]?.label ?? { text: address ?? content },
        // Its address: for a content state, the Manifest or Collection it opens.
        about: address ?? content,
        thumbnail: details[content]?.thumbnail,
        content,
        selected: current === OWN && own === content,
      };
    }),
    ...resources.map((r) => ({
      key: r.key,
      label: { text: r.title },
      about: r.description,
      thumbnail: r.thumbnail,
      selected: r.key === current,
    })),
  ];
  const chosen = choices.find((choice) => choice.selected);
  const resourcesOnly = choices.filter((choice) => choice.key !== NEW);
  const shown = chosen?.label ?? { text: own };

  /* A picture that would not load leaves the empty slot. */
  const [broken, setBroken] = useState<string[]>([]);
  const pictured = (src?: string) =>
    src && !broken.includes(src) ? src : undefined;
  const brake = (src: string) => setBroken((list) => [...list, src]);

  /* What the reader has typed, until it is opened or put back; `null` while untouched. */
  const [draft, setDraft] = useState<string | null>(null);
  /* What narrows the list: what was typed, or nothing when the list was asked for. */
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  /* How the field was last pressed: a touch keeps its label unselected. */
  const pointer = useRef<string>("");

  const query = filter.trim().toLowerCase();
  // Narrowed by what is typed, among the resources: one's own is already being entered.
  const options = query
    ? resourcesOnly.filter((choice) =>
        `${choice.label.text} ${choice.about}`.toLowerCase().includes(query),
      )
    : choices;
  const expanded = open && options.length > 0;

  // Another resource on the stage, from here, the page or a link, puts its name back.
  useEffect(() => {
    setDraft(null);
    setFilter("");
    setError(undefined);
  }, [current, own]);

  useEffect(() => {
    if (active)
      document
        .getElementById(optionId(active))
        ?.scrollIntoView({ block: "nearest" });
    // `optionId` is derived from `id`, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /** Opens the whole list, marking the one on the stage, or else the first or last. */
  const show = (from: "first" | "last" | null) => {
    setFilter("");
    setOpen(true);
    setActive(
      from === null
        ? null
        : chosen
          ? chosen.key
          : choices[from === "first" ? 0 : choices.length - 1].key,
    );
  };

  const close = () => {
    setOpen(false);
    setActive(null);
  };

  const choose = (choice: Choice) => {
    close();
    setFilter("");
    setError(undefined);
    /*
     * "View your own" empties the field for an address; focus is already in it. A phone's
     * keyboard was kept away while ours were listed (`inputMode`); it comes up now, an
     * address to type, by focusing the field again within this press (Mat, 2026-10-21).
     */
    if (choice.key === NEW) {
      setDraft("");
      const input = inputRef.current;
      if (input) {
        input.inputMode = "url";
        input.blur();
        input.focus();
      }
      return;
    }
    setDraft(null);
    if (choice.content) onOwn(choice.content);
    else onPick(choice.key);
  };

  const move = (by: 1 | -1) => {
    const index = options.findIndex((o) => o.key === active);
    const next =
      index < 0
        ? by > 0
          ? 0
          : options.length - 1
        : (index + by + options.length) % options.length;
    setActive(options[next].key);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    close();
    if (draft === null) return;
    const value = draft.trim();
    // One in the list, by its label, opens as if chosen.
    const named = resourcesOnly.find(
      (choice) => choice.label.text.toLowerCase() === value.toLowerCase(),
    );
    if (named) return choose(named);
    const content = loadable(value);
    if (!content) return setError(PROBLEM);
    setDraft(null);
    onOwn(content);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!expanded) show(event.altKey ? null : "first");
        else if (!event.altKey) move(1);
        return;
      case "ArrowUp":
        event.preventDefault();
        if (event.altKey) close();
        else if (!expanded) show("last");
        else move(-1);
        return;
      case "Enter":
        // The one marked, rather than what is typed.
        const marked = expanded && options.find((o) => o.key === active);
        if (marked) {
          event.preventDefault();
          choose(marked);
        }
        return;
      case "Escape":
        if (expanded) {
          event.preventDefault();
          close();
        } else if (draft !== null || error) {
          event.preventDefault();
          setDraft(null);
          setFilter("");
          setError(undefined);
        }
        return;
      case "Tab":
        close();
    }
  };

  return (
    <form
      className={styles.resourcePicker}
      noValidate
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onSubmit={submit}
    >
      <div className={styles.resourceRow}>
        <div className={styles.combo}>
          {/*
           * The field's label, joined to its start, outside its edge (Mat, 2026-10-20). Its
           * `<label>`, so it names the field (WCAG 1.3.1, 3.3.2), and the name holds the
           * words shown (2.5.3).
           */}
          <div className={styles.fieldGroup}>
            {/*
             * "Select…" to see, "Select a IIIF resource" to hear: the name starts with
             * what shows, so a voice saying "Select" finds it (WCAG 2.5.3), and the
             * ellipsis is not read (Mat, 2026-10-22).
             */}
            <label className={styles.fieldLabel} htmlFor={inputId}>
              Select<span aria-hidden="true">…</span>
              <span className={styles.visuallyHidden}> a IIIF resource</span>
            </label>
            <div className={styles.field}>
              <Picture
                className={styles.fieldMedia}
                onBroken={brake}
                // While the reader types, the field is theirs: an empty slot.
                src={draft === null ? pictured(chosen?.thumbnail) : undefined}
              />
              <input
                aria-activedescendant={
                  expanded && active ? optionId(active) : undefined
                }
                aria-autocomplete="list"
                aria-controls={listId}
                aria-describedby={error ? errorId : undefined}
                aria-expanded={expanded}
                aria-invalid={error ? true : undefined}
                autoCapitalize="off"
                autoComplete="off"
                className={styles.fieldInput}
                enterKeyHint="go"
                id={inputId}
                /*
                 * No on-screen keyboard while the field shows one of ours (Mat, 2026-10-21):
                 * a press lists them, and "View your own" brings the keyboard for an address.
                 * A keyboard of keys types and moves as ever.
                 */
                inputMode={draft === null ? "none" : "url"}
                // The label's language, while the field shows a label in another.
                lang={draft === null ? shown.lang : undefined}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setFilter(event.target.value);
                  setError(undefined);
                  setOpen(true);
                  setActive(null);
                }}
                onClick={(event) => {
                  /*
                   * Untouched, a press lists ours, and, by mouse, selects the label, so a
                   * paste replaces it; by touch, it leaves it, or the phone's selection
                   * handles would come up over it.
                   */
                  if (draft !== null) return;
                  if (pointer.current !== "touch") event.currentTarget.select();
                  if (!expanded) show(null);
                }}
                onPointerDown={(event) => {
                  pointer.current = event.pointerType;
                }}
                onKeyDown={onKeyDown}
                placeholder="https://"
                ref={inputRef}
                role="combobox"
                spellCheck={false}
                type="text"
                value={draft ?? shown.text}
              />
              <button
                aria-controls={listId}
                aria-expanded={expanded}
                aria-label="IIIF resources"
                className={styles.fieldToggle}
                // Focus stays in the field.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  inputRef.current?.focus();
                  if (expanded) close();
                  else show(null);
                }}
                tabIndex={-1}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  className={styles.chevron}
                  fill="none"
                  height="16"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="16"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>
          </div>

          <ul
            aria-label="IIIF resources"
            className={styles.resourceList}
            hidden={!expanded}
            id={listId}
            // A press chooses without taking focus from the field.
            onMouseDown={(event) => event.preventDefault()}
            role="listbox"
          >
            {options.map((choice) => (
              <li
                aria-selected={choice.selected}
                className={styles.option}
                data-active={choice.key === active || undefined}
                id={optionId(choice.key)}
                key={choice.key}
                onClick={() => choose(choice)}
                role="option"
              >
                <Picture
                  className={styles.media}
                  lazy
                  onBroken={brake}
                  plus={choice.key === NEW}
                  src={pictured(choice.thumbnail)}
                />
                <span className={styles.optionText}>
                  <span className={styles.optionName} lang={choice.label.lang}>
                    {choice.label.text}
                  </span>
                  <span className={styles.optionAbout}>{choice.about}</span>
                </span>
                <svg
                  aria-hidden="true"
                  className={styles.check}
                  fill="none"
                  height="16"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  width="16"
                >
                  <path d="M5 12.5 10 17.5 19 7" />
                </svg>
              </li>
            ))}
          </ul>
        </div>
        <button className={styles.openButton} type="submit">
          Open
        </button>
      </div>
      {error && (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * A resource's thumbnail, or, where it has none or it will not load, an empty slot; with
 * `plus`, a slot to fill, as "View your own" is.
 */
function Picture({
  className,
  lazy,
  onBroken,
  plus,
  src,
}: {
  className: string;
  lazy?: boolean;
  onBroken: (src: string) => void;
  plus?: boolean;
  src?: string;
}) {
  return (
    <span className={className} data-empty={!src || undefined}>
      {plus && (
        <svg
          aria-hidden="true"
          fill="none"
          height="16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="16"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      )}
      {src && (
        // Static export with unoptimized images: next/image has nothing to add for a remote thumbnail.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className={styles.thumb}
          decoding="async"
          loading={lazy ? "lazy" : undefined}
          onError={() => onBroken(src)}
          src={src}
        />
      )}
    </span>
  );
}
