import audioJson from "../../fixtures/iiif-cookbook/0002-mvm-audio.json";
import { p4 } from "../../fixtures/presentation4";
import videoJson from "../../fixtures/iiif-cookbook/0003-mvm-video.json";
import canvasSizeJson from "../../fixtures/iiif-cookbook/0004-canvas-size.json";
import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import rtlJson from "../../fixtures/iiif-cookbook/0010-book-2-viewing-direction-rtl.json";
import ttbJson from "../../fixtures/iiif-cookbook/0010-book-2-viewing-direction-ttb.json";
import continuousJson from "../../fixtures/iiif-cookbook/0011-book-3-behavior-continuous.json";
import placeholderJson from "../../fixtures/iiif-cookbook/0013-placeholderCanvas.json";
import accompanyingJson from "../../fixtures/iiif-cookbook/0014-accompanyingcanvas.json";
import choiceJson from "../../fixtures/iiif-cookbook/0033-choice.json";
import compositionJson from "../../fixtures/iiif-cookbook/0036-composition-from-multiple-images.json";
import languagesJson from "../../fixtures/iiif-cookbook/0074-multiple-language-captions.json";
import captionsJson from "../../fixtures/iiif-cookbook/0219-using-caption-file.json";
import renderingJson from "../../fixtures/iiif-cookbook/0017-transcription-av.json";
import transcriptJson from "../../fixtures/iiif-cookbook/0253-using-transcript-file.json";
import {
  type IIIFCanvas,
  arrangeCanvases,
  canvasScene,
  canvasTextTranscripts,
  findChoices,
  paintedImages,
  resolveDirection,
} from "./layout";

// Published fixtures, upgraded to Presentation 4 as Clover holds them.
const audio = p4(audioJson);
const video = p4(videoJson);
const canvasSize = p4(canvasSizeJson);
const book = p4(bookJson);
const rtl = p4(rtlJson);
const ttb = p4(ttbJson);
const continuous = p4(continuousJson);
const placeholder = p4(placeholderJson);
const accompanying = p4(accompanyingJson);
const choice = p4(choiceJson);
const composition = p4(compositionJson);
const languages = p4(languagesJson);
const captions = p4(captionsJson);

const items = (manifest: { items: unknown[] }) =>
  manifest.items as IIIFCanvas[];

describe("resolveDirection", () => {
  it("defaults to left-to-right", () => {
    expect(resolveDirection("right-to-left")).toBe("right-to-left");
    expect(resolveDirection("sideways")).toBe("left-to-right");
  });
});

describe("arrangeCanvases", () => {
  it("puts a left-to-right spread's first page on the left, heights matched", () => {
    const [left, right] = arrangeCanvases(
      items(book).slice(1, 3),
      "left-to-right",
    );
    expect(left.x).toBe(0);
    expect(right.x).toBeCloseTo(left.width);
    expect(right.height).toBe(left.height);
  });

  it("puts a right-to-left spread's first page on the right (0010)", () => {
    const [first, second] = arrangeCanvases(
      items(rtl).slice(1, 3),
      "right-to-left",
    );
    expect(second.x).toBe(0);
    expect(first.x).toBeCloseTo(second.width);
  });

  it("stacks top-to-bottom, widths matched (0010)", () => {
    const canvases = items(ttb);
    const placed = arrangeCanvases(canvases, "top-to-bottom");
    expect(placed[0].y).toBe(0);
    expect(placed[1].y).toBeCloseTo(placed[0].height);
    expect(placed[3].width).toBe(canvases[0].width);
  });

  it("stacks bottom-to-top with the first Canvas at the bottom", () => {
    const placed = arrangeCanvases(items(ttb).slice(0, 2), "bottom-to-top");
    expect(placed[1].y).toBe(0);
    expect(placed[0].y).toBeCloseTo(placed[1].height);
  });

  it("joins several Canvases edge to edge at a common height (0011)", () => {
    const canvases = items(continuous);
    const rects = arrangeCanvases(canvases, "left-to-right");
    rects.forEach((rect) =>
      expect(rect.height).toBeCloseTo(canvases[0].height!),
    );
    for (let i = 1; i < 4; i++) {
      expect(rects[i].x).toBeCloseTo(rects[i - 1].x + rects[i - 1].width);
    }
  });
});

describe("paintedImages", () => {
  it("places a second image on part of the Canvas (0036)", () => {
    const [page, inset] = paintedImages(items(composition)[0]);
    expect(page.target).toEqual({ x: 0, y: 0, width: 7216, height: 5412 });
    expect(inset.target).toEqual({
      x: 3949,
      y: 994,
      width: 1091,
      height: 1232,
    });
    expect(inset.body.width).toBe(2138);
  });

  it("lists a Choice's items, and paints the one selected (0033)", () => {
    const canvases = items(choice);
    const [group] = findChoices(canvases);
    expect(group.items.map((item) => item.label)).toEqual([
      { en: ["Natural Light"] },
      { en: ["X-Ray"] },
    ]);
    const [xray] = paintedImages(canvases[0], { [group.key]: 1 });
    expect(xray.body.label).toEqual({ en: ["X-Ray"] });
  });

  it("finds no Choice where a Canvas has none", () => {
    expect(findChoices(items(book))).toEqual([]);
  });

  it("paints the first item of a Choice by default (0033)", () => {
    const [image] = paintedImages(items(choice)[0]);
    expect(image.body.label).toEqual({ en: ["Natural Light"] });
  });

  it("stretches an image across a Canvas larger than it (0004)", () => {
    const canvas = items(canvasSize)[0];
    const { images } = canvasScene([canvas], "left-to-right");
    expect(images).toHaveLength(1);
    // A 640×360 image, placed over the whole 1920×1080 Canvas.
    expect(images[0].width).toBe(640);
    expect(images[0].placement).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
  });

  it("crops a SpecificResource to its Image API region", () => {
    const canvas: IIIFCanvas = {
      id: "c",
      width: 1000,
      height: 1000,
      items: [
        {
          items: [
            {
              motivation: "painting",
              body: {
                type: "SpecificResource",
                source: { id: "https://example.org/i.jpg", type: "Image" },
                selector: { type: "ImageApiSelector", region: "0,0,500,500" },
              },
              target: "c",
            },
          ],
        },
      ],
    };
    expect(paintedImages(canvas)[0].region).toBe("0,0,500,500");
  });

  it("skips bodies that are not images", () => {
    const canvas: IIIFCanvas = {
      id: "c",
      width: 10,
      height: 10,
      items: [
        {
          items: [
            { motivation: "painting", body: { type: "Video", id: "v" } },
            { motivation: "supplementing", body: { type: "Image", id: "i" } },
          ],
        },
      ],
    };
    expect(paintedImages(canvas)).toEqual([]);
  });
});

