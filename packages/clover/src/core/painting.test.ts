import { itemsOfManifest } from "./items";
import { paintedBodies } from "./painted-bodies";
import { bodiesOf, isPainting } from "./painting";
import { stillSource } from "./thumbnail";

const image = (id: string) => ({
  id,
  type: "Image",
  format: "image/jpeg",
  width: 100,
  height: 80,
});

/** A Canvas painting `body` through one annotation, with these motivations. */
const canvas = (body: unknown, motivation: unknown = "painting") => ({
  id: "https://example.org/canvas",
  type: "Canvas",
  width: 100,
  height: 80,
  items: [
    {
      id: "https://example.org/page",
      type: "AnnotationPage",
      items: [
        {
          id: "https://example.org/annotation",
          type: "Annotation",
          motivation,
          body,
          target: "https://example.org/canvas",
        },
      ],
    },
  ],
});

describe("isPainting", () => {
  it("is `painting` among the motivations, or none said", () => {
    expect(isPainting({ motivation: "painting" })).toBe(true);
    expect(isPainting({ motivation: ["commenting", "painting"] })).toBe(true);
    expect(isPainting({})).toBe(true);
    expect(isPainting({ motivation: "supplementing" })).toBe(false);
  });
});

describe("bodiesOf", () => {
  it("unwraps Presentation 4's groups", () => {
    const a = image("https://example.org/a.jpg");
    const b = image("https://example.org/b.jpg");
    expect(bodiesOf({ body: { type: "Composite", items: [a, b] } })).toEqual([
      a,
      b,
    ]);
    expect(bodiesOf({ body: a })).toEqual([a]);
    expect(bodiesOf({})).toEqual([]);
  });
});

describe("paintedBodies", () => {
  it("reads a Choice's first item, a SpecificResource's source and a group's items", () => {
    const a = image("https://example.org/a.jpg");
    const b = image("https://example.org/b.jpg");
    const bodies = (body: unknown) =>
      paintedBodies(canvas(body)).map(({ body }) => body);
    expect(bodies({ type: "Choice", items: [a, b] })).toEqual([a]);
    expect(bodies({ type: "SpecificResource", source: a })).toEqual([a]);
    expect(
      bodies({ type: "SpecificResource", source: "https://example.org/c" }),
    ).toEqual([{ id: "https://example.org/c" }]);
    expect(bodies({ type: "List", items: [a, b] })).toEqual([a, b]);
  });

  it("leaves out what is not painted", () => {
    expect(
      paintedBodies(
        canvas(image("https://example.org/a.jpg"), "supplementing"),
      ),
    ).toEqual([]);
  });
});

/*
 * What reads the painting reads it one way (DRY.md, A2): a Canvas painting its image
 * inside a group has that image as its still, and Items knows it for an image.
 */
describe("a Canvas painting its image inside a Presentation 4 group", () => {
  const grouped = canvas({
    type: "Composite",
    items: [image("https://example.org/a.jpg")],
  });

  it("has that image as its still", () => {
    expect(stillSource(grouped)).toMatchObject({
      src: "https://example.org/a.jpg",
    });
  });

  it("is an image to Items", () => {
    const [item] = itemsOfManifest({
      id: "https://example.org/manifest",
      type: "Manifest",
      items: [grouped],
    } as never);
    expect(item.parts[0].media).toBe("Image");
  });
});
