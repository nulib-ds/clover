/**
 * A IIIF resource's structure, never its words (WEBMCP.md, phase 3): what kind of
 * resource it is, its containers and what paints them, its formats and services, its
 * annotations by motivation, its Ranges, and which properties it has. Counts, and tokens
 * checked against what IIIF defines (a media type's shape, a motivation, a behavior, a
 * service's kind), so nothing the resource wrote (a label, a summary, a value, a URL)
 * comes through, however it is written. Any Presentation version: 2's `sequences`,
 * `images`, `@type` and `viewingHint`, 3's and 4's `items`, `type` and `behavior`.
 *
 * Bounded: so many containers, annotations and Ranges are read, and the rest counted, or
 * said to be past the limit (`truncated`).
 */

export type ContainerType = "Canvas" | "Timeline" | "Scene";

export interface Structure {
  type: "Manifest" | "Collection" | ContainerType;
  version?: 2 | 3 | 4;
  /** Its containers, by type: the views it shows. */
  containers: Record<ContainerType, number>;
  /** A Collection's members, by type. */
  members?: { Manifest: number; Collection: number };
  /** The containers painted with each kind of content. */
  painting: {
    image: number;
    video: number;
    audio: number;
    model: number;
    text: number;
    other: number;
  };
  /** The media types painted, as `type/subtype`, the first so many. */
  formats: string[];
  /** Its services, by kind: `image-3`, `image-level-2`, `search-2`, `auth-2`. */
  services: string[];
  annotations: {
    /** Annotations it holds, other than what paints its containers. */
    embedded: number;
    /** Annotation pages it names, unread. */
    referenced: number;
    /** Their motivations, as IIIF and Web Annotation name them. */
    motivations: string[];
  };
  /** Captions: supplementing annotations in WebVTT. */
  captions: number;
  /** Containers with a plain-text rendering: a transcript. */
  transcripts: number;
  /** Containers with a rendering of their own: a download for the page. */
  renderings: number;
  ranges: number;
  behavior: string[];
  viewingDirection?: string;
  /** Containers with a placeholder, or an accompanying, container. */
  placeholder: number;
  accompanying: number;
  /** Where navPlace is, on it or a container. */
  navPlace: boolean;
  /** The IIIF properties it has, by their Presentation 3 names. */
  properties: string[];
  /** Past a limit: what it says is of the first so many. */
  truncated?: true;
}

/** How much is read: past these, the rest is counted or left. */
export const LIMITS = {
  containers: 2000,
  annotations: 20000,
  ranges: 5000,
  formats: 12,
};

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const list = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

/** A `type` or `@type`, its namespace dropped: `sc:Manifest` is `Manifest`. */
const typeOf = (value: unknown) => {
  if (!isObject(value)) return undefined;
  const given = value.type ?? value["@type"];
  const first = list(given).find((each) => typeof each === "string");
  return typeof first === "string" ? first.replace(/^[a-z]+:/, "") : undefined;
};

const MOTIVATIONS = new Set([
  "painting",
  "supplementing",
  "commenting",
  "tagging",
  "describing",
  "linking",
  "highlighting",
  "identifying",
  "classifying",
  "editing",
  "moderating",
  "questioning",
  "replying",
  "bookmarking",
  "assessing",
  "georeferencing",
  "contentState",
]);

const BEHAVIORS = new Set([
  "auto-advance",
  "no-auto-advance",
  "repeat",
  "no-repeat",
  "unordered",
  "individuals",
  "continuous",
  "paged",
  "facing-pages",
  "non-paged",
  "multi-part",
  "together",
  "sequence",
  "thumbnail-nav",
  "no-nav",
  "hidden",
  "top",
]);

const DIRECTIONS = new Set([
  "left-to-right",
  "right-to-left",
  "top-to-bottom",
  "bottom-to-top",
]);

/**
 * The properties it may have, by their names in any version, as Presentation 3 names
 * them: `description` is `summary`, `attribution` `requiredStatement`.
 */
const PROPERTIES: Record<string, string> = {
  label: "label",
  summary: "summary",
  description: "summary",
  metadata: "metadata",
  requiredStatement: "requiredStatement",
  attribution: "requiredStatement",
  rights: "rights",
  license: "rights",
  homepage: "homepage",
  related: "homepage",
  seeAlso: "seeAlso",
  rendering: "rendering",
  partOf: "partOf",
  within: "partOf",
  provider: "provider",
  logo: "logo",
  thumbnail: "thumbnail",
  navDate: "navDate",
  navPlace: "navPlace",
  structures: "structures",
  start: "start",
  startCanvas: "start",
};

/** A media type, as `type/subtype` only, when it has that shape; else nothing. */
export function mediaType(value: unknown) {
  if (typeof value !== "string") return undefined;
  const type = value.split(";")[0].trim().toLowerCase();
  return /^[a-z]+\/[a-z0-9][a-z0-9.+-]{0,62}$/.test(type) ? type : undefined;
}

