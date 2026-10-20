import { getManifestSequence } from "@iiif/helpers/sequences";
import { Vault } from "@iiif/helpers/vault";

import bookJson from "../fixtures/iiif-cookbook/0009-book-1.json";
import rtlJson from "../fixtures/iiif-cookbook/0010-book-2-viewing-direction-rtl.json";
import continuousJson from "../fixtures/iiif-cookbook/0011-book-3-behavior-continuous.json";
import individualsJson from "../fixtures/iiif-cookbook/0011-book-3-behavior-individuals.json";
import foldoutsJson from "../fixtures/iiif-cookbook/0035-foldouts.json";
import { p4 } from "../fixtures/presentation4";
import { selectSequence } from "./selectors";

/**
 * `groupViews` is Clover's only sequence implementation. It must agree with
 * `@iiif/helpers`' `getManifestSequence` (which needs a Vault, used here only) about what
 * a view is, on the Cookbook and on paged books with `facing-pages` and `non-paged`.
 */
function book(behaviors: Array<string[] | undefined>) {
  return {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: `https://example.org/book/${behaviors.map((b) => b?.join("+") ?? "-").join(",")}`,
    type: "Manifest",
    label: { none: ["Book"] },
    behavior: ["paged"],
    items: behaviors.map((behavior, index) => ({
      id: `https://example.org/book/canvas/${index}`,
      type: "Canvas",
      width: 100,
      height: 150,
      items: [],
      ...(behavior ? { behavior } : {}),
    })),
  };
}

const cases: Array<[string, Record<string, any>]> = [
  ["0009 paged", bookJson],
  ["0010 right-to-left", rtlJson],
  ["0011 continuous", continuousJson],
  ["0011 individuals", individualsJson],
  ["0035 foldouts (non-paged)", foldoutsJson],
  [
    "facing-pages",
    book([undefined, undefined, ["facing-pages"], undefined, undefined]),
  ],
  [
    "non-paged mid-book",
    book([
      undefined,
      undefined,
      undefined,
      ["non-paged"],
      undefined,
      undefined,
    ]),
  ],
];

describe("groupViews parity with getManifestSequence", () => {
  it.each(cases)("%s", (_, manifestJson) => {
    const ours = selectSequence(p4(structuredClone(manifestJson))).views;
    // The Vault normalizes in place, so it gets a copy of its own.
    const vault = new Vault();
    const manifest = vault.loadSync<any>(
      manifestJson.id,
      structuredClone(manifestJson),
    );
    const [, theirs] = getManifestSequence(vault as any, manifest);
    expect(ours).toEqual(theirs);
  });
});
