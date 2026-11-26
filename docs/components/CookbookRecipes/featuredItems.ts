export interface FeaturedItem {
  title: string;
  /** The title's language, where it is not the page's English (WCAG 3.1.2). */
  lang?: string;
  /** The IIIF manifest the Viewer opens. */
  resource: string;
  thumbnail: string;
}

const works = "https://api.dc.library.northwestern.edu/api/v2/works";

const item = (id: string, title: string, lang?: string): FeaturedItem => ({
  title,
  lang,
  resource: `${works}/${id}?as=iiif`,
  thumbnail: `${works}/${id}/thumbnail`,
});

/**
 * Northwestern Digital Collections items offered as one-click starting points on the demo
 * page. Titles are copied from each manifest's `label` so the cards need no fetch to render;
 * only the thumbnails load, and lazily.
 */
export const featuredItems: FeaturedItem[] = [
  item("b52d5d93-a117-43e9-90c7-434fa1212b60", "[Manuscript notebook]."),
  item(
    "d8fb6329-f7fb-48bf-8bb7-70a64ded5a15",
    "Northwestern Football scrimmages, 1959",
  ),
  item(
    "e09b4be2-6446-445b-9619-2b573f4d18f4",
    "Miles Davis, Berkeley Jazz Festival",
  ),
  item(
    "247626d5-a97d-44df-9a05-dba00879ab82",
    "Map of Sunbury, Pennsylvania by Amelia D. Hegins",
  ),
  item("f2adabc0-497f-4284-b969-5829971fa2a2", "Bicycles"),
  item("0b035114-09b8-47b0-9ada-eb3c47711c0f", "مجموع فوائد", "ar"),
  item("84aec8c1-42e8-4e2c-a6b2-1c7e3790217f", "Joseph - Nez Percé"),
  item(
    "29832c6d-b5db-4e44-be81-54062fada10e",
    "Photograph of Ira Aldridge as Shylock",
  ),
];
