/** A web address the homepage's resource field can open. */
export const webAddress = (value: string) => {
  try {
    const { protocol, hostname } = new URL(value);
    return (protocol === "http:" || protocol === "https:") && hostname
      ? value
      : undefined;
  } catch {
    return undefined;
  }
};

/** A IIIF Content State: base64url of the URI-encoded JSON. No IIIF runtime needed. */
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

/** Whether a resource is a Manifest or Collection, by its `type`, or 2's `@type`. */
const isRoot = (value: any) => ROOTS.includes(value?.type ?? value?.["@type"]);

/** A content state's first target, and the selectors that say where in it. */
const firstTarget = (state: Record<string, any>) => {
  const targets = state.target ?? state;
  const first = Array.isArray(targets) ? targets[0] : targets;
  // An annotation it targets (a search's hit) is where that annotation targets.
  const named = first?.type === "Annotation" ? [first.target].flat()[0] : first;
  // A SpecificResource names what it selects from as its `source`: Clover writes one for
  // a view with a time or a region (`buildContentState`), and its reader takes it so.
  return named?.type === "SpecificResource"
    ? { target: named.source, selectors: [named.selector ?? []].flat() }
    : { target: named, selectors: [] as any[] };
};

/** The resource itself, or the Manifest or Collection named by a content state. */
export const rootAddress = (content: string) => {
  const direct = webAddress(content);
  if (direct) return direct;
  const state = decodeContentState(content);
  if (!state) return undefined;
  const { target } = firstTarget(state);
  if (typeof target === "string") return webAddress(target.split("#")[0]);
  const parents = target?.partOf;
  const root = isRoot(target)
    ? target
    : (Array.isArray(parents) ? parents : [parents]).find(isRoot);
  const id = root?.id ?? root?.["@id"];
  return typeof id === "string" ? webAddress(id.split("#")[0]) : undefined;
};

/** A Manifest's Canvases (or Timelines and Scenes) by id, in its order. */
export const itemIds = (resource: any): string[] | undefined => {
  const list =
    resource?.type === "Manifest"
      ? resource.items
      : resource?.["@type"] === "sc:Manifest"
        ? resource.sequences?.[0]?.canvases
        : undefined;
  if (!Array.isArray(list)) return undefined;
  return list
    .map((item: any) => item?.id ?? item?.["@id"])
    .filter((id: unknown): id is string => typeof id === "string");
};

/** Seconds as Clover's Seek reads them: "1:25", "1:02:03". */
const clock = (seconds: number) => {
  const whole = Math.floor(seconds);
  const [hours, minutes, rest] = [
    Math.floor(whole / 3600),
    Math.floor((whole % 3600) / 60),
    whole % 60,
  ];
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours
    ? `${hours}:${pad(minutes)}:${pad(rest)}`
    : `${minutes}:${pad(rest)}`;
};

/** A part of what the homepage's field says of a content state: a place's word apart. */
export interface NotePart {
  text: string;
  /** IIIF's word for what a place counts ("Canvas"), which a narrow field leaves out. */
  word?: string;
}

/**
 * Where a content state opens, said after its root's label in the homepage's field (Mat,
 * 2026-11-08): the place of its Canvas among the Manifest's `items` where there are
 * several ("Canvas 3 / 12", in IIIF's word for what it names), its time ("1:25", or
 * "1:25–1:40") and its region (`xywh=…`, as written). Nothing for an address, or for a
 * content state that names a Manifest or Collection and no place in it.
 */
export const contentStateNote = (
  content: string,
  items?: string[],
): NotePart[] | undefined => {
  if (webAddress(content)) return undefined;
  const state = decodeContentState(content);
  if (!state) return undefined;
  const { target, selectors } = firstTarget(state);
  const id =
    typeof target === "string" ? target : (target?.id ?? target?.["@id"]);
  if (typeof id !== "string") return undefined;
  const type = String(
    (typeof target === "object" && (target?.type ?? target?.["@type"])) ||
      "Canvas",
  ).replace(/^sc:/, "");
  if (type === "Manifest" || type === "Collection") return undefined;

  const [address, own = ""] = id.split("#");
  const fragment = new URLSearchParams(
    [
      own,
      ...selectors
        .filter((s) => s?.type === "FragmentSelector")
        .map((s) => (typeof s.value === "string" ? s.value : "")),
    ].join("&"),
  );
  // A point in time can come as a PointSelector's `t`, as Clover's reader takes it.
  const point = selectors.find(
    (s) => s?.type === "PointSelector" && s.t != null,
  )?.t;
  const [from = "", to = ""] = (fragment.get("t") ?? "")
    .replace(/^npt:/, "")
    .split(",");
  const start = point != null ? Number(point) : from ? Number(from) : NaN;
  const end = point == null && to ? Number(to) : NaN;
  const time = Number.isFinite(start)
    ? Number.isFinite(end) && end > start
      ? `${clock(start)}–${clock(end)}`
      : clock(start)
    : undefined;
  const xywh = fragment.get("xywh");

  const index = items ? items.indexOf(address) : -1;
  const note: NotePart[] = [
    ...(items && items.length > 1 && index >= 0
      ? [{ word: type, text: `${index + 1} / ${items.length}` }]
      : []),
    ...(time ? [{ text: time }] : []),
    ...(xywh ? [{ text: `xywh=${xywh}` }] : []),
  ];
  return note.length ? note : undefined;
};
