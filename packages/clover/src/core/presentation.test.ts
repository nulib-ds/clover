import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { upgradeToPresentation4 } from "@iiif/parser/presentation-4/upgrader";

import { keepFragments } from "./keep-fragments";
import { isPresentation4, toPresentation4 } from "./presentation";

/*
 * Clover upgrades in two steps, so a page reading Presentation 3 never loads the reader of
 * 2 (Mat, 2026-10-30): `upgradePresentation3To4`, after `convertPresentation2` for
 * Presentation 2 alone. The upgrader is what every part reads, so this holds the two steps
 * to the one `@iiif/parser` takes (`upgradeToPresentation4`) for every resource there is
 * here: the same Presentation 4 out, and the caller's own object never changed.
 */
const before = (resource: unknown) =>
  isPresentation4(resource)
    ? resource
    : upgradeToPresentation4(keepFragments(resource));

/** Every JSON file under `folder`. */
const jsonUnder = (folder: string): string[] =>
  existsSync(folder)
    ? readdirSync(folder).flatMap((name) => {
        const path = join(folder, name);
        if (name === "node_modules") return [];
        if (statSync(path).isDirectory()) return jsonUnder(path);
        return name.endsWith(".json") ? [path] : [];
      })
    : [];

const root = resolve(__dirname, "../..");
const files = [
  ...jsonUnder(resolve(root, "src/fixtures")),
  ...jsonUnder(resolve(root, "e2e")),
  // The docs' published mocks, where the package sits in this repository.
  ...jsonUnder(resolve(root, "../../public/mocks")),
  /*
   * Resources from the world, which this repository does not keep: a folder of them,
   * as `build/upgrade-resources.mjs` fetches Mirador's fixtures and the Universal
   * Viewer's examples (Presentation 2 and 3 from many institutions).
   */
  ...(process.env.CLOVER_UPGRADE_RESOURCES
    ? jsonUnder(resolve(process.env.CLOVER_UPGRADE_RESOURCES))
    : []),
];

/*
 * `@iiif/parser` mints an id for a Presentation 2 resource with none
 * ("http://example.org/oa:Annotation/2"), counting across every call: which number it
 * takes depends on what was read before, not on how. Compared without the number.
 */
