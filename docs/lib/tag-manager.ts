import { rootAddress } from "docs/lib/resource-content";

/** The public ID of a Tag Manager web container; an unset ID leaves it off. */
export function tagManagerId(value?: string) {
  const id = value?.trim();
  if (!id) return undefined;
  if (!/^GTM-[A-Z0-9]+$/.test(id))
    throw new Error("NEXT_PUBLIC_GTM_ID must be a Tag Manager ID (GTM-…).");
  return id;
}

/** Referrers without queries or fragments, which may name a reader's IIIF resource. */
export function pageReferrer(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

/** The homepage's explicit resource choices, separate from visits to the page. */
export function resourceOpen(content: string, siteUrl: string) {
  const address = rootAddress(content);
  if (!address) return undefined;
  const resource = new URL(address);
  resource.username = "";
  resource.password = "";
  resource.hash = "";
  const location = new URL(siteUrl);
  location.search = "";
  location.hash = "";
  location.searchParams.set("iiif-content", resource.href);
  return {
    // GA4 allows 1,000 characters for page_location, versus 100 for custom parameters.
    // Use this only on the resource event; the page-view URL stays free of queries.
    resource_location: location.href,
    resource_host: resource.hostname,
    resource_input: /^https?:/i.test(content) ? "url" : "content_state",
  };
}

export type CtaSection = "templates" | "components" | "why_clover" | "install";

/** Only the homepage's marked section links; hidden arrows are not part of the label. */
export function ctaClick(link: HTMLAnchorElement) {
  const section = link.dataset.ctaSection;
  if (
    !section ||
    !["templates", "components", "why_clover", "install"].includes(section)
  )
    return undefined;
  const destination = pageReferrer(link.href);
  if (!destination) return undefined;
  const label = link.cloneNode(true) as HTMLAnchorElement;
  label
    .querySelectorAll('[aria-hidden="true"]')
    .forEach((node) => node.remove());
  return {
    cta_section: section,
    cta_label: label.textContent?.replace(/\s+/g, " ").trim() ?? "",
    link_url: destination,
  };
}
