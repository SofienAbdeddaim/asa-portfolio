import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Point } from '../core/circle-score';
import { provideI18n } from '../core/i18n';
import { LocaleService } from '../core/locale.service';
import { CircleGame } from './circle-game';
import { Playground } from './playground';
import { StickerBoard } from './sticker-board';

async function setup<T>(component: new () => T, locale: 'en' | 'ar' = 'en') {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideI18n()],
  });
  await TestBed.inject(LocaleService).activate(locale);
  return TestBed.createComponent(component);
}

function pointer(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
}

const sizes = { clientWidth: 600, clientHeight: 400, offsetWidth: 100, offsetHeight: 40 };

describe('StickerBoard', () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(sizes)) {
      Object.defineProperty(HTMLElement.prototype, key, { value, configurable: true });
    }
  });

  afterEach(() => {
    for (const key of Object.keys(sizes)) {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
    }
    vi.unstubAllGlobals();
  });

  async function board() {
    const fixture = await setup(StickerBoard);
    fixture.componentRef.setInput('names', ['Angular', 'TypeScript', 'CSS']);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const stickers = () => [...el.querySelectorAll<HTMLButtonElement>('button.chip')];
    const position = (button: HTMLElement) =>
      /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/
        .exec(button.style.transform)!
        .slice(1)
        .map(Number) as [number, number];
    return { fixture, el, stickers, position };
  }

  it('renders one labelled button per name, inside a labelled left-to-right group', async () => {
    const { el, stickers } = await board();
    expect(stickers().map((s) => s.textContent?.trim())).toEqual(['Angular', 'TypeScript', 'CSS']);
    expect(stickers()[0]?.getAttribute('aria-label')).toBe('Move the Angular sticker');
    const group = el.querySelector('[role="group"]')!;
    expect(group.getAttribute('dir')).toBe('ltr');
    expect(group.getAttribute('aria-label')).toBe('Sticker board');
  });

  it('moves with the arrow keys, further with Shift, and never leaves the board', async () => {
    const { fixture, stickers, position } = await board();
    const first = () => stickers()[0]!;
    const [x0, y0] = position(first());
    const press = (key: string, shiftKey = false) => {
      const event = new KeyboardEvent('keydown', {
        key,
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      first().dispatchEvent(event);
      fixture.detectChanges();
      return event;
    };

    expect(press('ArrowRight').defaultPrevented).toBe(true);
    expect(position(first())).toEqual([x0 + 16, y0]);
    press('ArrowDown', true);
    expect(position(first())).toEqual([x0 + 16, y0 + 64]);
    expect(press('a').defaultPrevented).toBe(false);

    for (let i = 0; i < 80; i++) press('ArrowLeft');
    for (let i = 0; i < 80; i++) press('ArrowUp');
    expect(position(first())).toEqual([0, 0]);
    for (let i = 0; i < 80; i++) press('ArrowRight', true);
    for (let i = 0; i < 80; i++) press('ArrowDown', true);
    expect(position(first())).toEqual([500, 360]);
  });

  it('drags with a pointer and brings the sticker to the front', async () => {
    const { fixture, stickers, position } = await board();
    vi.stubGlobal('requestAnimationFrame', () => 0);
    const first = stickers()[0]!;
    const [x0, y0] = position(first);
    const before = Number(first.style.zIndex);

    first.dispatchEvent(pointer('pointerdown', x0 + 10, y0 + 10));
    first.dispatchEvent(pointer('pointermove', x0 + 110, y0 + 60));
    fixture.detectChanges();
    expect(position(first)).toEqual([x0 + 100, y0 + 50]);
    expect(Number(first.style.zIndex)).toBeGreaterThan(before);

    first.dispatchEvent(pointer('pointerup', x0 + 110, y0 + 60));
    // Moves of another sticker are ignored while nothing is held.
    stickers()[1]!.dispatchEvent(pointer('pointermove', 300, 300));
    fixture.detectChanges();
    expect(position(first)).toEqual([x0 + 100, y0 + 50]);
  });

  it('keeps gliding after a throw, stays inside the board and then stops', async () => {
    const { fixture, stickers, position } = await board();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const first = stickers()[0]!;
    const [x0, y0] = position(first);

    first.dispatchEvent(pointer('pointerdown', x0, y0));
    first.dispatchEvent(pointer('pointermove', x0 + 40, y0));
    first.dispatchEvent(pointer('pointerup', x0 + 40, y0));
    // Angular schedules its own frames too, so only require that the glide queued one.
    expect(frames.length).toBeGreaterThanOrEqual(1);

    let steps = 0;
    while (frames.length && steps < 400) {
      frames.shift()!(0);
      steps++;
      const [x, y] = position(first);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(500);
      expect(y).toBeGreaterThanOrEqual(0);
    }
    fixture.detectChanges();
    expect(frames).toHaveLength(0);
    expect(steps).toBeGreaterThan(5);
    expect(steps).toBeLessThan(400);
  });

  it('shuffles the stickers back to their starting places', async () => {
    const { fixture, el, stickers, position } = await board();
    const start = position(stickers()[0]!);
    stickers()[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }),
    );
    fixture.detectChanges();
    expect(position(stickers()[0]!)).not.toEqual(start);
    el.querySelector<HTMLButtonElement>(':scope > div > button')!.click();
    fixture.detectChanges();
    expect(position(stickers()[0]!)).toEqual(start);
  });
});

