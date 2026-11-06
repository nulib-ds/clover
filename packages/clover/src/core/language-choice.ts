import { startingLanguage } from "../i18n/languages";

export { startingLanguage };
import { localize, type LanguageMapLike } from "./value";

/** A language map's languages, as its keys give them (never `none`). */
const keysOf = (value: unknown): string[] =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).filter(
        (tag) =>
          tag !== "none" &&
          tag !== "@none" &&
          localize({ [tag]: (value as any)[tag] } as LanguageMapLike).text,
      )
    : [];

/**
 * The languages to choose among in what a Manifest says of itself (Cookbook 0006, 0118):
 * its label, summary, metadata and required statement, where one of them is given in two
 * or more, the languages those come in, in the order they first come. None where every
 * one is in a single language, which a choice would not change.
 */
export function descriptionLanguages(
  manifest: Record<string, any> | null | undefined,
): string[] {
  if (!manifest) return [];
  const pairs = [
    ...(Array.isArray(manifest.metadata) ? manifest.metadata : []),
    manifest.requiredStatement,
  ].filter(Boolean);
  const maps = [
    manifest.label,
    manifest.summary,
    ...pairs.flatMap((pair: any) => [pair?.label, pair?.value]),
  ];
  const tags = maps.map(keysOf).filter((each) => each.length > 1);
  return [...new Set(tags.flat())];
}
