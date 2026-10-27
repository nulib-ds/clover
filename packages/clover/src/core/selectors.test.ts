import { navigationOf } from "./clover";
import { partOfCollection, selectCanvas } from "./selectors";

const collection = {
  id: "https://example.org/collection",
  type: "Collection",
  label: { en: ["Masks"] },
};

describe("partOfCollection", () => {
  it("finds the Collection a Manifest is part of, given one or a list", () => {
    expect(partOfCollection({ partOf: [collection] })).toBe(collection);
    expect(partOfCollection({ partOf: collection })).toBe(collection);
    expect(
      partOfCollection({
        partOf: [{ id: "https://example.org/m", type: "Manifest" }, collection],
      }),
    ).toBe(collection);
  });

  it("is nothing for a Manifest part of none", () => {
    expect(partOfCollection({})).toBeUndefined();
    expect(partOfCollection(null)).toBeUndefined();
    expect(
      partOfCollection({
        partOf: { id: "https://example.org/m", type: "Manifest" },
      }),
    ).toBeUndefined();
  });
});

describe("selectCanvas", () => {
  const canvas = (id: string, label: string) => ({
    id,
    type: "Canvas",
    label: { none: [label] },
  });
  const manifest = {
    id: "https://example.org/manifest",
    type: "Manifest",
    items: [
      canvas("https://example.org/1", "One"),
      canvas("https://example.org/2", "Two"),
      // A Manifest that repeats an id: the first is the one, as a search would find it.
      canvas("https://example.org/1", "Again"),
    ],
  } as never;

  it("finds a Canvas by its id, the first of that id, and null for none", () => {
    expect(selectCanvas(manifest, "https://example.org/2")?.label).toEqual({
      none: ["Two"],
    });
    expect(selectCanvas(manifest, "https://example.org/1")?.label).toEqual({
      none: ["One"],
    });
    expect(selectCanvas(manifest, "https://example.org/3")).toBeNull();
    expect(selectCanvas(manifest, null)).toBeNull();
    expect(selectCanvas(null, "https://example.org/1")).toBeNull();
  });
});

describe("navigationOf", () => {
  it("says where the reader is, and moves through the Root", () => {
    const clover = {
      previous: vi.fn(),
      next: vi.fn(),
      first: vi.fn(),
      last: vi.fn(),
      goTo: vi.fn(),
    };
    const at = navigationOf(clover as never, 0, 3);
    expect(at).toMatchObject({
      position: 0,
      total: 3,
      hasPrevious: false,
      hasNext: true,
    });
    expect(navigationOf(clover as never, 2, 3).hasNext).toBe(false);
    at.next();
    at.goTo("https://example.org/2");
    expect(clover.next).toHaveBeenCalled();
    expect(clover.goTo).toHaveBeenCalledWith("https://example.org/2");
  });
});
