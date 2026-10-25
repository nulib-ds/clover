import React, { useEffect, useId, useRef, useState } from "react";
import { recipeBase } from "docs/components/CookbookRecipes/cookbookCatalog";
import {
  type CatalogRecipe,
  readRecipes,
  recipeFor,
} from "docs/components/CookbookRecipes/recipeCatalog";
import { IIIFLogo } from "docs/components/Home/IIIFLogo";
import { resources } from "docs/components/Playground/playground-config";

import styles from "docs/components/Playground/Playground.module.css";
import { example } from "docs/lib/example";

/** The reader's own resource, where a resource's key would be. */
export const OWN = "own";

/** The list's first item: an empty field, for the reader's own. */
const NEW = "new";

/** The list's last item: the IIIF Cookbook's recipes, tucked away until asked for. */
const COOKBOOK = "cookbook";

const COOKBOOK_NAME = "IIIF Cookbook recipes";

/*
 * The recipes, read when they are first listed, or when one is in the Viewer (a link from
 * a recipe's page on iiif.io opens it here), from the curated Collection the Natural
 * story draws too (`docs/mocks/cookbook/`).
 */
type Recipe = CatalogRecipe;

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
 * which the Viewer makes too; nothing where it names none, or cannot be read.
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
  /** Where it has no thumbnail, what its empty slot shows: a recipe's number. */
  mark?: string;
  /** The reader's, or a recipe's: its address or content state. */
  content?: string;
  selected: boolean;
}

const PROBLEM =
  "Enter the web address of a IIIF Manifest or Collection, starting with https://, or choose one of ours";

export interface ResourceFieldProps {
  /** The resource in the Viewer: one of ours, by key, or `OWN`. */
  current: string;
  /** The reader's own address or content state, when it is in the Viewer. */
  own: string;
  /** One of ours was chosen, by key. */
  onPick: (key: string) => void;
  /** The reader's own was entered: an address or a content state. */
  onOwn: (content: string) => void;
  /**
   * What it lists: the playground's resources, the reader's own and, tucked away, the
   * Cookbook's recipes (default); or the recipes alone, as the Natural story's select
   * does (`RecipeSelect.tsx`), a recipe opened as the reader's own is.
   */
  of?: "resources" | "recipes";
  /** Where Open sends what it opens: to the Viewer beside it, or up top, its caret up. */
  toward?: "right" | "up";
  /**
   * For the recipes alone: a recipe's address shown in the field, not opened, while the
   * Viewer shows none (the one the example viewer reads, 0032; Mat, 2026-10-25: "stage
   * the 0032 manifest in the select. do not have it be submitted"). Open opens it.
   */
  staged?: string;
}

/**
 * The playground's resource: one field for the address of the reader's own, with ours in
 * a list under it, each by its thumbnail and its own label, and a line on what it holds.
 * First, always, "View your own", which empties the field for an address. The reader's
 * own join the list as they open them, next, so they can switch between theirs and ours.
 *
 * An editable combobox (WAI-ARIA's pattern, with list autocomplete). The field shows the
 * label of the resource in the Viewer: for the reader's own, its root `label`, or its
 * address until that is read. Typing narrows the list to the resources whose label or
 * line holds what is typed, and an address matches none, so the list goes away. Down and
 * Up open it on the one in the Viewer, and move through it; Enter opens the one marked,
 * or else what is typed; Escape closes the list, and then puts back what the Viewer
 * shows. A press on the field or its chevron opens it too. Focus stays in the field
 * throughout.
 *
 * With `of="recipes"`, the same select lists the Cookbook's recipes alone, read while the
 * page is idle, its field showing the one in the Viewer, else nothing but what it asks
 * for (Mat, 2026-10-25: "just use the same select as above").
 */
