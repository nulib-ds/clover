/**
 * How each image server answers, timed as Clover's own requests come back, and whether a
 * server is quicker asked for its own grid of tiles than for the larger tiles Clover joins.
 *
 * Joined tiles cut a view's round trips, which wins wherever every request costs about
 * the same (Northwestern's, Princeton's). But a server that keeps what it has served
 * answers its own grid at once and renders a joined tile, an address nobody asked of it
 * before, from nothing (Yale's: 0.1 s against 0.7–4 s), and one that charges by the pixel
 * makes a joined tile as slow as the tiles in it together (Durham's). Neither can be read
 * from an `info.json`, so each host is timed: a small request (a whole image at a small
 * size, a tile of its grid) against a joined one, and asked for its grid where a joined
 * tile costs more than the grid tiles it saves would.
 *
 * Remembered for the visit, as refusals are (`refusals.ts`), so a host's next images
 * start on the tiles that suit it.
 */

import { originOf } from "./refusals";

interface Host {
  /** Requests on their way, and those of them that hold one of a browser's connections. */
  inFlight: number;
  sent: number;
  /** Requests waiting for a connection, each starting its clock as one frees. */
  waiting: Array<() => void>;
  /** Recent times of small and of large answers, in milliseconds. */
  small: number[];
  big: number[];
  /** The last answer given, and how often it changed: twice, and it holds. */
  grid?: boolean;
  changes: number;
}

/**
 * A browser sends a host six requests at a time over HTTP/1.1: a request past those waits
 * its turn, which is no cost of the server's, so its clock starts as one of them comes back.
 */
const CONNECTIONS = 6;
/** Answers kept a kind, the latest. */
const KEEP = 8;
/**
 * At most this many pixels is a small answer; at least this many, a large one, and only a
 * tile: a server that keeps what it has served sends a whole image at once, being asked
 * for its listed sizes by every viewer, which says nothing of a tile it has to render.
 */
const SMALL = 300_000;
const BIG = 600_000;
/**
 * A joined tile answered faster than this is fast whatever the grid's: no reason to ask
 * for more of them (and times this small, a browser's cache among them, are noise).
 */
const SLOW = 250;

const hosts = new Map<string, Host>();

function hostOf(url: string): Host {
  const origin = originOf(url);
  let host = hosts.get(origin);
  if (!host) {
    host = {
      inFlight: 0,
      sent: 0,
      waiting: [],
      small: [],
      big: [],
      changes: 0,
    };
    hosts.set(origin, host);
  }
  return host;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Time a request to `url`: call what it returns with the answer's pixels once it is in,
 * or with nothing when it failed or was given up.
 */
export function timeLoad(
  url: string,
  now: () => number = () => performance.now(),
): (pixels?: number) => void {
  const host = hostOf(url);
  let started: number | undefined;
  const send = () => {
    host.sent++;
    started = now();
  };
  host.inFlight++;
  if (host.sent < CONNECTIONS) send();
  else host.waiting.push(send);
  let done = false;
  return (pixels) => {
    if (done) return;
    done = true;
    host.inFlight--;
    if (started === undefined) {
      // Given up before it had a connection.
      host.waiting.splice(host.waiting.indexOf(send), 1);
      return;
    }
    host.sent--;
    host.waiting.shift()?.();
    if (pixels === undefined) return;
    const kind =
      pixels <= SMALL
        ? host.small
        : pixels >= BIG && !url.includes("/full/")
          ? host.big
          : undefined;
    if (!kind) return;
    kind.push(now() - started);
    if (kind.length > KEEP) kind.shift();
  };
}

/**
 * Whether a service's host answers its own grid fast enough to ask for it rather than
 * tiles joined `join` a side: undefined until it has answered two of each, small and
 * large. A joined tile saves `join²` requests, which a browser sends six at a time, so
 * the grid wins once a large answer costs more than `join² / 2` small ones (2.5 at least),
 * and more than `SLOW` itself.
 */
export function prefersGrid(
  service: string,
  join: number,
): boolean | undefined {
  const host = hosts.get(originOf(service));
  if (!host || host.small.length < 2 || host.big.length < 2) return host?.grid;
  const big = median(host.big);
  const grid =
    big > SLOW && big > Math.max(2.5, (join * join) / 2) * median(host.small);
  if (host.grid !== undefined && grid !== host.grid) {
    if (host.changes >= 2) return host.grid;
    host.changes++;
  }
  host.grid = grid;
  return grid;
}

/** Whether nothing is on its way from a service's host, so its tiles can change form. */
export function hostIdle(service: string): boolean {
  return (hosts.get(originOf(service))?.inFlight ?? 0) === 0;
}

/** For tests: forget every host. */
export function resetHosts(): void {
  hosts.clear();
}
