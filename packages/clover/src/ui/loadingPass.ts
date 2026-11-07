/**
 * The loading mark's one pass (`Loading.tsx`, `Loading.css`; Mat, 2026-11-06: "it should
 * move once ... get close to the end ... continue moving slower and then finish", "once
 * done zip it across and show").
 *
 * Every mark shown in one Body while what it draws loads (the Root's Manifest, a part's
 * code, a Canvas's tiles) continues one pass, begun by the first, rather than starting
 * again: each is given how long the pass has run (`--clover-loading-elapsed`), which its
 * animation takes off its delay. A Body drawn afresh (a Viewer given another resource
 * remounts its parts) takes over a pass whose Body has left the page; one still on the
 * page never lends its pass. The last mark to go, once shown, is left in its place a
 * moment (`HANDOVER`) for a mark that takes over, then held where it is and marked done
 * (`data-done`), which `Loading.css` runs to the end and fades.
 */

/** As `Loading.css` waits before a mark shows. */
const SHOW_AFTER = 250;
/**
 * How long a mark gone waits for another in its Body to take the pass over: a Root's
 * mark and its Canvas's hand over within a commit or the next (8 ms apart, measured
 * 2026-11-06), so this only holds back the run home a moment.
 */
const HANDOVER = 100;
/** As `Loading.css` runs a mark done to the end (180 ms), then fades it (150 ms). */
const FINISH = 330;

interface Pass {
  start: number;
  /** Its marks now showing. */
  marks: number;
  /** The last mark gone, left in its place while another may take over. */
  ghost?: HTMLElement;
  timer?: ReturnType<typeof setTimeout>;
}

const passes = new WeakMap<Element, Pass>();
let lastEnded: { start: number; at: number; host: Element } | undefined;

const elapse = (mark: HTMLElement, ms: number) =>
  mark.style.setProperty("--clover-loading-elapsed", `${Math.round(ms)}ms`);

/** A mark shown: it joins its Body's pass, or begins one. Returns its leaving. */
export function enterPass(mark: HTMLElement): () => void {
  const host = mark.closest(".clover-body") ?? mark.parentElement;
  const parent = mark.parentElement;
  if (!host || !parent) return () => undefined;
  const now = performance.now();
  let pass = passes.get(host);
  if (!pass) {
    const last = lastEnded;
    const handed =
      last &&
      now >= last.at &&
      now - last.at < HANDOVER &&
      !last.host.isConnected;
    pass = { start: handed ? last.start : now, marks: 0 };
    if (handed) lastEnded = undefined;
    passes.set(host, pass);
  }
  // Taking over from a mark just gone: the pass goes on from where it was.
  clearTimeout(pass.timer);
  pass.ghost?.remove();
  pass.ghost = undefined;
  pass.marks++;
  elapse(mark, now - pass.start);
  const joined = pass;
  return () => {
    if (--joined.marks) return;
    const at = performance.now();
    const elapsed = at - joined.start;
    lastEnded = { start: joined.start, at, host };
    // Never shown (a quick load), or not running (no styles), nothing is left; the pass
    // still goes on to the next.
    const line = mark.firstElementChild;
    const ghost =
      elapsed >= SHOW_AFTER &&
      parent.isConnected &&
      line &&
      getComputedStyle(line).animationName.startsWith("clover-loading")
        ? (mark.cloneNode(true) as HTMLElement)
        : undefined;
    if (ghost) {
      elapse(ghost, elapsed);
      parent.appendChild(ghost);
    }
    joined.ghost = ghost;
    joined.timer = setTimeout(() => {
      passes.delete(host);
      if (!ghost) return;
      // Held where the pass has it, for the run home to start from.
      const line = ghost.firstElementChild as HTMLElement | null;
      if (line) line.style.transform = getComputedStyle(line).transform;
      ghost.dataset.done = "";
      setTimeout(() => ghost.remove(), FINISH);
    }, HANDOVER);
  };
}
