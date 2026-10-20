"use client";

import { usePathname, useRouter as useAppRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";

/**
 * The few parts of the Pages Router's `useRouter()` the docs' components read, on the App
 * Router: the query (once the page has hydrated, as `isReady` says), the path, the base
 * path, and `push` / `replace`.
 *
 * A `shallow` move only changes the address, through the history API, which the App
 * Router follows without loading the page again; it is how the playground and the demos
 * record what the reader picked. Any other move is the App Router's own.
 */

/** Where the site is served (`/clover` on nulib-ds.github.io), from `next.config.mjs`. */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type Query = Record<string, string | string[] | undefined>;
type Url = string | { pathname?: string; query?: Query };
type Options = { shallow?: boolean; scroll?: boolean };

export interface DocsRouter {
  basePath: string;
  pathname: string;
  query: Query;
  /** The query has been read: false on the server and until the page hydrates. */
  isReady: boolean;
  push: (url: Url, as?: undefined, options?: Options) => Promise<boolean>;
  replace: (url: Url, as?: undefined, options?: Options) => Promise<boolean>;
}

/* A shallow move changes the address without a `popstate`, so it says so itself. */
const MOVED = "clover-docs:location";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(MOVED, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(MOVED, onChange);
  };
}

const clientSearch = () => window.location.search;
// Not read yet: the server, and the first render on the client, which must match it.
const serverSearch = () => null;

function toQuery(search: string): Query {
  const query: Query = {};
  new URLSearchParams(search).forEach((value, key) => {
    const held = query[key];
    query[key] =
      held === undefined
        ? value
        : Array.isArray(held)
          ? [...held, value]
          : [held, value];
  });
  return query;
}

function toSearch(query: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const one of ([] as string[]).concat(value)) params.append(key, one);
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function useRouter(): DocsRouter {
  const app = useAppRouter();
  const pathname = usePathname() ?? "/";
  const search = useSyncExternalStore(subscribe, clientSearch, serverSearch);

  return useMemo(() => {
    const go =
      (method: "push" | "replace") =>
      (url: Url, _as?: undefined, options: Options = {}) => {
        const target =
          typeof url === "string"
            ? url
            : (url.pathname ?? pathname) + toSearch(url.query ?? {});
        if (options.shallow) {
          const address = basePath + target;
          if (method === "push") window.history.pushState(null, "", address);
          else window.history.replaceState(null, "", address);
          window.dispatchEvent(new Event(MOVED));
        } else {
          app[method](target, { scroll: options.scroll ?? true });
        }
        return Promise.resolve(true);
      };
    return {
      basePath,
      pathname,
      query: search === null ? {} : toQuery(search),
      isReady: search !== null,
      push: go("push"),
      replace: go("replace"),
    };
  }, [app, pathname, search]);
}
