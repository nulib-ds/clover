import { fitsRow } from "./RowFits";

describe("fitsRow", () => {
  it("fits controls, and the gaps between them, in the room", () => {
    // Three 36s and two gaps of 10: 128.
    expect(fitsRow([36, 36, 36], 128, 10)).toBe(true);
    expect(fitsRow([36, 36, 36], 127, 10)).toBe(false);
  });

  it("fits none in any room", () => {
    expect(fitsRow([], 0, 10)).toBe(true);
  });

  it("reads each control's own width", () => {
    expect(fitsRow([80, 36], 126, 10)).toBe(true);
    expect(fitsRow([80, 36], 125, 10)).toBe(false);
  });
});