describe("canvasScene", () => {
  it("places every image of every Canvas in a spread, tiled from its service", () => {
    const { images } = canvasScene(items(book).slice(1, 3), "left-to-right");
    expect(images).toHaveLength(2);
    expect(images.every((image) => image.service)).toBe(true);
    expect(images[1].placement!.x).toBeCloseTo(images[0].placement!.width);
  });

  it("composes an inset inside its Canvas's placement (0036)", () => {
    const { images } = canvasScene(items(composition), "left-to-right");
    expect(images[1].placement).toEqual({
      x: 3949,
      y: 994,
      width: 1091,
      height: 1232,
    });
  });
});

describe("canvasScene media", () => {
  it("places a Canvas's video over the Canvas, with its declared duration", () => {
    const { images, media, placements } = canvasScene(
      items(video),
      "left-to-right",
    );
    expect(images).toEqual([]);
    expect(placements).toEqual([{ x: 0, y: 0, width: 480, height: 360 }]);
    expect(media).toEqual([
      expect.objectContaining({
        kind: "video",
        src: "https://fixtures.iiif.io/video/indiana/lunchroom_manners/high/lunchroom_manners_1024kb.mp4",
        format: "video/mp4",
        placement: { x: 0, y: 0, width: 480, height: 360 },
        duration: 572.034,
        captions: [],
      }),
    ]);
  });

  it("gives sound with no picture a 16:9 stage of its own", () => {
    const { images, media, placements } = canvasScene(
      items(audio),
      "left-to-right",
    );
    expect(images).toEqual([]);
    expect(placements).toEqual([{ x: 0, y: 0, width: 1600, height: 900 }]);
    expect(media[0]).toMatchObject({ kind: "audio", duration: 1985.024 });
  });

  it("shows sound's accompanying Canvas, sized as that Canvas", () => {
    const { images, media, placements } = canvasScene(
      items(accompanying),
      "left-to-right",
    );
    expect(placements).toEqual([{ x: 0, y: 0, width: 772, height: 998 }]);
    expect(images).toHaveLength(1);
    expect(images[0].placement).toEqual(placements[0]);
    expect(media[0].kind).toBe("audio");
  });

  it("takes a video's poster from its placeholder Canvas", () => {
    const { media } = canvasScene(items(placeholder), "left-to-right");
    expect(media[0].poster).toBe(
      "https://fixtures.iiif.io/video/indiana/donizetti-elixir/act1-thumbnail.png",
    );
  });

  it("offers each supplementing WebVTT file as a caption track", () => {
    expect(
      canvasScene(items(captions), "left-to-right").media[0].captions,
    ).toEqual([
      {
        id: "https://fixtures.iiif.io/video/indiana/lunchroom_manners/lunchroom_manners.vtt",
        label: { en: ["Captions in WebVTT format"] },
        language: "en",
      },
    ]);
    expect(
      canvasScene(items(languages), "left-to-right").media[0].captions.map(
        (track) => track.language,
      ),
    ).toEqual(["en", "it"]);
  });
});

describe("canvasTextTranscripts", () => {
  it("finds a time-based Canvas's plain-text transcript in its rendering (Cookbook 0017)", () => {
    const [canvas] = p4(renderingJson).items;
    expect(canvasTextTranscripts(canvas)).toEqual([
      {
        id: "https://fixtures.iiif.io/video/indiana/volleyball/volleyball.txt",
        label: { en: ["Transcript"] },
        language: undefined,
      },
    ]);
  });

  it("finds one a supplementing annotation provides, with its language (Cookbook 0253, Presentation 4)", () => {
    const [canvas] = p4(transcriptJson).items;
    expect(canvasTextTranscripts(canvas)).toEqual([
      {
        id: "https://fixtures.iiif.io/video/indiana/lunchroom_manners/lunchroom_manners.txt",
        label: { en: ["Transcript in plain text format"] },
        language: "en",
      },
    ]);
  });

  it("takes no captions, and no plain text of a Canvas that is not time-based", () => {
    const [captioned] = p4(captionsJson).items;
    expect(canvasTextTranscripts(captioned)).toEqual([]);
    const page = {
      id: "https://example.org/canvas/1",
      width: 100,
      height: 100,
      rendering: [
        {
          id: "https://example.org/page-1.txt",
          type: "Text",
          format: "text/plain",
        },
      ],
    };
    expect(canvasTextTranscripts(page)).toEqual([]);
  });
});
