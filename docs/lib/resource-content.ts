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

/** The resource itself, or the Manifest or Collection named by a content state. */
export const rootAddress = (content: string) => {
  const direct = webAddress(content);
  if (direct) return direct;
  const state = decodeContentState(content);
  if (!state) return undefined;
  const targets = state.target ?? state;
  const target = Array.isArray(targets) ? targets[0] : targets;
  if (typeof target === "string") return webAddress(target.split("#")[0]);
  const parents = target?.partOf;
  const root = ROOTS.includes(target?.type)
    ? target
    : (Array.isArray(parents) ? parents : [parents]).find((part: any) =>
        ROOTS.includes(part?.type),
      );
  const id = root?.id ?? root?.["@id"];
  return typeof id === "string" ? webAddress(id.split("#")[0]) : undefined;
};
