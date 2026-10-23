import modelJson from "../../fixtures/iiif-cookbook/0608-mvm-3d-v4.json";
import {
  type IIIFScene,
  isDrawable,
  sceneBackground,
  sceneModels,
} from "./models";

const recipe = modelJson.items[0] as unknown as IIIFScene;

/** A Scene painting one body, with whatever target and body it is given. */
const sceneOf = (
  body: unknown,
  target: unknown = "https://example.org/scene",
) =>
  ({
    id: "https://example.org/scene",
    type: "Scene",
    items: [
      {
        items: [
          {
            id: "https://example.org/scene/anno/1",
            type: "Annotation",
            motivation: ["painting"],
            body,
            target,
          },
        ],
      },
    ],
  }) as IIIFScene;

describe("sceneModels", () => {
  it("reads Cookbook 0608's one model, at the Scene's origin", () => {
    expect(sceneModels(recipe)).toEqual([
      {
        id: "https://iiif.io/api/cookbook/recipe/0608-mvm-3d/v4/scene/1/annotationPage/1/anno/1",
        src: "https://fixtures.iiif.io/3d/google/astronaut.glb",
        format: "model/gltf-binary",
        position: [0, 0, 0],
        transforms: [],
      },
    ]);
  });

  it("places a model at its target's PointSelector, after its transforms, in order", () => {
    const [model] = sceneModels(
      sceneOf(
        {
          type: "SpecificResource",
          source: {
            id: "https://example.org/pawn.glb",
            type: "Model",
            format: "model/gltf-binary",
          },
          transform: [
            { type: "ScaleTransform", x: 2, y: 2, z: 2 },
            { type: "RotateTransform", x: -90 },
            { type: "TranslateTransform", y: 0.5 },
            { type: "SkewTransform", x: 1 },
          ],
        },
        {
          type: "SpecificResource",
          source: { id: "https://example.org/scene", type: "Scene" },
          selector: [{ type: "PointSelector", x: 1, y: 0, z: -2.5 }],
        },
      ),
    );
    expect(model.position).toEqual([1, 0, -2.5]);
    expect(model.transforms).toEqual([
      { type: "scale", x: 2, y: 2, z: 2 },
      { type: "rotate", x: -90, y: 0, z: 0 },
      { type: "translate", x: 0, y: 0.5, z: 0 },
    ]);
  });

  it("paints a Choice's first model, and nothing that is not a model", () => {
    expect(
      sceneModels(
        sceneOf({
          type: "Choice",
          items: [
            { id: "https://example.org/high.glb", type: "Model" },
            { id: "https://example.org/low.glb", type: "Model" },
          ],
        }),
      ).map((model) => model.src),
    ).toEqual(["https://example.org/high.glb"]);
    expect(
      sceneModels(sceneOf({ type: "PerspectiveCamera", fieldOfView: 50 })),
    ).toEqual([]);
  });

  it("returns the same list for the same Scene", () => {
    expect(sceneModels(recipe)).toBe(sceneModels(recipe));
  });
});

describe("isDrawable", () => {
  it("draws glTF, binary or JSON, by format, else by extension", () => {
    expect(isDrawable({ src: "a", format: "model/gltf-binary" })).toBe(true);
    expect(isDrawable({ src: "a", format: "model/gltf+json" })).toBe(true);
    expect(isDrawable({ src: "a.glb", format: "model/obj" })).toBe(false);
    expect(isDrawable({ src: "https://example.org/a.gltf?v=2" })).toBe(true);
    expect(isDrawable({ src: "https://example.org/a.ply" })).toBe(false);
  });
});

describe("sceneBackground", () => {
  it("takes a color a page can draw, and nothing else", () => {
    expect(sceneBackground({ ...recipe, backgroundColor: "#99CCFF" })).toBe(
      "#99CCFF",
    );
    expect(sceneBackground({ ...recipe, backgroundColor: "red" })).toBe(
      undefined,
    );
    expect(sceneBackground(recipe)).toBe(undefined);
  });
});