describe('CircleGame', () => {
  const box = {
    left: 0,
    top: 0,
    width: 600,
    height: 440,
    right: 600,
    bottom: 440,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };

  beforeEach(() => {
    localStorage.clear();
    HTMLCanvasElement.prototype.getContext = (() => null) as never;
    HTMLCanvasElement.prototype.getBoundingClientRect = () => box as DOMRect;
  });

  afterEach(() => vi.restoreAllMocks());

  async function game(locale: 'en' | 'ar' = 'en') {
    const fixture = await setup(CircleGame, locale);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const canvas = el.querySelector('canvas')!;
    const draw = (points: Point[]) => {
      canvas.dispatchEvent(pointer('pointerdown', points[0]!.x, points[0]!.y));
      for (const p of points.slice(1)) canvas.dispatchEvent(pointer('pointermove', p.x, p.y));
      const last = points[points.length - 1]!;
      canvas.dispatchEvent(pointer('pointerup', last.x, last.y));
      fixture.detectChanges();
    };
    const status = () => el.querySelector('[role="status"]')?.textContent?.trim() ?? '';
    return { fixture, el, canvas, draw, status };
  }

  const circle = (turns = 1, radius = 150): Point[] =>
    Array.from({ length: 73 }, (_, i) => {
      const angle = (turns * 2 * Math.PI * i) / 72;
      return { x: 300 + radius * Math.cos(angle), y: 220 + radius * Math.sin(angle) };
    });

  it('describes itself for assistive technology and starts without a result', async () => {
    const { el, canvas, status } = await game();
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe('Drawing area for the circle game');
    expect(el.textContent).toContain('entirely optional');
    expect(status()).toBe('');
  });

  it('scores a round circle, remembers the best score and keeps it when a worse one follows', async () => {
    const { fixture, el, draw, status } = await game();
    draw(circle());
    // Synthetic mouse events round to whole pixels, so a perfect circle scores 99.9 or 100.
    expect(status()).toMatch(/^(99\.\d|100\.0) % round\./);
    expect(status()).toContain('Unbelievably round!');
    expect(el.textContent).toMatch(/Best: (99\.\d|100\.0) %/);
    const best = localStorage.getItem('circle-best');
    expect(Number(best)).toBeGreaterThan(99);

    draw(circle().map((p, i) => ({ x: p.x + Math.sin(i / 3) * 18, y: p.y })));
    expect(Number(status().split(' ')[0])).toBeLessThan(Number(best));
    expect(localStorage.getItem('circle-best')).toBe(best);
    expect(fixture.nativeElement.textContent).toMatch(/Best: (99\.\d|100\.0) %/);
  });

  it('asks for a longer or a closed stroke instead of scoring it', async () => {
    const { draw, status } = await game();
    draw([
      { x: 10, y: 10 },
      { x: 12, y: 12 },
    ]);
    expect(status()).toContain('too short');
    draw(circle(0.4));
    expect(status()).toContain('Almost');
  });

  it('clears the result when trying again and ignores moves while not drawing', async () => {
    const { fixture, canvas, draw, status, el } = await game();
    canvas.dispatchEvent(pointer('pointermove', 100, 100));
    canvas.dispatchEvent(pointer('pointerup', 100, 100));
    expect(status()).toBe('');

    draw(circle());
    expect(status()).not.toBe('');
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Try again'))!.click();
    fixture.detectChanges();
    expect(status()).toBe('');
  });

  it('formats the score for the active language', async () => {
    const { draw, status } = await game('ar');
    draw(circle());
    expect(status()).toMatch(/99\.\d|100\.0/);
    expect(status()).toContain('استدارة');
  });

  it('survives blocked storage', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { draw, status } = await game();
    expect(() => draw(circle())).not.toThrow();
    expect(status()).toContain('round');
  });

  it('draws the stroke and the ideal circle when a 2D context exists', async () => {
    const calls: string[] = [];
    const context = new Proxy(
      {},
      {
        get: (_, name: string) => (): number => calls.push(name),
        set: () => true,
      },
    );
    HTMLCanvasElement.prototype.getContext = (() => context) as never;
    const { draw } = await game();
    draw(circle());
    expect(calls).toContain('lineTo');
    expect(calls).toContain('arc');
    expect(calls).toContain('setLineDash');
  });
});

describe('Playground section', () => {
  it('renders its heading and a placeholder until the interactive parts are near the viewport', async () => {
    const fixture = await setup(Playground);
    fixture.componentRef.setInput('names', ['Angular']);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#play-title')?.textContent).toContain('Playground');
    expect(el.querySelector('section')?.getAttribute('aria-labelledby')).toBe('play-title');
    expect(el.querySelector('app-sticker-board')).toBeNull();
    expect(el.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
