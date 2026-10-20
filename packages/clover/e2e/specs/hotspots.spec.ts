import { type Locator, type Page, expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * Annotation hotspots on a landscape Canvas, as a reader meets them: in the order given,
 * nested, under the controls, and near the stage's edges.
 */
const MANIFEST = "https://fixtures.test/hotspots.json";
const CANVAS = "https://fixtures.test/hotspots/canvas/1";
const SERVICE = "https://images.test/iiif/hotspots/1";

type Note = [text: string, fragment: string];

/** The annotations, in the order given: what Tab and a screen reader follow. */
const NOTES: Note[] = [
  ["Line one", "xywh=300,300,800,60"],
  ["A word in line one", "xywh=320,310,120,40"],
  // Wholly under the cluster's second control, at home on a desktop.
  ["Under the controls", "xywh=1800,70,70,55"],
  [
    "Near the right edge, with a longer note than fits on one line",
    "xywh=1900,500,90,40",
  ],
  ["Near the bottom", "xywh=600,920,200,50"],
];

/** A Manifest of one Canvas, with `notes` on it, and anything more the Canvas says. */
const manifestOf = (notes: Note[], more: Record<string, unknown> = {}) => ({
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: MANIFEST,
  type: "Manifest",
  label: { en: ["Hotspots"] },
  items: [
    {
      id: CANVAS,
      type: "Canvas",
      label: { en: ["A wide page"] },
      width: 2000,
      height: 1000,
      ...more,
      items: [
        {
          id: `${CANVAS}/page`,
          type: "AnnotationPage",
          items: [
            {
              id: `${CANVAS}/page/image`,
              type: "Annotation",
              motivation: "painting",
              body: {
                id: `${SERVICE}/full/max/0/default.jpg`,
                type: "Image",
                format: "image/jpeg",
                width: 2000,
                height: 1000,
                service: [
                  { id: SERVICE, type: "ImageService3", profile: "level1" },
                ],
              },
              target: CANVAS,
            },
          ],
        },
      ],
      annotations: [
        {
          id: `${CANVAS}/notes`,
          type: "AnnotationPage",
          items: notes.map(([value, fragment], index) => ({
            id: `${CANVAS}/notes/${index + 1}`,
            type: "Annotation",
            motivation: "commenting",
            body: { type: "TextualBody", value, language: "en" },
            target: `${CANVAS}#${fragment}`,
          })),
        },
      ],
    },
  ],
});

/** Shows `notes` on the page, served as the Manifest's annotations. */
async function load(page: Page, notes: Note[], more?: Record<string, unknown>) {
  await page.unroute(MANIFEST);
  await page.route(MANIFEST, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(manifestOf(notes, more)),
    }),
  );
  await page.goto(`/?scene=composed&content=${MANIFEST}`);
  const hotspots = page.locator("button.clover-canvas-annotation");
  await expect(hotspots).toHaveCount(notes.length);
  return hotspots;
}

async function open(
  page: Page,
  notes: Note[] = NOTES,
  more?: Record<string, unknown>,
) {
  await serveIIIF(page);
  return load(page, notes, more);
}

const hotspot = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

const tipOf = (locator: Locator) => locator.locator("> .clover-tip");

/**
 * Whether a popover can be seen. Dismissed, it is only faded out, so as not to move from
 * under a pointer resting on it, and Playwright counts that as visible.
 */
const seen = (tip: Locator) => () =>
  tip.evaluate((element) => {
    const style = getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility === "visible" &&
      Number(style.opacity) > 0
    );
  });

/** Waits for the camera to come to rest: the hotspot's box stops moving. */
async function settled(locator: Locator) {
  let last = "";
  await expect
    .poll(async () => {
      const box = JSON.stringify(await locator.boundingBox());
      const same = box === last;
      last = box;
      return same;
    })
    .toBe(true);
}

type Box = { x: number; y: number; width: number; height: number };

