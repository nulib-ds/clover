import en from "./en.json";

/** A shipped language's strings, loaded when Clover is first asked to speak it. */
export type LocaleLoader = () => Promise<{ default: Record<string, string> }>;

/**
 * English ships with Clover, the fallback for every string. Each other language is its own
 * chunk, fetched only on a page that speaks it: bundled together they were 5.7 kB gzip
 * on every page.
 */
export const loaders: Record<string, LocaleLoader> = {
  es: () => import("./es.json"),
  fi: () => import("./fi.json"),
  fr: () => import("./fr.json"),
  nb: () => import("./nb.json"),
  nn: () => import("./nn.json"),
  no: () => import("./no.json"),
  pt: () => import("./pt.json"),
};

export { en };