const unminted = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value ?? null).replace(
      /(http:\/\/example\.org\/[^"/]+\/)\d+/g,
      "$1#",
    ),
  );

const IMAGE_2 = {
  "@context": "http://iiif.io/api/image/2/context.json",
  "@id": "https://example.org/iiif/book1-page1",
  profile: "http://iiif.io/api/image/2/level1.json",
};

/** Presentation 2.1, after the specification's own examples. */
const PRESENTATION_2 = {
  manifest: {
    "@context": "http://iiif.io/api/presentation/2/context.json",
    "@id": "https://example.org/iiif/book1/manifest",
    "@type": "sc:Manifest",
    label: [
      { "@value": "Book 1", "@language": "en" },
      { "@value": "Livre 1", "@language": "fr" },
    ],
    metadata: [
      { label: "Author", value: "Anne Author" },
      {
        label: "Published",
        value: [
          { "@value": "Paris, circa 1400", "@language": "en" },
          { "@value": "Paris, environ 1400", "@language": "fr" },
        ],
      },
    ],
    description: "A <b>book</b> of hours.",
    thumbnail: {
      "@id": "https://example.org/iiif/book1/page1/full/80,100/0/default.jpg",
      service: IMAGE_2,
    },
    viewingDirection: "right-to-left",
    viewingHint: "paged",
    navDate: "1856-01-01T00:00:00Z",
    license: "http://rightsstatements.org/vocab/NoC-NC/1.0/",
    attribution: "Provided by Example Organization",
    logo: "https://example.org/logos/institution1.jpg",
    related: { "@id": "https://example.org/info/book1/", format: "text/html" },
    seeAlso: {
      "@id": "https://example.org/library/catalog/book1.xml",
      format: "text/xml",
    },
    within: "https://example.org/collections/books/",
    sequences: [
      {
        "@id": "https://example.org/iiif/book1/sequence/normal",
        "@type": "sc:Sequence",
        label: "Current page order",
        startCanvas: "https://example.org/iiif/book1/canvas/p2",
        canvases: ["p1", "p2"].map((page, index) => ({
          "@id": `https://example.org/iiif/book1/canvas/${page}`,
          "@type": "sc:Canvas",
          label: `p. ${index + 1}`,
          height: 1000,
          width: 750,
          images: [
            {
              "@id": `https://example.org/iiif/book1/annotation/${page}-image`,
              "@type": "oa:Annotation",
              motivation: "sc:painting",
              resource: {
                "@id": `https://example.org/iiif/book1/res/${page}.jpg`,
                "@type": "dctypes:Image",
                format: "image/jpeg",
                service: { ...IMAGE_2, "@id": `${IMAGE_2["@id"]}-${page}` },
                height: 2000,
                width: 1500,
              },
              on: `https://example.org/iiif/book1/canvas/${page}`,
            },
          ],
          otherContent: [
            {
              "@id": `https://example.org/iiif/book1/list/${page}`,
              "@type": "sc:AnnotationList",
            },
          ],
        })),
      },
    ],
    structures: [
      {
        "@id": "https://example.org/iiif/book1/range/r0",
        "@type": "sc:Range",
        label: "Table of Contents",
        viewingHint: "top",
        members: [
          {
            "@id": "https://example.org/iiif/book1/canvas/p1",
            "@type": "sc:Canvas",
            label: "Page 1",
          },
          {
            "@id": "https://example.org/iiif/book1/range/r1",
            "@type": "sc:Range",
            label: "Introduction",
          },
        ],
      },
      {
        "@id": "https://example.org/iiif/book1/range/r1",
        "@type": "sc:Range",
        label: "Introduction",
        canvases: ["https://example.org/iiif/book1/canvas/p2#xywh=0,0,750,300"],
      },
    ],
  },
  collection: {
    "@context": "http://iiif.io/api/presentation/2/context.json",
    "@id": "https://example.org/iiif/collection/top",
    "@type": "sc:Collection",
    label: "Top Level Collection",
    viewingHint: "top",
    collections: [
      {
        "@id": "https://example.org/iiif/collection/sub1",
        "@type": "sc:Collection",
        label: "Sub-Collection 1",
      },
    ],
    manifests: [
      {
        "@id": "https://example.org/iiif/book1/manifest",
        "@type": "sc:Manifest",
        label: "Book 1",
      },
    ],
  },
  // No context: Presentation 2's `@id` and `sc:` type are enough to be read as 2.
  bare: {
    "@id": "https://example.org/iiif/book2/manifest",
    "@type": "sc:Manifest",
    label: "Book 2",
    sequences: [{ "@type": "sc:Sequence", canvases: [] }],
  },
  annotationList: {
    "@context": "http://iiif.io/api/presentation/2/context.json",
    "@id": "https://example.org/iiif/book1/list/p1",
    "@type": "sc:AnnotationList",
    resources: [
      {
        "@type": "oa:Annotation",
        motivation: "sc:painting",
        resource: {
          "@type": "cnt:ContentAsText",
          chars: "Here",
          format: "text/plain",
        },
        on: "https://example.org/iiif/book1/canvas/p1#xywh=100,100,250,20",
      },
    ],
  },
};

const json = (file: string) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
};

const resources: [string, unknown][] = [
  ...files.map((file): [string, unknown] => [
    file.replace(root, ""),
    json(file),
  ]),
  ...Object.entries(PRESENTATION_2),
].filter(([, resource]) => resource && typeof resource === "object");

describe("toPresentation4", () => {
  it("holds resources of every version to compare", () => {
    expect(resources.length).toBeGreaterThan(60);
    expect(
      resources.some(([, resource]) =>
        JSON.stringify(resource).includes("iiif.io/api/presentation/3/"),
      ),
    ).toBe(true);
  });

  it.each(resources)(
    "upgrades %s as @iiif/parser's upgradeToPresentation4 does",
    async (_name, resource) => {
      const given = JSON.stringify(resource);
      let expected: unknown;
      let failure: unknown;
      try {
        expected = before(structuredClone(resource));
      } catch (error) {
        failure = error;
      }
      if (failure) {
        await expect(toPresentation4(resource)).rejects.toThrow();
        return;
      }
      expect(unminted(await toPresentation4(resource))).toEqual(
        unminted(expected),
      );
      // The caller's object is never changed.
      expect(JSON.stringify(resource)).toBe(given);
    },
  );
});
