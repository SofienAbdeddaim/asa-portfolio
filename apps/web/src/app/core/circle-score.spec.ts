import { resample, scoreCircle, tier, type Point } from './circle-score';

const arc = (turns: number, radiusX = 100, radiusY = 100, steps = 90, wobble = 0): Point[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (turns * 2 * Math.PI * i) / steps;
    const r = 1 + wobble * Math.sin(angle * 5);
    return { x: 200 + radiusX * r * Math.cos(angle), y: 200 + radiusY * r * Math.sin(angle) };
  });

describe('scoreCircle', () => {
  it('gives a perfect circle a near-perfect score and reports its center and radius', () => {
    const result = scoreCircle(arc(1));
    expect(result.status).toBe('scored');
    if (result.status !== 'scored') return;
    expect(result.score).toBeGreaterThanOrEqual(99);
    expect(result.center.x).toBeCloseTo(200, -1);
    expect(result.center.y).toBeCloseTo(200, -1);
    expect(result.radius).toBeCloseTo(100, -1);
  });

  it('does not care about the drawing direction', () => {
    const clockwise = scoreCircle(arc(1));
    const counter = scoreCircle(arc(-1));
    expect(clockwise).toMatchObject({ status: 'scored' });
    expect(counter).toMatchObject({ status: 'scored' });
  });

  it('scores wobbly, squashed and square-ish shapes lower, in a sensible order', () => {
    const score = (points: Point[]) => {
      const result = scoreCircle(points);
      return result.status === 'scored' ? result.score : -1;
    };
    const round = score(arc(1));
    const wobbly = score(arc(1, 100, 100, 90, 0.04));
    const ellipse = score(arc(1, 100, 60));
    expect(wobbly).toBeLessThan(round);
    expect(wobbly).toBeGreaterThan(60);
    expect(ellipse).toBeLessThan(wobbly);

    const square: Point[] = [];
    for (const [x, y] of [
      [0, 0],
      [200, 0],
      [200, 200],
      [0, 200],
      [0, 0],
    ] as const) {
      square.push({ x, y });
    }
    const squareScore = score(
      Array.from({ length: 80 }, (_, i) => {
        const t = (i / 79) * 4;
        const side = Math.min(Math.floor(t), 3);
        const from = square[side] as Point;
        const to = square[side + 1] as Point;
        const f = t - side;
        return { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f };
      }),
    );
    expect(squareScore).toBeLessThan(70);
  });

  it('penalizes an unclosed loop and spirals', () => {
    const closed = scoreCircle(arc(1));
    const gappy = scoreCircle(arc(0.93));
    const spiral = scoreCircle(arc(1.6));
    const s = (r: ReturnType<typeof scoreCircle>) => (r.status === 'scored' ? r.score : -1);
    expect(s(gappy)).toBeLessThan(s(closed));
    expect(s(spiral)).toBeLessThan(s(closed));
  });

  it('rejects strokes that are too short, tiny, or do not go around', () => {
    expect(scoreCircle([{ x: 0, y: 0 }])).toEqual({ status: 'too-short' });
    expect(scoreCircle(arc(1, 5, 5))).toEqual({ status: 'too-short' });
    expect(scoreCircle(arc(0.4))).toEqual({ status: 'open' });
    const line = Array.from({ length: 30 }, (_, i) => ({ x: i * 10, y: 0 }));
    expect(scoreCircle(line).status).toBe('open');
    const dot = Array.from({ length: 30 }, () => ({ x: 5, y: 5 }));
    expect(scoreCircle(dot)).toEqual({ status: 'too-short' });
  });
});

describe('resample', () => {
  it('returns evenly spaced points along the path', () => {
    const points = resample(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 100, y: 0 },
      ],
      11,
    );
    expect(points).toHaveLength(11);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[10]?.x).toBeCloseTo(100);
    expect(points[5]?.x).toBeCloseTo(50);
  });

  it('returns nothing for a path with no length', () => {
    expect(
      resample([
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ]),
    ).toEqual([]);
  });
});

describe('tier', () => {
  it('maps scores to message tiers', () => {
    expect(tier(99)).toBe('perfect');
    expect(tier(92)).toBe('great');
    expect(tier(80)).toBe('good');
    expect(tier(60)).toBe('ok');
    expect(tier(10)).toBe('low');
  });
});