export default function ResourceField({
  current,
  own,
  onPick,
  onOwn,
  of = "resources",
  toward = "right",
  staged,
}: ResourceFieldProps) {
  const onlyRecipes = of === "recipes";
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const recipeId = `${id}-recipe`;
  const optionId = (key: string) => `${id}-${key}`;

  /*
   * The reader's own resources, newest first: every one opened this visit, so they can
   * go back to one. Held here only, in memory, and gone with the page; never stored.
   */
  const [provided, setProvided] = useState<string[]>([]);

  /*
   * The IIIF Cookbook's recipes, at the end of the list, under one option that shows and
   * hides them (Mat, 2026-10-25: "a category that is tucked away at the bottom of the
   * list"). Read when it is first chosen, or when a recipe is in the Viewer; `null`
   * until then. Held in memory only. Shown while a recipe is in the Viewer, they fold
   * away again as anything else opens (Mat, 2026-10-25), so ours stand apart again.
   */
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [cookbookShown, setCookbookShown] = useState(false);
  const [readingRecipes, setReadingRecipes] = useState(false);
  /* What the list's last change was, said to assistive technology (WCAG 4.1.3). */
  const [status, setStatus] = useState("");
  const recipeAddress = current === OWN && own.startsWith(recipeBase);

  useEffect(() => {
    if (recipeAddress && !recipes) void readRecipes().then(setRecipes);
  }, [recipeAddress, recipes]);

  // The recipes alone: read while the page is idle, to list them and name the one shown.
  useEffect(() => {
    if (!onlyRecipes) return;
    const read = () => void readRecipes().then(setRecipes);
    if (!("requestIdleCallback" in window)) {
      const timer = setTimeout(read, 2000);
      return () => clearTimeout(timer);
    }
    const idle = requestIdleCallback(read, { timeout: 4000 });
    return () => cancelIdleCallback(idle);
  }, [onlyRecipes]);

  // The recipe in the Viewer, where it is one.
  const recipeShown = current === OWN ? recipeFor(recipes, own) : undefined;
  // For the recipes alone, the one staged while the Viewer shows none.
  const stagedRecipe =
    onlyRecipes && !recipeShown && staged
      ? recipeFor(recipes, staged)
      : undefined;

  /*
   * Another resource in the Viewer folds the recipes away; one of them opens them again,
   * just after (below), once it is known to be one. Only a change of resource: reading
   * the recipes, or the reader showing or hiding them, leaves them as they are.
   */
  const inViewer = current === OWN ? own : current;
  useEffect(() => setCookbookShown(false), [inViewer]);

  useEffect(() => {
    if (onlyRecipes || current !== OWN || !own) return;
    // A recipe's address waits for the recipes, to be shown as one, its category open.
    if (own.startsWith(recipeBase) && !recipes) return;
    if (recipeShown) return setCookbookShown(true);
    setProvided((list) => (list.includes(own) ? list : [own, ...list]));
  }, [onlyRecipes, current, own, recipes, recipeShown]);
  const details = useDetails(provided);

  const choices: Choice[] = onlyRecipes
    ? []
    : [
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
            selected: current === OWN && own === content && !recipeShown,
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
  // Last, the way to the recipes, which shows them and hides them again.
  const cookbook: Choice = {
    key: COOKBOOK,
    label: { text: COOKBOOK_NAME },
    about: readingRecipes
      ? "Loading…"
      : cookbookShown
        ? "Hide them"
        : recipes?.length
          ? `Show all ${recipes.length}`
          : "Show them all",
    selected: false,
  };
  const recipeChoices: Choice[] = (recipes ?? []).map((recipe) => ({
    key: `recipe-${recipe.slug}`,
    // The recipe's title as the Cookbook writes it, and its folder's name on iiif.io.
    label: { text: recipe.title },
    about: recipe.slug,
    thumbnail: recipe.thumbnail,
    mark: recipe.slug.slice(0, 4),
    content: recipe.resource,
    selected: recipe === (recipeShown ?? stagedRecipe),
  }));
  const chosen = [...choices, ...recipeChoices].find(
    (choice) => choice.selected,
  );
  // The recipes alone are always shown, with no category to show them by.
  const recipesShown = onlyRecipes || cookbookShown;
  const resourcesOnly = [
    ...choices.filter((choice) => choice.key !== NEW),
    ...(recipesShown ? recipeChoices : []),
  ];
  /*
   * While a recipe's address waits for its title, the field shows nothing of the address;
   * the recipes alone show nothing but a recipe.
   */
  const shown =
    chosen?.label ??
    ((recipeAddress && !recipes) || onlyRecipes ? { text: "" } : { text: own });

  /* A picture that would not load leaves the empty slot. */
  const [broken, setBroken] = useState<string[]>([]);
  const pictured = (src?: string) =>
    src && !broken.includes(src) ? src : undefined;
  const brake = (src: string) => setBroken((list) => [...list, src]);

  /* What the reader has typed, until it is opened or put back; `null` while untouched. */
  const [draft, setDraft] = useState<string | null>(null);
  // The recipe in the Viewer, hinted in the field until the reader types over it.
  const recipeHint = !onlyRecipes && draft === null ? recipeShown : undefined;
  /* What narrows the list: what was typed, or nothing when the list was asked for. */
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  /* How the field was last pressed: a touch keeps its label unselected. */
  const pointer = useRef<string>("");

  const listName = onlyRecipes ? COOKBOOK_NAME : "IIIF resources";
  const query = filter.trim().toLowerCase();
  const matches = (choice: Choice) =>
    `${choice.label.text} ${choice.about}`.toLowerCase().includes(query);
  /*
   * Narrowed by what is typed, among the resources: one's own is already being entered.
   * The recipes are among them once shown; their category, where its name matches.
   */
  const unfiltered = onlyRecipes
    ? recipeChoices
    : [...choices, cookbook, ...(cookbookShown ? recipeChoices : [])];
  const options = query
    ? [
        ...resourcesOnly.filter(matches),
        ...(recipesShown ? [] : [cookbook].filter(matches)),
      ]
    : unfiltered;
  const listedRecipes = options.filter((o) => o.key.startsWith("recipe-"));
  const expanded = open && options.length > 0;

  // Another resource in the Viewer, from here, the page or a link, puts its name back.
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

  /** Opens the whole list, marking the one in the Viewer, or else the first or last. */
  const show = (from: "first" | "last" | null) => {
    const all = unfiltered;
    if (!all.length) return;
    setFilter("");
    setOpen(true);
    setActive(
      from === null
        ? null
        : chosen && all.includes(chosen)
          ? chosen.key
          : all[from === "first" ? 0 : all.length - 1].key,
    );
  };

  const listRef = useRef<HTMLUListElement>(null);

  /*
   * Shows the recipes, read first if they are not yet, and marks the first of them, the
   * category at the list's top so they follow it; or hides them again. The list stays
   * open and focus in the field.
   */
  const toggleCookbook = () => {
    if (cookbookShown) {
      setCookbookShown(false);
      setActive(COOKBOOK);
      setStatus(`${COOKBOOK_NAME} hidden`);
      return;
    }
    setActive(COOKBOOK);
    if (!recipes) setReadingRecipes(true);
    void readRecipes().then((list) => {
      setReadingRecipes(false);
      setRecipes(list);
      if (!list.length)
        return setStatus(`${COOKBOOK_NAME} could not be loaded`);
      setCookbookShown(true);
      setActive(`recipe-${list[0].slug}`);
      setStatus(`${list.length} ${COOKBOOK_NAME} listed`);
      requestAnimationFrame(() => {
        const category = document.getElementById(optionId(COOKBOOK));
        const box = listRef.current;
        // The list alone scrolls, never the page around it.
        if (category && box)
          box.scrollTop =
            category.offsetTop - parseFloat(getComputedStyle(box).paddingTop);
      });
    });
  };

  const close = () => {
    setOpen(false);
    setActive(null);
  };

  const choose = (choice: Choice) => {
    if (choice.key === COOKBOOK) return toggleCookbook();
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
    /*
     * Nothing typed: the recipes alone open the one their field shows, staged or already
     * up top, so Open always takes the reader to it.
     */
    if (draft === null) {
      if (onlyRecipes && chosen?.content) onOwn(chosen.content);
      return;
    }
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
        <div className={styles.combo} {...example()}>
          {/*
           * One pill, as Airbnb's search is (Mat, 2026-10-25): the resource's thumbnail,
           * then the field's label over the field, the list's chevron, and Open, round, at
           * its end. The label is a `<label>`, so it names the field (WCAG 1.3.1, 3.3.2),
           * and the name holds the words shown (2.5.3).
           */}
          <div className={styles.fieldGroup}>
            {/*
             * A Cookbook recipe in the Viewer, said plainly (Mat, 2026-10-25: "strongly
             * hint they are viewing a recipe"): IIIF's logo on the pill's top edge, in its
             * middle, clear of the thumbnail, and its folder's name on iiif.io after its
             * title. The playground's own field only: the recipes alone say so already.
             */}
            {recipeHint && (
              <span className={styles.fieldBadge} aria-hidden="true">
                <IIIFLogo className={styles.fieldBadgeLogo} />
              </span>
            )}
            <Picture
              className={styles.fieldMedia}
              mark={draft === null ? chosen?.mark : undefined}
              onBroken={brake}
              // While the reader types, the field is theirs: an empty slot.
              src={draft === null ? pictured(chosen?.thumbnail) : undefined}
            />
            <div className={styles.fieldText}>
              {/*
               * "Viewing" to see, "Viewing IIIF resource" to hear (Mat, 2026-10-25): the
               * name starts with what shows, so a voice saying "Viewing" finds it (WCAG
               * 2.5.3), and says what the field holds.
               */}
              <label className={styles.fieldLabel} htmlFor={inputId}>
                Viewing
                <span className={styles.visuallyHidden}>
                  {onlyRecipes ? " IIIF Cookbook recipe" : " IIIF resource"}
                </span>
              </label>
              <span
                className={styles.fieldLine}
                data-hinted={recipeHint ? "" : undefined}
              >
                <input
                  aria-activedescendant={
                    expanded && active ? optionId(active) : undefined
                  }
                  aria-autocomplete="list"
                  aria-controls={listId}
                  aria-describedby={
                    [error && errorId, recipeHint && recipeId]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
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
                    if (pointer.current !== "touch")
                      event.currentTarget.select();
                    if (!expanded) show(null);
                  }}
                  onPointerDown={(event) => {
                    pointer.current = event.pointerType;
                  }}
                  onKeyDown={onKeyDown}
                  // An address to type; for the recipes alone, a recipe to choose.
                  placeholder={onlyRecipes ? "Choose a recipe" : "https://"}
                  ref={inputRef}
                  role="combobox"
                  spellCheck={false}
                  type="text"
                  value={draft ?? shown.text}
                />
                {recipeHint && (
                  // Described to assistive technology as what it is; a press lists ours.
                  <span
                    className={styles.fieldRecipe}
                    id={recipeId}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      inputRef.current?.focus();
                      if (!expanded) show(null);
                    }}
                  >
                    <span className={styles.visuallyHidden}>
                      IIIF Cookbook recipe{" "}
                    </span>
                    {recipeHint.slug.slice(0, 4)}
                    <span className={styles.fieldRecipeRest}>
                      {recipeHint.slug.slice(4)}
                    </span>
                  </span>
                )}
              </span>
            </div>
            <button
              aria-controls={listId}
              aria-expanded={expanded}
              aria-label={listName}
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
            {/*
             * Open, round, at the pill's end (Mat, 2026-10-25): the caret Items' Next draws,
             * so the site's round buttons agree, named "Open" for assistive technology and
             * a voice; pointing up where it opens in the Viewer up top (Mat, 2026-10-25).
             */}
            <button
              aria-label="Open"
              className={styles.openButton}
              data-toward={toward}
              title="Open"
              type="submit"
            >
              <svg
                aria-hidden="true"
                height="16"
                viewBox="0 0 16 16"
                width="16"
              >
                <path
                  d={toward === "up" ? "M3 10l5-5 5 5" : "M6 3l5 5-5 5"}
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          </div>

          <ul
            aria-label={listName}
            className={styles.resourceList}
            hidden={!expanded}
            id={listId}
            // A press chooses without taking focus from the field.
            onMouseDown={(event) => event.preventDefault()}
            ref={listRef}
            role="listbox"
          >
            {/*
             * Its options only while it is open: shut, the page holds none of the sample
             * resources' names, which are not what it is about (`docs/lib/example.ts`).
             */}
            {expanded &&
              options
                .filter((choice) => !choice.key.startsWith("recipe-"))
                .map((choice) =>
                  choice.key === COOKBOOK ? (
                    <li
                      aria-selected={false}
                      className={`${styles.option} ${styles.cookbook}`}
                      data-active={choice.key === active || undefined}
                      data-shown={cookbookShown || undefined}
                      id={optionId(choice.key)}
                      key={choice.key}
                      onClick={() => choose(choice)}
                      onPointerEnter={() => void readRecipes()}
                      role="option"
                    >
                      <span className={styles.media} data-logo>
                        <IIIFLogo className={styles.logo} />
                      </span>
                      <span className={styles.optionText}>
                        <span className={styles.optionName}>
                          {choice.label.text}
                        </span>
                        <span className={styles.optionAbout}>
                          {choice.about}
                        </span>
                      </span>
                      <svg
                        aria-hidden="true"
                        className={styles.disclose}
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
                    </li>
                  ) : (
                    <Option
                      active={choice.key === active}
                      choice={choice}
                      id={optionId(choice.key)}
                      key={choice.key}
                      onBroken={brake}
                      onChoose={choose}
                      picture={pictured(choice.thumbnail)}
                      plus={choice.key === NEW}
                    />
                  ),
                )}
            {expanded && listedRecipes.length > 0 && (
              /*
               * The recipes, one group named for them (WAI-ARIA's grouped listbox). Under
               * their category its option names them; narrowed by typing, the name shows.
               */
              <li className={styles.group} role="presentation">
                <ul aria-labelledby={`${id}-recipes`} role="group">
                  <li
                    className={
                      query && !onlyRecipes
                        ? styles.groupName
                        : styles.visuallyHidden
                    }
                    id={`${id}-recipes`}
                    role="presentation"
                  >
                    {COOKBOOK_NAME}
                  </li>
                  {listedRecipes.map((choice) => (
                    <Option
                      active={choice.key === active}
                      choice={choice}
                      id={optionId(choice.key)}
                      key={choice.key}
                      onBroken={brake}
                      onChoose={choose}
                      picture={pictured(choice.thumbnail)}
                    />
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </div>
      </div>
      <p className={styles.visuallyHidden} role="status">
        {status}
      </p>
      {error && (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/** A resource in the list: its thumbnail, its label over a few words, and a check. */
function Option({
  active,
  choice,
  id,
  onBroken,
  onChoose,
  picture,
  plus,
}: {
  active: boolean;
  choice: Choice;
  id: string;
  onBroken: (src: string) => void;
  onChoose: (choice: Choice) => void;
  picture?: string;
  plus?: boolean;
}) {
  return (
    <li
      aria-selected={choice.selected}
      className={styles.option}
      data-active={active || undefined}
      id={id}
      onClick={() => onChoose(choice)}
      role="option"
    >
      <Picture
        className={styles.media}
        lazy
        mark={choice.mark}
        onBroken={onBroken}
        plus={plus}
        src={picture}
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
  );
}

/**
 * A resource's thumbnail, or, where it has none or it will not load, an empty slot, with
 * its `mark` where it has one (a recipe's number); with `plus`, a slot to fill, as "View
 * your own" is.
 */
function Picture({
  className,
  lazy,
  mark,
  onBroken,
  plus,
  src,
}: {
  className: string;
  lazy?: boolean;
  mark?: string;
  onBroken: (src: string) => void;
  plus?: boolean;
  src?: string;
}) {
  return (
    <span className={className} data-empty={!src || undefined}>
      {!src && mark && (
        // The number is in the option's words too, so it is read once.
        <span aria-hidden="true" className={styles.mark}>
          {mark}
        </span>
      )}
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
