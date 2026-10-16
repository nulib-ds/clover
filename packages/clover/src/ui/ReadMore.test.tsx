import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import { ReadMore } from "./ReadMore";
import { Summary } from "../components/Primitives/Primitives";
import { initCloverI18n } from "../i18n";

/* jsdom lays nothing out: each element is as tall as these say. */
function heights(scroll: number, client: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
    scroll,
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
    client,
  );
}

beforeEach(() => initCloverI18n({ lng: "en" }));
afterEach(() => vi.restoreAllMocks());

describe("ReadMore", () => {
  it("offers the rest of text cut short, and cuts it again", () => {
    heights(200, 100);
    render(
      <ReadMore>
        <p>A long note</p>
      </ReadMore>,
    );
    const text = screen.getByText("A long note");
    const more = screen.getByRole("button", { name: "Read more" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(more).toHaveAttribute("aria-controls", text.id);
    expect(text).toHaveAttribute("data-read-more", "");

    fireEvent.click(more);
    expect(text).toHaveAttribute("data-read-more", "open");
    const less = screen.getByRole("button", { name: "Read less" });
    expect(less).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(less);
    expect(screen.getByRole("button", { name: "Read more" })).toBeVisible();
  });

  it("marks its words, on their own, where the page's language is not Clover's", async () => {
    heights(200, 100);
    document.documentElement.lang = "fr";
    render(<Summary value={{ fr: ["Une longue note"] }} />);
    const more = screen.getByRole("button", { name: "Read more" });
    await waitFor(() => expect(more).toHaveAttribute("lang", "en"));
    expect(screen.getByText("Une longue note")).toHaveAttribute("lang", "fr");
  });

  it("offers nothing for text that fits", () => {
    heights(100, 100);
    render(
      <ReadMore>
        <p>A short note</p>
      </ReadMore>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("measures again when the page's styles change, as text spacing does", async () => {
    heights(100, 100);
    render(
      <ReadMore>
        <p>A note that fits, until spaced out</p>
      </ReadMore>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    // The box keeps its height; only the text inside it grows.
    heights(150, 100);
    const style = document.createElement("style");
    style.textContent = "* { line-height: 1.5 !important; }";
    document.head.append(style);
    expect(
      await screen.findByRole("button", { name: "Read more" }),
    ).toBeVisible();
    style.remove();
  });
});

describe("Summary", () => {
  it("is cut short with Read more, and renders nothing without a summary", () => {
    heights(200, 100);
    const { container, rerender } = render(
      <Summary value={{ en: ["A summary that runs on"] }} />,
    );
    expect(screen.getByText("A summary that runs on")).toHaveClass(
      "clover-summary",
    );
    expect(screen.getByRole("button", { name: "Read more" })).toBeVisible();

    rerender(<Summary value={{ en: [""] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