/** A value that says something: not empty, not null. */
const present = (value: unknown) =>
  value != null &&
  value !== "" &&
  !(Array.isArray(value) && !value.length) &&
  !(isObject(value) && !Object.keys(value).length);

/** A motivation as IIIF names it, its namespace dropped, if it is one. */
const motivationsOf = (annotation: Json) =>
  list(annotation.motivation)
    .map((each) =>
      typeof each === "string" ? each.replace(/^[a-z]+:/, "") : "",
    )
    .filter((each) => MOTIVATIONS.has(each));

/** A service's kinds, by its type, or 2's profile and context. */
function serviceKinds(service: unknown): string[] {
  if (!isObject(service)) return [];
  const type = typeOf(service) ?? "";
  const words = [
    type,
    ...list(service.profile).filter((each) => typeof each === "string"),
    ...list(service["@context"]).filter((each) => typeof each === "string"),
  ].join(" ");
  const kinds: string[] = [];
  const image =
    type.match(/^ImageService(\d)$/)?.[1] ??
    words.match(/iiif\.io\/api\/image\/(\d)/)?.[1];
  if (image) kinds.push(`image-${image}`);
  const level = words.match(/level\s*([0-2])\b|level([0-2])\.json/);
  if (image && level) kinds.push(`image-level-${level[1] ?? level[2]}`);
  const search =
    type.match(/^SearchService(\d)$/)?.[1] ??
    words.match(/iiif\.io\/api\/search\/(\d)\/search/)?.[1];
  if (search) kinds.push(`search-${search}`);
  const complete =
    type.match(/^AutoCompleteService(\d)$/)?.[1] ??
    words.match(/iiif\.io\/api\/search\/(\d)\/autocomplete/)?.[1];
  if (complete) kinds.push(`autocomplete-${complete}`);
  const auth =
    type.match(/^Auth\w*Service(\d)$/)?.[1] ??
    words.match(/iiif\.io\/api\/auth\/(\d)\//)?.[1];
  if (auth) kinds.push(`auth-${auth}`);
  // A service's own services: search's autocomplete, auth's token service.
  for (const inner of list(service.service)) kinds.push(...serviceKinds(inner));
  return kinds;
}

/** What a body paints: its kind, by its type, else its format's. */
function kindOf(body: Json): keyof Structure["painting"] {
  const type = (typeOf(body) ?? "").toLowerCase();
  if (type === "image") return "image";
  if (type === "video" || type === "movingimage") return "video";
  if (type === "sound" || type === "audio") return "audio";
  if (type === "model") return "model";
  if (type === "text" || type === "textualbody" || type === "dataset")
    return "text";
  const format = mediaType(body.format)?.split("/")[0];
  if (format === "image") return "image";
  if (format === "video") return "video";
  if (format === "audio") return "audio";
  if (format === "model") return "model";
  if (format === "text") return "text";
  return "other";
}

/** A body's resources: a Choice's items, a SpecificResource's source. */
function resourcesOf(body: unknown, depth = 0): Json[] {
  if (depth > 4) return [];
  return list(body).flatMap((each) => {
    if (!isObject(each)) return [];
    const type = typeOf(each);
    if (type === "Choice") return resourcesOf(each.items, depth + 1);
    if (type === "SpecificResource")
      return isObject(each.source) ? resourcesOf(each.source, depth + 1) : [];
    return [each];
  });
}

/** The structure of IIIF JSON; nothing for JSON that is not a resource Clover shows. */
export function structureOf(json: unknown): Structure | undefined {
  if (!isObject(json)) return undefined;
  const type = typeOf(json);
  if (
    type !== "Manifest" &&
    type !== "Collection" &&
    type !== "Canvas" &&
    type !== "Timeline" &&
    type !== "Scene"
  )
    return undefined;

  const contexts = list(json["@context"]).filter(
    (each): each is string => typeof each === "string",
  );
  const version = contexts
    .map((each) => Number(each.match(/presentation\/([234])\//)?.[1]))
    .find((each) => each > 0) as Structure["version"];

  const structure: Structure = {
    type,
    ...(version && { version }),
    containers: { Canvas: 0, Timeline: 0, Scene: 0 },
    painting: { image: 0, video: 0, audio: 0, model: 0, text: 0, other: 0 },
    formats: [],
    services: [],
    annotations: { embedded: 0, referenced: 0, motivations: [] },
    captions: 0,
    transcripts: 0,
    renderings: 0,
    ranges: 0,
    behavior: [],
    placeholder: 0,
    accompanying: 0,
    navPlace: false,
    properties: [],
  };
  const formats = new Set<string>();
  const services = new Set<string>();
  const motivations = new Set<string>();
  let annotationsRead = 0;
  const past = () => {
    structure.truncated = true;
  };

  // Its properties, by name, as Presentation 3 calls them.
  const properties = new Set<string>();
  for (const [key, name] of Object.entries(PROPERTIES))
    if (present(json[key])) properties.add(name);
  if (
    list(json.provider).some((agent) => isObject(agent) && present(agent.logo))
  )
    properties.add("logo");
  structure.properties = [...properties];
  if (properties.has("navPlace")) structure.navPlace = true;

  for (const word of [...list(json.behavior), ...list(json.viewingHint)])
    if (typeof word === "string" && BEHAVIORS.has(word))
      structure.behavior.push(word);
  if (typeof json.viewingDirection === "string") {
    const direction = json.viewingDirection.toLowerCase();
    if (DIRECTIONS.has(direction)) structure.viewingDirection = direction;
  }
  for (const service of [...list(json.service), ...list(json.services)])
    for (const kind of serviceKinds(service)) services.add(kind);

  /** Annotations other than painting, from pages held or named. */
  const readPages = (pages: unknown) => {
    for (const page of list(pages)) {
      if (!isObject(page)) continue;
      // 3's and 4's AnnotationPage holds `items`; 2's AnnotationList, `resources`.
      const held = Array.isArray(page.items)
        ? page.items
        : Array.isArray(page.resources)
          ? page.resources
          : undefined;
      if (!held) {
        structure.annotations.referenced++;
        continue;
      }
      for (const annotation of held) readAnnotation(annotation);
    }
  };
  const readAnnotation = (annotation: unknown) => {
    if (!isObject(annotation)) return;
    if (++annotationsRead > LIMITS.annotations) return past();
    const said = motivationsOf(annotation);
    if (said.includes("painting")) return;
    structure.annotations.embedded++;
    for (const motivation of said) motivations.add(motivation);
    const bodies = resourcesOf(annotation.body ?? annotation.resource);
    if (
      said.includes("supplementing") &&
      bodies.some((body) => mediaType(body.format) === "text/vtt")
    )
      structure.captions++;
  };

  /** A container: what paints it, its annotations, its renderings. */
  const readContainer = (container: Json, kind: ContainerType) => {
    structure.containers[kind]++;
    const painted = new Set<keyof Structure["painting"]>();
    // 3's and 4's painting pages, and 2's `images`.
    const annotations = [
      ...list(container.items).flatMap((page) =>
        isObject(page) ? list(page.items) : [],
      ),
      ...list(container.images),
    ];
    for (const annotation of annotations) {
      if (!isObject(annotation)) continue;
      const said = motivationsOf(annotation);
      if (said.length && !said.includes("painting")) {
        readAnnotation(annotation);
        continue;
      }
      for (const body of resourcesOf(annotation.body ?? annotation.resource)) {
        painted.add(kindOf(body));
        const format = mediaType(body.format);
        if (format && formats.size < LIMITS.formats) formats.add(format);
        for (const service of [...list(body.service), ...list(body.services)])
          for (const each of serviceKinds(service)) services.add(each);
      }
    }
    for (const each of painted) structure.painting[each]++;
    readPages(container.annotations);
    readPages(container.otherContent);
    const renderings = list(container.rendering).filter(isObject);
    if (renderings.length) structure.renderings++;
    if (renderings.some((each) => mediaType(each.format) === "text/plain"))
      structure.transcripts++;
    if (present(container.navPlace)) structure.navPlace = true;
    if (present(container.placeholderCanvas)) structure.placeholder++;
    if (present(container.accompanyingCanvas)) structure.accompanying++;
  };

  const containerType = (value: unknown) => {
    const kind = typeOf(value);
    return kind === "Canvas" || kind === "Timeline" || kind === "Scene"
      ? kind
      : undefined;
  };

  if (type === "Collection") {
    structure.members = { Manifest: 0, Collection: 0 };
    for (const member of [
      ...list(json.items),
      ...list(json.manifests),
      ...list(json.collections),
      ...list(json.members),
    ]) {
      const kind = typeOf(member);
      if (kind === "Manifest" || kind === "Collection")
        structure.members[kind]++;
    }
  } else if (type === "Manifest") {
    const containers = [
      ...list(json.items),
      ...list(json.sequences).flatMap((sequence) =>
        isObject(sequence) ? list(sequence.canvases) : [],
      ),
    ];
    let read = 0;
    for (const container of containers) {
      const kind = containerType(container);
      if (!kind || !isObject(container)) continue;
      if (++read > LIMITS.containers) {
        structure.containers[kind]++;
        past();
        continue;
      }
      readContainer(container, kind);
    }
    readPages(json.annotations);
    // Ranges, and the Ranges in them.
    const ranges = [...list(json.structures)];
    while (ranges.length) {
      const range = ranges.shift();
      if (typeOf(range) !== "Range" || !isObject(range)) continue;
      if (++structure.ranges > LIMITS.ranges) {
        structure.ranges--;
        past();
        break;
      }
      ranges.push(
        ...list(range.items).filter((each) => typeOf(each) === "Range"),
      );
    }
  } else readContainer(json, type);

  structure.formats = [...formats];
  structure.services = [...services].sort();
  structure.annotations.motivations = [...motivations];
  return structure;
}
