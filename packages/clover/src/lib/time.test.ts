import { formatTime, playFrom } from "./time";

describe("times", () => {
  it("goes to a time and plays from it, once, where it is paused", () => {
    const element = document.createElement("video");
    const play = vi
      .spyOn(element, "play")
      .mockImplementation(() => Promise.resolve());
    playFrom(element, 42);
    expect(element.currentTime).toBe(42);
    expect(play).toHaveBeenCalledTimes(1);
    // Playing already: only the time changes.
    vi.spyOn(element, "paused", "get").mockReturnValue(false);
    playFrom(element, 7);
    expect(element.currentTime).toBe(7);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("stays at the time, paused, where a browser will not play", async () => {
    const element = document.createElement("audio");
    vi.spyOn(element, "play").mockRejectedValue(new Error("NotAllowedError"));
    expect(() => playFrom(element, 3)).not.toThrow();
    expect(element.currentTime).toBe(3);
    await Promise.resolve();
  });
});

describe("formatTime", () => {
  it("counts from the whole second a time is in, as a player does", () => {
    expect(formatTime(12.7)).toBe("0:12");
    expect(formatTime(85.67)).toBe("1:25");
    expect(formatTime(3725)).toBe("1:02:05");
    expect(formatTime(-3)).toBe("0:00");
    expect(formatTime(NaN)).toBe("0:00");
  });
});
