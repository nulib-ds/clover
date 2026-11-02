import { useRouter } from "docs/lib/router";
import { useEffect, useState } from "react";

/**
 * A mock under `public/mocks/`, from this site (so it works before the docs deploy, and
 * under any base path): null until mounted, where the address is known.
 */
export function useMock(path: string) {
  const { basePath } = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(new URL(`${basePath}/mocks/${path}`, location.origin).href);
  }, [basePath, path]);
  return url;
}

/** The published site's mocks, as the docs' examples write their addresses. */
const PUBLISHED_MOCKS = "https://clover.iiif.library.northwestern.edu/mocks/";

/**
 * An address as an example's code writes it, a published mock's fetched from the site the
 * page is on instead (`useMock`): the published site sends no CORS headers, so from
 * `npm run dev` or a preview its own address fails to fetch. Any other address is as
 * given; a mock's is null until mounted.
 */
export function useSiteMock(address: string): string | null;
export function useSiteMock(address?: string): string | null | undefined;
export function useSiteMock(address?: string) {
  const path = address?.startsWith(PUBLISHED_MOCKS)
    ? address.slice(PUBLISHED_MOCKS.length)
    : "";
  const mock = useMock(path);
  return path ? mock : address;
}
