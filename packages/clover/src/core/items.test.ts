import bookJson from "../fixtures/iiif-cookbook/0009-book-1.json";
import audioJson from "../fixtures/iiif-cookbook/0002-mvm-audio.json";
import { p4 } from "../fixtures/presentation4";
import { itemsOfCollection, itemsOfManifest } from "./items";

describe("items", () => {
  it("makes one item per view, a spread named by its pages", () => {
    const items = itemsOfManifest(p4(bookJson));
    expect(items.map((item) => item.parts.length)).toEqual([1, 2, 2]);
    expect(items[1].label).toEqual({ none: ["Frontispiece – Title page"] });
    expect(items[1].id).toBe(bookJson.items[1].id);
  });

  it("is the same array for the same Manifest", () => {
    const manifest = p4(bookJson);
    expect(itemsOfManifest(manifest)).toBe(itemsOfManifest(manifest));
  });

  it("carries a duration and media type for sound", () => {
    const [item] = itemsOfManifest(p4(audioJson));
    expect(item.parts[0]).toMatchObject({ media: "Sound", duration: 1985.024 });
  });

  it("lists a Collection's members, linking to their homepage", () => {
    const items = itemsOfCollection({
      type: "Collection",
      id: "https://example.org/c",
      items: [
        {
          id: "https://example.org/m1",
          type: "Manifest",
          label: { en: ["One"] },
          homepage: [{ id: "https://example.org/one", type: "Text" }],
        },
        {
          id: "https://example.org/m2",
          type: "Manifest",
          label: { en: ["Two"] },
        },
      ],
    } as any);
    expect(items.map((item) => item.href)).toEqual([
      "https://example.org/one",
      "https://example.org/m2",
    ]);
  });
});
