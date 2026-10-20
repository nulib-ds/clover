/*
 * Edits the Canvas page's demos make to a Cookbook recipe after fetching it, for what no
 * recipe has (`CanvasRecipe`'s `adapt`, by name). Kept here, not in the page: a page is
 * drawn on the server, and a function cannot be handed from there to a component in the
 * browser.
 */

type Manifest = Record<string, any>;

export const ADAPTERS = {
  /*
   * Cookbook 0029's Canvases, each given a small still of itself, cut by its own image
   * service, as its placeholder.
   */
  placeholderStills: (manifest: Manifest): Manifest => ({
    ...manifest,
    items: manifest.items.map((canvas: Manifest) => {
      const service = canvas.items[0].items[0].body.service[0].id;
      return {
        ...canvas,
        placeholderCanvas: {
          id: `${canvas.id}/placeholder`,
          type: "Canvas",
          width: 400,
          height: 254,
          items: [
            {
              id: `${canvas.id}/placeholder/page`,
              type: "AnnotationPage",
              items: [
                {
                  id: `${canvas.id}/placeholder/image`,
                  type: "Annotation",
                  motivation: "painting",
                  body: {
                    id: `${service}/full/400,/0/default.jpg`,
                    type: "Image",
                    format: "image/jpeg",
                    width: 400,
                    height: 254,
                  },
                  target: `${canvas.id}/placeholder`,
                },
              ],
            },
          ],
        },
      };
    }),
  }),
  /* The third Canvas of Cookbook 0009's book marked `facing-pages`. */
  thirdFacingPages: (manifest: Manifest): Manifest => ({
    ...manifest,
    items: manifest.items.map((canvas: Manifest, index: number) =>
      index === 2 ? { ...canvas, behavior: ["facing-pages"] } : canvas,
    ),
  }),
};

export type AdapterName = keyof typeof ADAPTERS;
