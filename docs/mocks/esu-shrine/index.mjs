/**
 * A 3D model: Northwestern University's Material History Lab's scan of an Esu shrine, an
 * altar piece sculpture of Esu collected in Ibadan, Oyo State, Nigeria, in 2012 (catalog
 * number IBD12-AD-2-1), as a Presentation 4 Manifest of one Scene. The Lab publishes no
 * IIIF for it: its object page
 * (https://sites.northwestern.edu/materialhistorylab/collection/IBD12-AD-2-1/) shows the
 * model in Smithsonian Voyager, from a Voyager scene (`source.json`, kept as fetched on
 * October 23, 2026), which names the model, a GLB. The Manifest is written from those
 * two:
 *
 * - its label, metadata and homepage from the object page's title and "Object Data",
 *   word for word (the Voyager scene's title spells it "Esu Shrne");
 * - its summary written from those fields, as it has none;
 * - its attribution the Voyager scene's copyright, "© 2025 Northwestern University";
 * - its thumbnail the first of the object page's photographs of the shrine;
 * - its Scene painting the model at its origin, with no camera or light, which Clover
 *   provides, as Cookbook recipe 0608 does.
 *
 * The model is Northwestern's (© 2025 Northwestern University; 34.5 MB), kept beside the
 * Manifest (Mat, 2026-10-23): the Lab's server sends no CORS headers, so a page on another
 * site cannot fetch it from there. `scripts/build-mocks.mjs` fetches it from the Lab when
 * `public/mocks/esu-shrine/model.glb` is missing, and keeps it as it came.
 *
 * Static: `scripts/build-mocks.mjs` writes it to `public/mocks/esu-shrine/`, published at
 * https://nulib-ds.github.io/clover/mocks/esu-shrine/; live in `npm run dev`, its ids under
 * the dev server, from `pages/api/mocks/esu-shrine/`. Documented at /docs/mocks.
 */
import source from "./source.json";

export const PUBLIC_BASE = "https://nulib-ds.github.io/clover/mocks/esu-shrine";

/** Where the Lab's Voyager scene is, and so its model. */
const VOYAGER =
  "https://materialhistorylab.mtiapp.northwestern.edu/voyager/scenes/IBD12-AD-2-1/voyager-scene";

/** The model, as the Lab serves it: the Voyager scene's one derivative. */
export const LAB_MODEL = `${VOYAGER}/${source.models[0].derivatives[0].assets[0].uri}`;

/** The model's copy beside the Manifest. */
export const MODEL_FILE = "model.glb";

/** The object's page at the Lab, and its fields, as it published them on October 23, 2026. */
export const PAGE =
  "https://sites.northwestern.edu/materialhistorylab/collection/IBD12-AD-2-1/";

const FIELDS = [
  ["Catalog Number", "IBD12-AD-2-1"],
  ["Collection Location", "Northwestern University"],
  ["Year Collected", "2012"],
  ["Object Type", "Altar Piece Sculpture of Esu"],
  ["Country", "Nigeria"],
  ["Region", "Oyo State"],
  ["Place", "Ibadan"],
  ["Culture", "Yoruba"],
  ["Time Period", "20th century"],
  [
    "Material(s)",
    "Wood; Vegetal pigment; Cowry; Brass; Clamshell; Cotton textile; Leather; Animal horn; Animal bone; Aluminum(?); Iron/brass chain(?); Flat plastic(?) beads",
  ],
  ["Height", "22 in."],
  ["Width", "8 in."],
  ["Length", "8 in."],
];

const en = (value) => ({ en: [value] });

/**
 * The model turned about its upright axis, in degrees, so a viewer's default camera, which
 * looks from the front (`+z`), opens on the view the Lab's Voyager scene opens on: its
 * camera turned this far the other way (its orbit's yaw, 399.52°, less a turn).
 */
export const TURN = -(source.setups[0].navigation.orbit.orbit[1] - 360);

/**
 * The first of the object page's photographs of the shrine ("Esu Shrine_1"), at the size
 * the page links it. Not the Voyager scene's renderings of the model: each shows its
 * editor's guides, a box drawn round the model.
 */
const PHOTO = {
  id: "https://sites.northwestern.edu/materialhistorylab/files/2025/10/DSC_4700-602x1024.jpg",
  type: "Image",
  format: "image/jpeg",
  width: 602,
  height: 1024,
};

/** The Manifest, its ids and its model's address under `base`. */
export function manifest(base = PUBLIC_BASE) {
  const scene = `${base}/scene/1`;
  return {
    "@context": "http://iiif.io/api/presentation/4/context.json",
    id: `${base}/manifest.json`,
    type: "Manifest",
    label: en("Esu Shrine"),
    summary: en(
      "An altar piece sculpture of Esu, Yoruba, of the 20th century, collected in Ibadan, Oyo State, Nigeria, in 2012: a 3D model by Northwestern University's Material History Lab.",
    ),
    metadata: FIELDS.map(([label, value]) => ({
      label: en(label),
      value: en(value),
    })),
    requiredStatement: {
      label: en("Attribution"),
      value: en(source.asset.copyright),
    },
    homepage: [
      {
        id: PAGE,
        type: "Text",
        label: en("Esu Shrine, Material History Lab, Northwestern University"),
        format: "text/html",
      },
    ],
    thumbnail: [PHOTO],
    items: [
      {
        id: scene,
        type: "Scene",
        label: en("Esu Shrine"),
        items: [
          {
            id: `${scene}/page`,
            type: "AnnotationPage",
            items: [
              {
                id: `${scene}/page/1`,
                type: "Annotation",
                motivation: ["painting"],
                body: {
                  type: "SpecificResource",
                  source: {
                    id: `${base}/${MODEL_FILE}`,
                    type: "Model",
                    format: "model/gltf-binary",
                  },
                  transform: [{ type: "RotateTransform", x: 0, y: TURN, z: 0 }],
                },
                target: { id: scene, type: "Scene" },
              },
            ],
          },
        ],
      },
    ],
  };
}
