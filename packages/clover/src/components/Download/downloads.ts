import { selectVisibleCanvases } from "../../core/selectors";
import { type LanguageMapLike, hrefLangOf, localize } from "../../core/value";
import { asArray } from "../../lib/asArray";
import { useClover, useCloverSelector } from "../../react/context";

/*
 * What there is to download, read apart from how the links are drawn (`Download.tsx`):
 * About decides by it whether to offer Download's button, whose links load with its
 * popover, so a page with a Panel never carries them until they are wanted (Mat,
 * 2026-10-30: the Default template's first view under 95 kB).
 */

export interface Rendering {
  id: string;
  label: string;
  lang?: string;
  format?: string;
  /** The file's own language, where its `language` gives one. */
  hrefLang?: string;
}

function renderingsOf(
  resources: Array<Record<string, any> | null | undefined>,
  language: string | undefined,
): Rendering[] {
  const seen = new Set<string>();
  const out: Rendering[] = [];
  for (const resource of resources) {
    for (const item of asArray(resource?.rendering) as Array<
      Record<string, any>
    >) {
      const id = item?.id ?? item?.["@id"];
      if (typeof id !== "string" || seen.has(id)) continue;
      seen.add(id);
      const label = localize(item.label as LanguageMapLike, language);
      out.push({
        id,
        label: label.text || item.format || id,
        // A format or an address in place of a label is in no language.
        lang: label.text ? label.lang : undefined,
        format: item.format,
        hrefLang: hrefLangOf(item),
      });
    }
  }
  return out;
}

/**
 * What there is to download: the `rendering` of the Canvases in view (`page`) and of the
 * Manifest (`all`), each once, labeled in the reader's language.
 */
export function useDownloads() {
  const { language } = useClover("Download");
  const manifest = useCloverSelector((state) => state.manifest);
  const shown = useCloverSelector((state) =>
    selectVisibleCanvases(state.manifest, state.canvasId),
  );
  return {
    page: renderingsOf(shown as never, language),
    all: renderingsOf([manifest as never], language),
  };
}
