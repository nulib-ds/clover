import type { Collection, Container, Manifest } from "./presentation";
import { selectSequence } from "./selectors";
import { type LanguageMapLike, localize } from "./value";

/**
 * What `Items` shows: light models of a Manifest's views or a Collection's members, never
 * the resources themselves, so a long sequence costs a few fields per item.
 *
 * Memoized on the resource object, as the selectors are.
 */

export interface ItemPart {
  id: string;
  type: string;
  label?: LanguageMapLike;
  /** The resource, for a thumbnail and for `renderItem`. */
  resource: unknown;
  /** Seconds, for video and sound. */
  duration?: number;
  /** What it mostly paints: `Image`, `Video` or `Sound`. */
  media?: string;
}

export interface ItemModel {
  /** The first Canvas of a view, or a member's id. What selecting it goes to. */
  id: string;
  /** A Canvas view: one Canvas, or a spread. A member: itself. */
  parts: ItemPart[];
  label?: LanguageMapLike;
  summary?: LanguageMapLike;
  /** Where a link to a member goes: its `homepage`, else its id. */
  href?: string;
}

type Json = Record<string, any>;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

/** The kind of content a Canvas paints first: `Image`, `Video` or `Sound`. */
function paintedType(container: Json): string | undefined {
  for (const page of asArray(container.items) as Json[]) {
    for (const annotation of asArray(page?.items) as Json[]) {
      for (let body of asArray(annotation?.body) as Json[]) {
        if (body?.type === "Choice") body = asArray(body.items)[0] as Json;
        if (body?.type === "SpecificResource") body = body.source;
        if (body?.type) return body.type;
      }
    }
  }
  return undefined;
}

function part(resource: Json): ItemPart {
  const media =
    paintedType(resource) ??
    (resource.type === "Timeline" ? "Sound" : undefined);
  return {
    id: resource.id,
    type: resource.type,
    label: resource.label,
    resource,
    duration: Number(resource.duration) || undefined,
    media,
  };
}

const viewItems = new WeakMap<Manifest, ItemModel[]>();

/** One item per view: a Canvas, or a spread of two. */
export function itemsOfManifest(manifest: Manifest | null): ItemModel[] {
  if (!manifest) return [];
  let items = viewItems.get(manifest);
  if (!items) {
    const { canvases, views } = selectSequence(manifest);
    items = views.map((view) => {
      const parts = view.map((index) => part(canvases[index] as Json));
      return {
        id: parts[0].id,
        parts,
        // A spread is named by its pages: "Frontispiece – Title page".
        label:
          parts.length === 1
            ? parts[0].label
            : {
                none: [
                  parts
                    .map((p) => localize(p.label).text)
                    .filter(Boolean)
                    .join(" – "),
                ],
              },
      };
    });
    viewItems.set(manifest, items);
  }
  return items;
}

const memberItems = new WeakMap<object, ItemModel[]>();

/** One item per Manifest or Collection in a Collection, linking to each. */
export function itemsOfCollection(collection: Collection | null): ItemModel[] {
  if (!collection) return [];
  let items = memberItems.get(collection);
  if (!items) {
    items = (asArray(collection.items) as Json[])
      .filter((member) => member?.id)
      .map((member) => ({
        id: member.id,
        parts: [part(member)],
        label: member.label,
        summary: member.summary,
        href:
          (asArray(member.homepage)[0] as Json | undefined)?.id ?? member.id,
      }));
    memberItems.set(collection, items);
  }
  return items;
}

/** Items from any resource: a Manifest's views, a Collection's members, or a list. */
export function itemsOf(
  resource: Manifest | Collection | Container[] | null,
): ItemModel[] {
  if (!resource) return [];
  if (Array.isArray(resource)) {
    return itemsOfCollection({ items: resource } as unknown as Collection);
  }
  return resource.type === "Collection"
    ? itemsOfCollection(resource as Collection)
    : itemsOfManifest(resource as Manifest);
}
