/**
 * Clover's Trusted Types policy, `clover`, for a page whose Content Security Policy
 * requires Trusted Types (`require-trusted-types-for 'script'`). It passes only what
 * Clover writes as HTML: IIIF's HTML once DOMPurify has sanitized it (`core/sanitize.ts`,
 * which DOMPurify parses through it too, as its own policy would), and a selector's SVG,
 * read in an inert document (`core/svg-shape.ts`). It makes no script URL. A page that
 * names the policies it allows names this one: `trusted-types clover` (and
 * `'allow-duplicates'` where React's Clover and the elements share a page). Nothing where
 * the browser has no Trusted Types, or the page refuses the name: HTML stays a string.
 */
export interface CloverPolicy {
  createHTML(html: string): unknown;
  createScriptURL(url: string): unknown;
}

let policy: CloverPolicy | null | undefined;

export function trustedPolicy(): CloverPolicy | null {
  if (policy === undefined) {
    const factory = (
      globalThis as {
        trustedTypes?: {
          createPolicy(name: string, rules: CloverPolicy): CloverPolicy;
        };
      }
    ).trustedTypes;
    try {
      policy =
        factory?.createPolicy("clover", {
          createHTML: (html) => html,
          createScriptURL: () => {
            throw new TypeError("Clover makes no script URLs");
          },
        }) ?? null;
    } catch {
      policy = null;
    }
  }
  return policy;
}

/**
 * HTML for a sink (`innerHTML`, `parseFromString`), through `clover` where the page has
 * Trusted Types: only what Clover has sanitized, or parses where nothing runs.
 */
export function trusted(html: string): string {
  return (trustedPolicy()?.createHTML(html) as string | undefined) ?? html;
}