/** Whether `a` and `b` overlap, by more than the half pixel a pan may round to. */
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

/** Whether `inner` lies within `outer`, to the half pixel. */
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5 &&
  inner.y + inner.height <= outer.y + outer.height + 0.5;

const stageOf = async (page: Page) =>
  (await page.locator(".clover-canvas-overlays").boundingBox())!;

test.describe("Hotspots", () => {
  test("are reached by Tab in the order given, not by size (WCAG 2.4.3)", async ({
    page,
  }) => {
    await open(page);
    await page.getByTestId("clover-canvas-viewport").focus();
    for (const [name] of NOTES) {
      await page.keyboard.press("Tab");
      await expect(hotspot(page, name)).toBeFocused();
    }
  });

  /*
   * Under a control at home: the cluster's row along the top. The hotspot is placed under
   * a control as laid out, found through one covering the whole Canvas. On a phone the
   * row sits in the margin over this wide page at home, over none of it, so there is no
   * control to place it under; the clearing is the same there.
   */
  test("one reached by Tab under the controls is panned clear of them (WCAG 2.4.11)", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      isMobile,
      "on a phone the controls' row lies over the margin above this wide page at home",
    );
    await open(page, [["The page", "xywh=0,0,2000,1000"]]);
    const viewport = page.getByTestId("clover-canvas-viewport");
    const controls = page.locator(".clover-canvas-controls > *");
    // Once the chrome, shown by the focus, has come to rest.
    await viewport.focus();
    await settled(controls.first());
    const picture = (await hotspot(page, "The page").boundingBox())!;
    let over: Box | undefined;
    for (const control of await controls.all()) {
      const box = (await control.boundingBox())!;
      if (inside(box, picture)) {
        over = box;
        break;
      }
    }
    expect(over, "a control over the picture").toBeDefined();
    // A quarter in from each side of the control, in the Canvas's units.
    const world = (x: number, y: number) => [
      Math.round(((x - picture.x) * 2000) / picture.width),
      Math.round(((y - picture.y) * 1000) / picture.height),
    ];
    const [x0, y0] = world(
      over!.x + over!.width / 4,
      over!.y + over!.height / 4,
    );
    const [x1, y1] = world(
      over!.x + (over!.width * 3) / 4,
      over!.y + (over!.height * 3) / 4,
    );
    await load(page, [
      ["Line one", "xywh=300,300,800,60"],
      ["Under the controls", `xywh=${x0},${y0},${x1 - x0},${y1 - y0}`],
    ]);

    const under = hotspot(page, "Under the controls");
    const covered = () =>
      under.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return Array.from(
          document.querySelectorAll(".clover-canvas-controls > *"),
        ).some((control) => {
          const over = control.getBoundingClientRect();
          return (
            over.left <= box.left &&
            over.top <= box.top &&
            over.right >= box.right &&
            over.bottom >= box.bottom
          );
        });
      });
    await viewport.focus();
    await expect.poll(covered).toBe(true);

    for (let step = 0; step < 2; step++) await page.keyboard.press("Tab");
    await expect(under).toBeFocused();
    await settled(under);
    const box = (await under.boundingBox())!;
    for (const control of await controls.all())
      expect(overlaps(box, (await control.boundingBox())!)).toBe(false);
    expect(inside(box, await stageOf(page))).toBe(true);
  });

  // Not moved for chrome elsewhere on the stage: the open caption at its end, here.
  test("one reached by Tab clear of the chrome leaves the view where it is", async ({
    page,
  }) => {
    await open(
      page,
      [
        ["Left top", "xywh=100,100,200,60"],
        ["Left middle", "xywh=100,450,200,60"],
      ],
      { summary: { en: ["A wide page, with notes down its left."] } },
    );
    // From the keyboard: the chrome it is in shows for the focus.
    await page.getByRole("button", { name: "About" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".clover-canvas-caption")).toHaveAttribute(
      "data-open",
      "true",
    );
    await page.getByTestId("clover-canvas-viewport").focus();
    const chrome = page.locator(
      ".clover-canvas-caption, .clover-canvas-controls > *",
    );
    let clear = 0;
    for (const name of ["Left top", "Left middle"]) {
      const spot = hotspot(page, name);
      await settled(spot);
      const before = (await spot.boundingBox())!;
      // On a phone the caption, beside the cluster's column, covers the first.
      const covered = (
        await Promise.all(
          (await chrome.all()).map((piece) => piece.boundingBox()),
        )
      ).some((box) => box && overlaps(before, box));
      await page.keyboard.press("Tab");
      await expect(spot).toBeFocused();
      await settled(spot);
      if (covered) continue;
      clear++;
      expect(await spot.boundingBox(), name).toEqual(before);
    }
    expect(clear).toBeGreaterThan(0);
  });

  test("show their name in a popover that can be hovered and dismissed (WCAG 1.4.13)", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "needs a pointer that can rest");
    await open(page);
    const line = hotspot(page, "Line one");
    const tip = tipOf(line);
    await expect.poll(seen(tip)).toBe(false);

    const box = (await line.boundingBox())!;
    await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
    await expect.poll(seen(tip)).toBe(true);
    await expect(tip).toHaveText("Line one");

    // Onto the popover, across the gap: it stays, and so does the hotspot's ring.
    const over = (await tip.boundingBox())!;
    await page.mouse.move(over.x + over.width / 2, over.y - 1, { steps: 4 });
    await page.mouse.move(over.x + over.width / 2, over.y + over.height / 2, {
      steps: 4,
    });
    await expect.poll(seen(tip)).toBe(true);
    await expect(line).toHaveAttribute("data-active", "true");

    // Escape hides it, the pointer still on it, until the pointer comes back.
    await page.keyboard.press("Escape");
    await expect.poll(seen(tip)).toBe(false);
    await page.mouse.move(
      over.x + over.width / 2 + 4,
      over.y + over.height / 2,
    );
    await expect.poll(seen(tip)).toBe(false);
    await page.mouse.move(0, 0);
    await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
    await expect.poll(seen(tip)).toBe(true);
  });

  // What a dismissed popover covered is within reach: dismissing it is for that.
  test("let a click where a dismissed popover was reach the hotspot under it", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "needs a pointer that can rest");
    await open(page, [
      ["Line one", "xywh=200,300,900,50"],
      ["Line two", "xywh=200,355,900,50"],
      ["Line three", "xywh=200,410,900,50"],
    ]);
    const one = hotspot(page, "Line one");
    const two = hotspot(page, "Line two");
    const box = (await one.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(seen(tipOf(one))).toBe(true);
    const tip = (await tipOf(one).boundingBox())!;
    const below = (await two.boundingBox())!;
    expect(overlaps(tip, below), "its popover covers line two").toBe(true);
    // A point on the popover, over line two.
    const point = {
      x: tip.x + tip.width / 2,
      y:
        (Math.max(tip.y, below.y) +
          Math.min(tip.y + tip.height, below.y + below.height)) /
        2,
    };
    await page.mouse.move(point.x, tip.y - 1, { steps: 4 });
    await page.mouse.move(point.x, point.y, { steps: 4 });
    await expect(one).toHaveAttribute("data-active", "true");

    await page.keyboard.press("Escape");
    await expect.poll(seen(tipOf(one))).toBe(false);
    const hit = () =>
      page.evaluate(({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return element?.closest("button")?.getAttribute("aria-label") ?? null;
      }, point);
    await expect.poll(hit).toBe("Line two");
    await page.mouse.move(point.x + 2, point.y);
    await expect(two).toHaveAttribute("data-active", "true");
    await page.mouse.click(point.x + 2, point.y);
    await expect(two).toHaveAttribute("aria-current", "true");
    await expect(one).not.toHaveAttribute("aria-current");
  });

  test("show their popover on keyboard focus at once, and hide it on Escape", async ({
    page,
  }) => {
    await open(page);
    await page.getByTestId("clover-canvas-viewport").focus();
    await page.keyboard.press("Tab");
    const line = hotspot(page, "Line one");
    await expect(line).toBeFocused();
    await expect.poll(seen(tipOf(line))).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(seen(tipOf(line))).toBe(false);
    await expect(line).toBeFocused();
  });

  test("keep a hotspot inside another within reach of the pointer", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "needs a pointer that can rest");
    await open(page);
    const line = hotspot(page, "Line one");
    const word = hotspot(page, "A word in line one");
    const outer = (await line.boundingBox())!;
    await page.mouse.move(
      outer.x + outer.width - 10,
      outer.y + outer.height / 2,
    );
    await expect(line).toHaveAttribute("data-active", "true");
    // From inside the active line onto the word within it.
    const inner = (await word.boundingBox())!;
    await page.mouse.move(
      inner.x + inner.width / 2,
      inner.y + inner.height / 2,
      {
        steps: 8,
      },
    );
    await expect(word).toHaveAttribute("data-active", "true");
    await expect.poll(seen(tipOf(word))).toBe(true);
  });

  /*
   * Two on one region (a search hit on its word, a transcription and a translation): the
   * pointer gliding over them meets one, once, and its popover shows.
   */
  test("keep one of two on one region active under a moving pointer", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "needs a pointer that can rest");
    await open(page, [
      ["A tag", "xywh=600,300,400,200"],
      ["A comment", "xywh=600,300,400,200"],
    ]);
    const twins = page.locator("button.clover-canvas-annotation");
    await twins.evaluateAll((elements) => {
      (window as any).__entered = 0;
      for (const element of elements)
        element.addEventListener("mouseenter", () => {
          (window as any).__entered++;
        });
    });
    const box = (await hotspot(page, "A tag").boundingBox())!;
    const y = box.y + box.height / 4;
    await page.mouse.move(box.x - 20, y);
    await page.mouse.move(box.x + box.width - 10, y, { steps: 60 });
    expect(await page.evaluate(() => (window as any).__entered)).toBe(1);
    // The later of the two, on top.
    const comment = hotspot(page, "A comment");
    await expect(comment).toHaveAttribute("data-active", "true");
    await expect.poll(seen(tipOf(comment))).toBe(true);
  });

  /*
   * WCAG 1.4.10: at 320 CSS px a popover wraps, no wider than the stage, and stays inside
   * it, on the side of its hotspot with more room: below a hotspot in the top half, above
   * one in the bottom.
   */
  test("keep their popover inside a narrow stage", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page);
    const stage = await stageOf(page);
    await page.getByTestId("clover-canvas-viewport").focus();
    for (const [name] of NOTES) {
      await page.keyboard.press("Tab");
      const spot = hotspot(page, name);
      await expect(spot).toBeFocused();
      await settled(spot);
      const tip = tipOf(spot);
      await expect.poll(seen(tip)).toBe(true);
      const box = (await tip.boundingBox())!;
      expect(inside(box, stage), name).toBe(true);
      const own = (await spot.boundingBox())!;
      const above = own.y + own.height / 2 > stage.y + stage.height / 2;
      const room = above
        ? own.y - stage.y
        : stage.y + stage.height - (own.y + own.height);
      // Off the hotspot, where it fits there: what shows of it, inside its clear edge.
      if (box.height + 16 > room) continue;
      const edge = await tip.evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          top: parseFloat(style.borderTopWidth),
          bottom: parseFloat(style.borderBottomWidth),
        };
      });
      if (above)
        expect(box.y + box.height - edge.bottom, name).toBeLessThanOrEqual(
          own.y,
        );
      else
        expect(box.y + edge.top, name).toBeGreaterThanOrEqual(
          own.y + own.height,
        );
    }
  });

  /*
   * WCAG 1.4.10 at 400%: 1280 × 1024 is 320 × 256, a stage 154px tall. A long note fits
   * neither above its hotspot nor below, so it moves over it, inside the stage.
   */
  test("keep a long note inside a short stage", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 256 });
    const note =
      "A long note, as a cataloguer writes one: the plate was printed from a " +
      "copper plate in 1907, retouched by hand, and its caption, set below the " +
      "picture, was trimmed when the volume was rebound, so only its first line " +
      "survives here, in pencil, in a later hand that no one has yet identified.";
    await open(page, [[note, "xywh=900,450,200,100"]]);
    const stage = await stageOf(page);
    await page.getByTestId("clover-canvas-viewport").focus();
    await page.keyboard.press("Tab");
    const spot = hotspot(page, note);
    await expect(spot).toBeFocused();
    const tip = tipOf(spot);
    await expect.poll(seen(tip)).toBe(true);
    expect(inside((await tip.boundingBox())!, stage)).toBe(true);
  });

  /*
   * WCAG 1.4.10: a note taller than the whole stage is capped inside it and scrolls, by
   * the keys from its hotspot, by wheel over it; the pointer crosses onto it, and a press
   * on it leaves focus on its hotspot, as it is hidden from assistive technology.
   */
  test("scroll a note taller than the stage, inside it", async ({
    page,
    isMobile,
  }) => {
    await page.setViewportSize({ width: 320, height: 256 });
    const note = Array.from(
      { length: 6 },
      (_, n) =>
        `Line ${n + 1} of a long note: the plate was printed from a copper plate ` +
        "in 1907, retouched by hand, its caption trimmed when the volume was rebound.",
    ).join(" ");
    await open(page, [[note, "xywh=900,450,200,100"]]);
    const stage = await stageOf(page);
    await page.getByTestId("clover-canvas-viewport").focus();
    await page.keyboard.press("Tab");
    const spot = hotspot(page, note);
    await expect(spot).toBeFocused();
    const tip = tipOf(spot);
    await expect.poll(seen(tip)).toBe(true);
    expect(inside((await tip.boundingBox())!, stage)).toBe(true);
    const scroll = () =>
      tip.evaluate((node) => ({
        top: node.scrollTop,
        room: node.scrollHeight - node.clientHeight,
      }));
    expect((await scroll()).room).toBeGreaterThan(0);

    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => (await scroll()).top).toBeGreaterThan(0);
    await page.keyboard.press("End");
    await expect
      .poll(async () => {
        const { top, room } = await scroll();
        return room - top;
      })
      .toBeLessThan(1);
    await page.keyboard.press("Home");
    await expect.poll(async () => (await scroll()).top).toBe(0);
    await expect(spot).toBeFocused();
    if (isMobile) return;

    // The pointer, from the hotspot onto the note, keeps it; the wheel scrolls it there.
    const from = (await spot.boundingBox())!;
    const to = (await tip.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 8,
    });
    await page.mouse.wheel(0, 60);
    await expect.poll(async () => (await scroll()).top).toBeGreaterThan(0);
    expect(await seen(tip)()).toBe(true);
    await page.mouse.down();
    await page.mouse.up();
    await expect(spot).toBeFocused();
  });

  /*
   * A hotspot as tall as the stage, or a column nearly so: no side has room for its
   * popover, which moves over it, to its edge in sight, by hover and by focus.
   */
  test("keep the popover of one as tall as the stage inside it", async ({
    page,
    isMobile,
  }) => {
    const notes: Note[] = [
      ["The whole page", "xywh=0,0,2000,1000"],
      ["A tall column", "xywh=1500,20,200,950"],
    ];
    await open(page, notes);
    const stage = await stageOf(page);
    if (!isMobile) {
      // At home, where the page fills the stage's height.
      for (const [name, x] of [
        ["The whole page", 0.1],
        ["A tall column", 0.5],
      ] as const) {
        const spot = hotspot(page, name);
        const box = (await spot.boundingBox())!;
        await page.mouse.move(box.x + box.width * x, box.y + box.height / 3);
        await expect.poll(seen(tipOf(spot))).toBe(true);
        expect(inside((await tipOf(spot).boundingBox())!, stage), name).toBe(
          true,
        );
      }
      await page.mouse.move(0, 0);
    }
    await page.getByTestId("clover-canvas-viewport").focus();
    for (const [name] of notes) {
      await page.keyboard.press("Tab");
      const spot = hotspot(page, name);
      await expect(spot).toBeFocused();
      await settled(spot);
      await expect.poll(seen(tipOf(spot))).toBe(true);
      expect(inside((await tipOf(spot).boundingBox())!, stage), name).toBe(
        true,
      );
    }
  });

  // WCAG 1.4.11 (C40): two tones far enough apart that one keeps 3:1 on any picture.
  test("are outlined in two tones 9:1 apart, at rest and active", async ({
    page,
  }) => {
    await open(page);
    const line = hotspot(page, "Line one");
    const tones = () =>
      line.evaluate((element) => {
        const style = getComputedStyle(element);
        const colours = [
          style.borderTopColor,
          ...(style.boxShadow.match(/rgba?\([^)]+\)/g) ?? []),
          style.outlineColor,
        ];
        return {
          colours,
          outline: style.outlineStyle,
          fill: style.backgroundColor,
        };
      });
    const rest = await tones();
    // The border and the inset line.
    expect(ratio(rest.colours[0], rest.colours[1])).toBeGreaterThanOrEqual(9);

    await page.getByTestId("clover-canvas-viewport").focus();
    await page.keyboard.press("Tab");
    await expect(line).toBeFocused();
    const active = await tones();
    expect(active.outline).toBe("solid");
    // The light line inside, the dark edge outside, the accent between.
    expect(ratio(active.colours[0], active.colours[1])).toBeGreaterThanOrEqual(
      9,
    );
    // Nothing over what it marks; the picture round it dims a little instead.
    expect(alpha(active.fill)).toBe(0);
    expect(alpha(active.colours[2])).toBeGreaterThan(0);
  });

  /*
   * The picked one names itself without the pointer on it, until the reader lets it go:
   * by Escape (WCAG 2.1.1), or a click off every hotspot, which does nothing more. The
   * next click, with nothing picked, zooms as ever.
   */
  test("the picked one shows its name until Escape or a click off it lets it go", async ({
    page,
  }) => {
    await open(page, [["Fountain", "xywh=200,200,400,300"]]);
    const spot = hotspot(page, "Fountain");
    const viewport = page.getByTestId("clover-canvas-viewport");
    const pick = async () => {
      await spot.focus();
      await page.keyboard.press("Enter");
      await expect(spot).toHaveAttribute("aria-current", "true");
      // Focus moves on, and no pointer is over it: it is still the active one, named.
      await viewport.focus();
      await expect(spot).toHaveAttribute("data-active", "true");
      await expect.poll(seen(tipOf(spot))).toBe(true);
    };
    await pick();
    await page.keyboard.press("Escape");
    await expect(spot).not.toHaveAttribute("aria-current");
    await expect.poll(seen(tipOf(spot))).toBe(false);
    // Escape was the Canvas's: focus stays where it was.
    await expect(viewport).toBeFocused();

    await pick();
    await settled(spot);
    const width = () => spot.evaluate((element) => element.style.width);
    const before = await width();
    // A click on the stage's bare corner, off the hotspot.
    const box = (await viewport.boundingBox())!;
    const corner = { x: box.x + 8, y: box.y + box.height - 8 };
    await page.mouse.click(corner.x, corner.y);
    await expect(spot).not.toHaveAttribute("aria-current");
    await expect.poll(seen(tipOf(spot))).toBe(false);
    expect(await width()).toBe(before);
    // Nothing picked now: the next click zooms.
    await page.mouse.click(corner.x, corner.y);
    await expect.poll(width).not.toBe(before);
  });

  // A shared link's note (Digital Collections writes them): shown, picked and named.
  test("a content state's note shows on its Canvas, picked and named", async ({
    page,
  }) => {
    await serveIIIF(page);
    await page.route(MANIFEST, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(
          manifestOf([["Fountain", "xywh=200,200,400,300"]]),
        ),
      }),
    );
    const state = {
      id: "https://fixtures.test/state/1",
      type: "Annotation",
      motivation: ["contentState"],
      target: {
        type: "SpecificResource",
        source: {
          id: CANVAS,
          type: "Canvas",
          partOf: [{ id: MANIFEST, type: "Manifest" }],
        },
        selector: { type: "FragmentSelector", value: "xywh=1000,400,500,300" },
      },
      body: [{ type: "TextualBody", value: "Hospital", format: "text/plain" }],
    };
    const encoded = Buffer.from(
      encodeURIComponent(JSON.stringify(state)),
    ).toString("base64url");
    await page.goto(`/?scene=composed&content=${encoded}`);
    await expect(page.locator("button.clover-canvas-annotation")).toHaveCount(
      2,
    );
    const note = hotspot(page, "Hospital");
    await expect(note).toHaveAttribute("aria-current", "true");
    await expect.poll(seen(tipOf(note))).toBe(true);
  });

  // As a vector editor hides what a shape covers: the active one, crossed by no line.
  test("beneath the active one, another's lines stop where it lies", async ({
    page,
  }) => {
    await open(page, [
      ["Wide", "xywh=0,400,2000,200"],
      ["Tall", "xywh=900,0,200,1000"],
    ]);
    const masks = () =>
      page
        .locator("button.clover-canvas-annotation")
        .evaluateAll((spots) =>
          spots.map((spot) => getComputedStyle(spot).maskImage.slice(0, 4)),
        );
    expect(await masks()).toEqual(["none", "none"]);
    // The wide one active: the tall one, beneath it now, is masked where they cross.
    await hotspot(page, "Wide").focus();
    await expect.poll(masks).toEqual(["none", "url("]);
    await hotspot(page, "Tall").focus();
    await expect.poll(masks).toEqual(["url(", "none"]);
  });

  // Shadows are dropped in forced colours: two tones still at rest, and a ring active.
  test("keep two tones and a ring in forced colours", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "needs a pointer that can rest");
    await page.emulateMedia({ forcedColors: "active" });
    await open(page);
    const line = hotspot(page, "Line one");
    const edge = () =>
      line.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          border: [style.borderTopStyle, style.borderTopWidth],
          outline: [style.outlineStyle, style.outlineWidth],
          colours: [style.borderTopColor, style.outlineColor],
        };
      });
    const rest = await edge();
    expect(rest.border).toEqual(["solid", "1px"]);
    expect(rest.outline).toEqual(["solid", "1px"]);
    expect(ratio(rest.colours[0], rest.colours[1])).toBeGreaterThanOrEqual(4.5);
    const box = (await line.boundingBox())!;
    await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
    await expect(line).toHaveAttribute("data-active", "true");
    expect((await edge()).outline).toEqual(["solid", "2px"]);
  });
});

function luminance(colour: string) {
  const [r, g, b] = colour.match(/[\d.]+/g)!.map(Number);
  return [r, g, b]
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}

function ratio(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** A computed colour's alpha: 1 for `rgb()`, else its fourth number. */
function alpha(colour: string) {
  const numbers = colour.match(/[\d.]+/g)!.map(Number);
  return numbers.length > 3 ? numbers[3] : 1;
}
