import { readBodies } from "./annotation-bodies";
import { annotationName } from "./annotation-name";

const text = (value: string, language?: string, format?: string) => ({
  type: "TextualBody",
  value,
  ...(language ? { language } : {}),
  ...(format ? { format } : {}),
});
const annotation = (...body: unknown[]) => ({
  id: "https://example.org/annotation/1",
  type: "Annotation",
  motivation: ["commenting"],
  body,
  target: "https://example.org/canvas/1",
});

/*
 * The one name an annotation goes by, for its hotspot, the Canvas's menu and the
 * Annotations list alike (WCAG 3.2.4).
 */
describe("annotationName", () => {
  it("takes the first body in the language closest to the reader's", () => {
    const bodies = readBodies(
      annotation(
        text("Le pont", "fr"),
        text("The bridge", "en"),
        text("A second English note", "en"),
      ),
    );
    expect(annotationName(bodies, "en")).toEqual({
      text: "The bridge",
      lang: "en",
    });
    expect(annotationName(bodies, "fr")).toEqual({
      text: "Le pont",
      lang: "fr",
    });
  });

  it("reads HTML for its text and Markdown without its syntax", () => {
    expect(
      annotationName(
        readBodies(annotation(text("<p>Fish &amp; <b>chips</b></p>"))),
      ),
    ).toEqual({ text: "Fish & chips" });
    expect(
      annotationName(
        readBodies(
          annotation(
            text(
              "**Bold** and [a link](https://example.org)",
              undefined,
              "text/markdown",
            ),
          ),
        ),
      ),
    ).toEqual({ text: "Bold and a link" });
    // Declared plain, a "<" is text.
    expect(
      annotationName(
        readBodies(annotation(text("1 < 2", "none", "text/plain"))),
      ),
    ).toEqual({ text: "1 < 2" });
  });

  it("is an image's label where it has no text, else nothing", () => {
    expect(
      annotationName(
        readBodies(
          annotation({
            id: "https://example.org/image.jpg",
            type: "Image",
            label: { en: ["A drawing of the bridge"] },
          }),
        ),
      ),
    ).toEqual({ text: "A drawing of the bridge", lang: "en" });
    expect(annotationName(readBodies(annotation(text("   "))))).toEqual({});
  });
});
