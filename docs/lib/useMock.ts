import { useRouter } from "next/router";
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
