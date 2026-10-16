import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";

import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";

/*
 * Clover's strings are in its interface language, which a host can set apart from the
 * page's, and which follows the browser where Clover has no strings for the page's language
 * (WCAG 3.1.2). Each string in another language says so with
 * its own `lang`. The Root carries none: the host's content inside it, and IIIF text in
 * no language, keep the page's.
 */
beforeEach(() => {
  initCloverI18n({ lng: "en" });
});
afterEach(() => {
  document.documentElement.lang = "";
});

const rootOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(".clover-root")!;
const nameOf = (element: HTMLElement) =>
  document.getElementById(element.getAttribute("aria-labelledby") ?? "");

/** A part of the host's own: a IIIF value in its language, through Clover's hook. */
function HostValue({
  value,
}: {
  value: Parameters<typeof Clover.useLocalized>[0];
}) {
  const { text, lang } = Clover.useLocalized(value);
  return <p lang={lang}>{text}</p>;
}

describe("the Root's language", () => {
  it("marks nothing where the page is in Clover's language", async () => {
    document.documentElement.lang = "en-GB";
    const { container } = render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Label label={{ none: ["Plain"] }} />
        <Clover.Items layout="pager" />
      </Clover.Root>,
    );
    const pager = await screen.findByRole("navigation", { name: "Items" });
    expect(rootOf(container)).not.toHaveAttribute("lang");
    expect(screen.getByText("Plain")).not.toHaveAttribute("lang");
    expect(pager).toHaveAttribute("aria-label", "Items");
    expect(
      within(pager).getByRole("button", { name: "Next" }),
    ).not.toHaveAttribute("lang");
  });

  it("marks each of Clover's strings, not the Root, where the page's language differs", async () => {
    document.documentElement.lang = "en";
    const { container } = render(
      <div lang="fr">
        <Clover.Root iiifContent={bookJson}>
          <Clover.Label label={{ none: ["Sans titre"] }} />
          <Clover.Label label={{ de: ["Haus"] }} />
          <Clover.Label label={{ en: ["House"] }} />
          <Clover.Items layout="pager" />
          <button type="button">Après les vues</button>
          <HostValue value={{ none: ["Valeur"] }} />
        </Clover.Root>
      </div>,
    );
    const pager = await screen.findByRole("navigation", { name: "Items" });
    const next = within(pager).getByRole("button", { name: "Next" });
    await waitFor(() => expect(next).toHaveAttribute("lang", "en"));
    expect(rootOf(container)).not.toHaveAttribute("lang");
    // The nav's name is English: a hidden element's, which says so.
    expect(pager).not.toHaveAttribute("lang");
    expect(pager).not.toHaveAttribute("aria-label");
    expect(nameOf(pager)).toHaveAttribute("lang", "en");
    // The host's own content, and text in none, keep the page's French.
    const french = container.firstElementChild;
    expect(
      screen.getByRole("button", { name: "Après les vues" }).closest("[lang]"),
    ).toBe(french);
    expect(screen.getByText("Valeur").closest("[lang]")).toBe(french);
    expect(screen.getByText("Sans titre").closest("[lang]")).toBe(french);
    expect(screen.getByText("Haus")).toHaveAttribute("lang", "de");
    expect(screen.getByText("House")).toHaveAttribute("lang", "en");
    // So does the Canvas's label in the announcement; its position is English.
    fireEvent.click(next);
    const announcer =
      container.querySelector<HTMLElement>(".clover-announcer")!;
    await waitFor(() =>
      expect(within(announcer).getByText(/^Item 2 of \d+$/)).toHaveAttribute(
        "lang",
        "en",
      ),
    );
    expect(within(announcer).getByText("Frontispiece")).toHaveAttribute(
      "lang",
      "en",
    );
  });

  it("follows the interface language when it changes", async () => {
    document.documentElement.lang = "fr";
    render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Items layout="pager" />
      </Clover.Root>,
    );
    const next = await screen.findByRole("button", { name: "Next" });
    await waitFor(() => expect(next).toHaveAttribute("lang", "en"));
    act(() => {
      initCloverI18n({ lng: "fr" });
    });
    const suivant = await screen.findByRole("button", { name: "Suivant" });
    expect(suivant).not.toHaveAttribute("lang");
    // French, as the page is: named by `aria-label`, with nothing to mark.
    expect(
      screen.getByRole("navigation", { name: "Éléments" }),
    ).toHaveAttribute("aria-label", "Éléments");
  });

  it("takes a lang the host gives it as the page's, and marks Clover's strings against it", async () => {
    document.documentElement.lang = "fr";
    const { container } = render(
      <Clover.Root iiifContent={bookJson} lang="de">
        <Clover.Label label={{ none: ["Ohne Titel"] }} />
        <Clover.Items layout="pager" />
      </Clover.Root>,
    );
    await screen.findByText("Ohne Titel");
    // The host's own attribute, which its content inside takes too.
    expect(rootOf(container)).toHaveAttribute("lang", "de");
    expect(screen.getByText("Ohne Titel")).not.toHaveAttribute("lang");
    expect(screen.getByRole("button", { name: "Next" })).toHaveAttribute(
      "lang",
      "en",
    );
    expect(screen.getByRole("button", { name: "Previous" })).toHaveAttribute(
      "lang",
      "en",
    );
  });

  it("reads the page's language once, at the outer Root, when one Root holds another", async () => {
    document.documentElement.lang = "fr";
    const { container } = render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Root iiifContent={bookJson} className="inner">
          <Clover.Items layout="pager" />
        </Clover.Root>
      </Clover.Root>,
    );
    const next = await screen.findByRole("button", { name: "Next" });
    await waitFor(() => expect(next).toHaveAttribute("lang", "en"));
    expect(rootOf(container)).not.toHaveAttribute("lang");
    expect(container.querySelector(".inner")).not.toHaveAttribute("lang");
  });

  it("marks a string that fell back to English, and names a container by it apart", async () => {
    document.documentElement.lang = "de";
    initCloverI18n({
      lng: "de",
      resources: { de: { clover: { commonNext: "Weiter" } } },
    });
    const { container } = render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Items layout="pager" />
      </Clover.Root>,
    );
    const pager = await screen.findByRole("navigation", { name: "Items" });
    expect(rootOf(container)).not.toHaveAttribute("lang");
    // German, as the page is: nothing to mark.
    expect(
      within(pager).getByRole("button", { name: "Weiter" }),
    ).not.toHaveAttribute("lang");
    expect(
      within(pager).getByRole("button", { name: "Previous" }),
    ).toHaveAttribute("lang", "en");
    // The nav's name is English, so it is a hidden element's, which says so.
    expect(pager).not.toHaveAttribute("lang");
    expect(pager).not.toHaveAttribute("aria-label");
    expect(nameOf(pager)).toHaveAttribute("lang", "en");
    expect(within(pager).getByText(/^Item 1 of \d+$/)).toHaveAttribute(
      "lang",
      "en",
    );
  });
});
