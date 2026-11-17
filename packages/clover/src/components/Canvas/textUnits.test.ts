import {
  granularityOf,
  plainTextOf,
  readTextUnits,
  selectedText,
} from "./textUnits";
import type { CanvasAnnotation } from "./Annotations";
import lighthouse from "../../fixtures/internet-archive/to-the-lighthouse.json";
import lighthouseOcr from "../../fixtures/internet-archive/to-the-lighthouse-ocr.json";

const CANVAS = "https://example.org/canvas/1";
const at = (
  id: string,
  granularity: string | undefined,
  value: string,
  xywh: string,
  extra: Record<string, unknown> = {},
  motivation = "supplementing",
): CanvasAnnotation => ({
  annotation: {
    id,
    type: "Annotation",
    motivation,
    ...(granularity ? { textGranularity: granularity } : {}),
    body: { type: "TextualBody", value, format: "text/plain", ...extra },
    target: `${CANVAS}#xywh=${xywh}`,
  } as never,
  targetIndex: 0,
});
const place = (rect: { x: number; y: number; width: number; height: number }) =>
  rect;

describe("granularityOf", () => {
  it("reads paragraph, line and word, and no other", () => {
    expect(granularityOf({ textGranularity: "word" })).toBe("word");
    expect(granularityOf({ textGranularity: "line" })).toBe("line");
    expect(granularityOf({ textGranularity: "paragraph" })).toBe("paragraph");
    expect(granularityOf({ textGranularity: "glyph" })).toBeNull();
    expect(granularityOf({})).toBeNull();
  });

  it("reads the body's where the annotation gives none", () => {
    expect(
      granularityOf({ body: { type: "TextualBody", textGranularity: "line" } }),
    ).toBe("line");
  });
});

describe("plainTextOf", () => {
  it("makes HTML plain, and its white space one space", () => {
    expect(
      plainTextOf({
        body: {
          type: "TextualBody",
          value: "<p>Bicycle  <b>catalog</b><br>1896</p>",
          format: "text/html",
          language: "en",
        },
      }),
    ).toEqual({ text: "Bicycle catalog 1896", lang: "en" });
  });

  it("keeps plain text as written, markup and all", () => {
    expect(
      plainTextOf({
        body: { type: "TextualBody", value: "a <b> c", format: "text/plain" },
      }),
    ).toEqual({ text: "a <b> c" });
  });
});

describe("readTextUnits", () => {
  /*
   * The Internet Archive's OCR (Mat, 2026-11-16: "we can use this … as a fixture"): word
   * by word, `supplementing`, with no granularity said. Its first 45 words on page 40 of
   * its To the Lighthouse (Woolf, 1927), as fetched; the page's Canvas, as its Manifest
   * gives it.
   */
  it("trusts supplementing words on regions, strung on with a space", () => {
    const [canvas] = lighthouse.items;
    const units = readTextUnits(
      lighthouseOcr.items.map((annotation) => ({
        annotation: annotation as never,
        targetIndex: 0,
      })),
      (rect, target) => (target === canvas.id ? rect : null),
    );
    expect(units).toHaveLength(45);
    expect(units.every((unit) => unit.granularity === null)).toBe(true);
    const copied = units.map((unit) => unit.text).join(" ");
    expect(copied).not.toContain("\n");
    expect(copied).toMatch(
      /^Vv “And even if it isn’t fine tomorrow,” said Mrs\. Ramsay, raising her eyes /,
    );
  });

  it("takes those with a text granularity, or supplementing, on a region", () => {
    const units = readTextUnits(
      [
        at("a", "line", "First line", "0,0,100,10"),
        at("b", undefined, "A comment", "0,20,100,10", {}, "commenting"),
        at("d", undefined, "Supplementing", "0,60,100,10"),
        at("c", "line", "Timed", "0,40,100,10"),
      ].map((each) =>
        each.annotation.id === "c"
          ? {
              ...each,
              annotation: {
                ...each.annotation,
                target: `${CANVAS}#xywh=0,40,100,10&t=1,2`,
              } as never,
            }
          : each,
      ),
      place,
    );
    // Where the Canvas's text says its granularity, what says none is not drawn twice.
    expect(units.map((unit) => unit.id)).toEqual(["a"]);
    expect(
      readTextUnits([at("d", undefined, "Alone", "0,0,100,10")], place).map(
        (unit) => unit.id,
      ),
    ).toEqual(["d"]);
    expect(units[0].world).toEqual({ x: 0, y: 0, width: 100, height: 10 });
  });

  it("draws only the finest it has, so no text is taken twice", () => {
    const units = readTextUnits(
      [
        at("l1", "line", "The special features", "0,0,300,20"),
        at("w1", "word", "The", "0,0,50,20"),
        at("w2", "word", "special", "60,0,100,20"),
        at("w3", "word", "features", "170,0,130,20"),
      ],
      place,
    );
    expect(units.map((unit) => unit.text)).toEqual([
      "The",
      "special",
      "features",
    ]);
  });
});

describe("selectedText", () => {
  const make = (texts: string[]) => {
    const parent = document.createElement("div");
    const elements = texts.map((text, index) => {
      const element = document.createElement("span");
      element.textContent = text;
      parent.appendChild(element);
      return {
        element,
        unit: {
          id: String(index),
          text,
          granularity: "word" as const,
          world: { x: 0, y: 0, width: 1, height: 1 },
        },
      };
    });
    document.body.appendChild(parent);
    return { parent, elements };
  };

  it("copies what it covers, parts of its ends, a space between each", () => {
    const { parent, elements } = make(["The", "special", "features", "of"]);
    const range = document.createRange();
    range.setStart(elements[1].element.firstChild!, 3);
    range.setEnd(elements[3].element.firstChild!, 1);
    expect(selectedText(range, elements)).toBe("cial features o");
    parent.remove();
  });

  it("copies nothing where it covers none", () => {
    const { parent, elements } = make(["one"]);
    const outside = document.createElement("p");
    outside.textContent = "page";
    document.body.appendChild(outside);
    const range = document.createRange();
    range.selectNodeContents(outside);
    expect(selectedText(range, elements)).toBeNull();
    parent.remove();
    outside.remove();
  });
});
