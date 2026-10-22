import { execFileSync } from "node:child_process";

/*
 * When a file last changed: its last commit's time, from Git, as ISO 8601, for a page's
 * structured data and Open Graph (`app/[[...mdxPath]]/page.tsx`) and for the sitemap
 * (`docs/lib/agents.ts`). Nextra's own `timestamp` is not always the file's (2026-10-21:
 * the Panel's page gave the day before its last commit, i18n's the day after), so the
 * site asks Git itself. The deploy checks out the whole history (`fetch-depth: 0`,
 * `deploy-pages.yml`); with one commit, every page would carry its time. A file Git does
 * not know (a new page in `next dev`) has none. Server only.
 */
const times = new Map<string, string | undefined>();

export function lastChanged(file?: string) {
  if (!file) return undefined;
  if (!times.has(file)) {
    let time: string | undefined;
    try {
      time = execFileSync("git", ["log", "-1", "--format=%cI", "--", file], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      time = undefined;
    }
    times.set(file, time ? new Date(time).toISOString() : undefined);
  }
  return times.get(file);
}
