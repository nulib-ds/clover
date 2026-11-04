/**
 * MapLibre's stylesheet as text, for a page that has none of its own (`sheet.ts`). Empty
 * here: the package's build fills it (`lazySheets`, `build/clover-sheets.mjs`), so a page
 * never has to import `maplibre-gl/dist/maplibre-gl.css`. Loaded only with MapLibre, when
 * a map is first shown on such a page.
 */
export const css: string | undefined = undefined;
