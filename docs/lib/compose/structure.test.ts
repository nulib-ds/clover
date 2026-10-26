import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LIMITS, mediaType, structureOf } from "./structure";

const mock = (name: string, file = "manifest.json") =>
  JSON.parse(
    readFileSync(
      path.resolve(__dirname, "../../../public/mocks", name, file),
      "utf8",
    ),
  );

/** A Presentation 2 Manifest, as 2's resources are written. */
const PRESENTATION_2 = {
  "@context": "http://iiif.io/api/presentation/2/context.json",
  "@id": "https://example.org/iiif/book/manifest",
  "@type": "sc:Manifest",
  label: "A book",
  description: "Its description.",
  attribution: "Its attribution.",
  license: "https://creativecommons.org/licenses/by/4.0/",
  within: "https://example.org/iiif/collection",
  viewingHint: "paged",
  viewingDirection: "right-to-left",
  service: {
    "@context": "http://iiif.io/api/search/1/context.json",
    "@id": "https://example.org/iiif/book/search",
    profile: "http://iiif.io/api/search/1/search",
  },
  sequences: [
    {
      "@type": "sc:Sequence",
      canvases: [1, 2, 3].map((page) => ({
        "@id": `https://example.org/iiif/book/canvas/p${page}`,
        "@type": "sc:Canvas",
        label: `p. ${page}`,
        images: [
          {
            "@type": "oa:Annotation",
            motivation: "sc:painting",
            resource: {
              "@id": `https://example.org/iiif/book/p${page}/full/full/0/default.jpg`,
              "@type": "dctypes:Image",
              format: "image/jpeg",
              service: {
                "@context": "http://iiif.io/api/image/2/context.json",
                "@id": `https://example.org/iiif/book/p${page}`,
                profile: "http://iiif.io/api/image/2/level2.json",
              },
            },
            on: `https://example.org/iiif/book/canvas/p${page}`,
          },
        ],
        otherContent: [
          {
            "@id": `https://example.org/iiif/book/list/p${page}`,
            "@type": "sc:AnnotationList",
          },
        ],
      })),
    },
  ],
  structures: [
    { "@id": "https://example.org/iiif/book/range/r1", "@type": "sc:Range" },
    { "@id": "https://example.org/iiif/book/range/r2", "@type": "sc:Range" },
  ],
};

describe("structureOf", () => {
  it("reads Presentation 3: containers, what paints them, services, annotations, Ranges", () => {
    expect(structureOf(mock("paged"))).toMatchObject({
      type: "Manifest",
      version: 3,
      containers: { Canvas: 31, Timeline: 0, Scene: 0 },
      painting: { image: 31 },
      formats: ["image/tiff"],
      services: ["image-3", "image-level-2"],
      annotations: { motivations: ["tagging"] },
      ranges: 20,
      behavior: ["paged"],
      placeholder: 31,
      properties: expect.arrayContaining(["label", "metadata", "provider"]),
    });
  });

  it("reads Presentation 4: a Scene painted with a model through a SpecificResource", () => {
    expect(structureOf(mock("esu-shrine"))).toMatchObject({
      version: 4,
      containers: { Scene: 1 },
      painting: { model: 1 },
      formats: ["model/gltf-binary"],
    });
  });

  it("reads Presentation 2: sequences, images, viewingHint, otherContent and 2's names", () => {
    expect(structureOf(PRESENTATION_2)).toMatchObject({
      type: "Manifest",
      version: 2,
      containers: { Canvas: 3 },
      painting: { image: 3 },
      formats: ["image/jpeg"],
      services: ["image-2", "image-level-2", "search-1"],
      annotations: { embedded: 0, referenced: 3 },
      ranges: 2,
      behavior: ["paged"],
      viewingDirection: "right-to-left",
      properties: expect.arrayContaining([
        "label",
        "summary",
        "requiredStatement",
        "rights",
        "partOf",
      ]),
    });
  });

  it("finds captions, plain-text transcripts, georeferencing and a search service", () => {
    expect(structureOf(mock("transcripts"))).toMatchObject({
      painting: { video: 1 },
      captions: 1,
      transcripts: 1,
      renderings: 1,
    });
    expect(structureOf(mock("georeference"))).toMatchObject({
      navPlace: true,
      annotations: { motivations: ["georeferencing"] },
    });
    expect(structureOf(mock("content-search"))).toMatchObject({
      services: expect.arrayContaining(["search-2"]),
      annotations: { referenced: 2 },
    });
  });

  it("counts a Collection's members by type, unread", () => {
    expect(structureOf(mock("cookbook", "collection.json"))).toMatchObject({
      type: "Collection",
      members: { Manifest: expect.any(Number), Collection: expect.any(Number) },
      containers: { Canvas: 0 },
    });
  });

  it("keeps none of the resource's words, however they are written", () => {
    const words = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/SECRET-id",
      type: "Manifest",
      label: { en: ["SECRET label"] },
      metadata: [{ label: { en: ["SECRET"] }, value: { en: ["SECRET"] } }],
      behavior: ["SECRET-behavior", "paged"],
      viewingDirection: "SECRET",
      service: [{ id: "x", type: "SECRETService", profile: "SECRET" }],
      items: [
        {
          id: "https://example.org/SECRET-canvas",
          type: "Canvas",
          items: [
            {
              type: "AnnotationPage",
              items: [
                {
                  type: "Annotation",
                  motivation: "painting",
                  body: {
                    id: "x",
                    type: "Image",
                    format: "text/<script>SECRET",
                  },
                },
              ],
            },
          ],
          annotations: [
            {
              type: "AnnotationPage",
              items: [
                {
                  type: "Annotation",
                  motivation: ["SECRET-motivation", "commenting"],
                  body: { type: "TextualBody", value: "SECRET" },
                },
              ],
            },
          ],
        },
      ],
    };
    const structure = structureOf(words)!;
    expect(JSON.stringify(structure)).not.toMatch(/SECRET|<script/i);
    expect(structure).toMatchObject({
      behavior: ["paged"],
      formats: [],
      annotations: { motivations: ["commenting"] },
    });
  });

  it("reads so much of a large resource, counting the rest", () => {
    const many = LIMITS.containers + 5;
    const structure = structureOf({
      type: "Manifest",
      items: Array.from({ length: many }, (_, at) => ({
        id: `c${at}`,
        type: "Canvas",
      })),
    })!;
    expect(structure.containers.Canvas).toBe(many);
    expect(structure.truncated).toBe(true);
  });

  it("reads nothing from JSON that is not a resource Clover shows", () => {
    expect(structureOf({ type: "Annotation" })).toBeUndefined();
    expect(structureOf([])).toBeUndefined();
    expect(structureOf("Manifest")).toBeUndefined();
  });
});

describe("mediaType", () => {
  it("keeps a media type's shape, and nothing else", () => {
    expect(mediaType("Image/JPEG; charset=x")).toBe("image/jpeg");
    expect(mediaType("application/x-mpegurl")).toBe("application/x-mpegurl");
    expect(mediaType("text/<script>")).toBeUndefined();
    expect(mediaType(42)).toBeUndefined();
  });
});
