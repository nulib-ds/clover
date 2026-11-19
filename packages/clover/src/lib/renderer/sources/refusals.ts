/**
 * Hosts that refused a tile Clover joined or cut itself, a size their own grid does not
 * have (the Art Institute of Chicago's serves its 256 px grid and listed sizes, and answers
 * anything else 403, though its `info.json` promises any region at any size). From then
 * on, for the visit, their services are asked for their own grid.
 */
const refusing = new Set<string>();

/** A URL's origin, the host a refusal or a timing is kept by. */
export function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/**
 * A status that says the server will not make this size, as against a missing image
 * (404, 410) or a busy server (408, 429), which another size would not change.
 */
export function isSizeRefusal(status: number | undefined): boolean {
  return status === 400 || status === 403 || status === 413 || status === 414;
}

/** Remember that the host of `url` refuses tiles Clover joins or cuts. */
export function noteRefusal(url: string): void {
  refusing.add(originOf(url));
}

/** Whether the host of an image service refused a tile Clover joined or cut. */
export function refusesDerivedTiles(service: string): boolean {
  return refusing.has(originOf(service));
}

/** Whether a tile's address and a service share a host. */
export function sameHost(a: string | undefined, b: string): boolean {
  return a !== undefined && originOf(a) === originOf(b);
}

/** For tests: forget every refusal. */
export function resetRefusals(): void {
  refusing.clear();
}
