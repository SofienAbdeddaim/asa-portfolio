export interface Point {
  x: number;
  y: number;
}

export type CircleResult =
  | { status: 'too-short' }
  | { status: 'open' }
  | { status: 'scored'; score: number; center: Point; radius: number };

const SAMPLES = 72;
const MIN_RADIUS = 24;
const MIN_COVERAGE = 0.9;
/** How strongly irregular radii cost points: a 5% radius wobble loses 20 points. */
const WOBBLE_PENALTY = 400;

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Evenly spaced points along the stroke, so a slow part of the gesture does not weigh more. */
export function resample(points: readonly Point[], count = SAMPLES): Point[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push((lengths[i - 1] ?? 0) + distance(points[i - 1] as Point, points[i] as Point));
  }
  const total = lengths[lengths.length - 1] ?? 0;
  if (total === 0) return [];

  const result: Point[] = [];
  let segment = 1;
  for (let k = 0; k < count; k++) {
    const target = (total * k) / (count - 1);
    while (segment < lengths.length - 1 && (lengths[segment] ?? 0) < target) segment++;
    const start = points[segment - 1] as Point;
    const end = points[segment] as Point;
    const span = (lengths[segment] ?? 0) - (lengths[segment - 1] ?? 0) || 1;
    const t = (target - (lengths[segment - 1] ?? 0)) / span;
    result.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
  }
  return result;
}

/**
 * Scores a hand-drawn stroke from 0 to 100 by how round it is: the spread of the distance to the
 * stroke's center, minus penalties for an unclosed loop and for spiraling past a full turn.
 * Strokes that are too short or do not go around are reported instead of scored.
 */
export function scoreCircle(stroke: readonly Point[]): CircleResult {
  if (stroke.length < 12) return { status: 'too-short' };
  const points = resample(stroke);
  if (points.length === 0) return { status: 'too-short' };

  // The last sample repeats the start of a closed loop, so it is left out of the center and radii.
  const ring = points.slice(0, -1);
  const center = {
    x: ring.reduce((sum, p) => sum + p.x, 0) / ring.length,
    y: ring.reduce((sum, p) => sum + p.y, 0) / ring.length,
  };
  const radii = ring.map((p) => distance(p, center));
  const radius = radii.reduce((sum, r) => sum + r, 0) / radii.length;
  if (radius < MIN_RADIUS) return { status: 'too-short' };

  // Signed angle travelled around the center: one full circle is 1 turn.
  let angle = 0;
  for (let i = 1; i < points.length; i++) {
    const a = Math.atan2(
      (points[i - 1] as Point).y - center.y,
      (points[i - 1] as Point).x - center.x,
    );
    const b = Math.atan2((points[i] as Point).y - center.y, (points[i] as Point).x - center.x);
    let delta = b - a;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    angle += delta;
  }
  const turns = Math.abs(angle) / (2 * Math.PI);
  if (turns < MIN_COVERAGE) return { status: 'open' };

  const wobble =
    Math.sqrt(radii.reduce((sum, r) => sum + (r - radius) ** 2, 0) / radii.length) / radius;
  const gap = Math.min(
    distance(points[0] as Point, points[points.length - 1] as Point) / radius,
    1,
  );
  const overshoot = Math.max(0, turns - 1.1);

  const score = 100 - wobble * WOBBLE_PENALTY - gap * 40 - overshoot * 30;
  return { status: 'scored', score: Math.max(0, Math.round(score * 10) / 10), center, radius };
}

/** Which message tier a score earns. */
export function tier(score: number): 'perfect' | 'great' | 'good' | 'ok' | 'low' {
  if (score >= 98) return 'perfect';
  if (score >= 90) return 'great';
  if (score >= 75) return 'good';
  if (score >= 50) return 'ok';
  return 'low';
}
