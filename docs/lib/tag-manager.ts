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
