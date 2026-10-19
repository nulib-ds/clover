/**
 * Clover's live WebGL contexts, page-wide. Browsers cap a page's contexts (about 16 on
 * desktop, 8 on Android) and, past the cap, kill the oldest, which Chrome then paints
 * with its picture of a lost context. Clover holds at most `MAX_CONTEXTS`, leaving the
 * rest to the page (a map, the host's own): past it, a newcomer takes the one out of
 * view longest, or, with every one in view, draws with Canvas2D.
 */

export interface ContextHolder {
  /** When it went out of view (`performance.now()`), or null while in view. */
  hiddenSince: number | null;
  /** Give the context back now. */
  release(): void;
}

export const MAX_CONTEXTS = 6;

const holders = new Set<ContextHolder>();

/** Whether `holder` may take a context, freeing one out of view to make room. */
export function claimContext(holder: ContextHolder): boolean {
  if (holders.has(holder)) return true;
  while (holders.size >= MAX_CONTEXTS) {
    let idle: ContextHolder | undefined;
    for (const each of holders) {
      if (
        each.hiddenSince !== null &&
        (!idle || each.hiddenSince < idle.hiddenSince!)
      ) {
        idle = each;
      }
    }
    if (!idle) return false;
    holders.delete(idle);
    idle.release();
  }
  holders.add(holder);
  return true;
}

export function returnContext(holder: ContextHolder): void {
  holders.delete(holder);
}
