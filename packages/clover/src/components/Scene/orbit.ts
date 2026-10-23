/**
 * The Scene's camera, as the reader moves it: on a sphere round the models' center,
 * turned about the up axis (`theta`), tilted from it (`phi`), at a `distance`. Pure, so
 * every way of moving it (a drag, a pinch, a key, a control) goes through the same steps,
 * each clamped the same way.
 *
 * Home looks at the models from the front (`+z`, toward `-z`, where a Scene's default
 * camera looks and glTF models face), a little from above, at a distance that fits their
 * bounding sphere in the view.
 */

export interface Orbit {
  /** Radians about the up axis (`y`): 0 is the front, `+z`. */
  theta: number;
  /** Radians from the up axis: 0 looks straight down, π straight up. */
  phi: number;
  /** From the center, in the Scene's units. */
  distance: number;
}

/** The models' bounding sphere, which the camera turns round and frames. */
export interface Bounds {
  center: [number, number, number];
  radius: number;
}

/** The camera's vertical field of view, in degrees. */
export const FIELD_OF_VIEW = 45;
/** Home's tilt: a little above the models. */
const HOME_PHI = (75 * Math.PI) / 180;
/** Never quite straight down or up, where turning about the up axis would spin the view. */
const MIN_PHI = (5 * Math.PI) / 180;
const MAX_PHI = Math.PI - MIN_PHI;
/** Room left round the models at home. */
const MARGIN = 1.1;
/** How near the camera comes, and how far it goes, as multiples of home's distance. */
const NEAREST = 0.35;
const FARTHEST = 4;

/** The distance at which a sphere of `radius` fits a view of this `aspect` (width / height). */
export function fitDistance(radius: number, aspect = 1): number {
  const vertical = (FIELD_OF_VIEW * Math.PI) / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
  const narrowest = Math.min(vertical, horizontal);
  return (Math.max(radius, 1e-6) / Math.sin(narrowest / 2)) * MARGIN;
}

/** Where the camera starts, and goes back to on Reset. */
export function homeOrbit(bounds: Bounds, aspect = 1): Orbit {
  return {
    theta: 0,
    phi: HOME_PHI,
    distance: fitDistance(bounds.radius, aspect),
  };
}

/** Turned about the up axis by `dTheta` and tilted by `dPhi`, radians. */
export function turned(orbit: Orbit, dTheta: number, dPhi: number): Orbit {
  return {
    ...orbit,
    theta: orbit.theta + dTheta,
    phi: Math.min(MAX_PHI, Math.max(MIN_PHI, orbit.phi + dPhi)),
  };
}

/** Nearer by `factor` (over 1 comes in), within reach of home's distance. */
export function zoomed(orbit: Orbit, factor: number, home: Orbit): Orbit {
  const distance = orbit.distance / factor;
  return {
    ...orbit,
    distance: Math.min(
      home.distance * FARTHEST,
      Math.max(home.distance * NEAREST, distance),
    ),
  };
}

/** The camera's position for an orbit round `center`. */
export function cameraPosition(
  orbit: Orbit,
  center: [number, number, number],
): [number, number, number] {
  const { theta, phi, distance } = orbit;
  return [
    center[0] + distance * Math.sin(phi) * Math.sin(theta),
    center[1] + distance * Math.cos(phi),
    center[2] + distance * Math.sin(phi) * Math.cos(theta),
  ];
}

/** Whether two orbits put the camera in the same place, as far as anyone could see. */
export function sameOrbit(a: Orbit, b: Orbit): boolean {
  const close = (x: number, y: number) => Math.abs(x - y) < 1e-6;
  const turn = (a.theta - b.theta) % (2 * Math.PI);
  return (
    (close(turn, 0) || close(Math.abs(turn), 2 * Math.PI)) &&
    close(a.phi, b.phi) &&
    close(a.distance, b.distance)
  );
}
