import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { scoreCircle, tier, type CircleResult, type Point } from '../core/circle-score';
import { formatNumber } from '../core/locale';
import { LocaleService } from '../core/locale.service';
import { Icon } from '../shared/ui/icon';

const WIDTH = 600;
const HEIGHT = 440;
const BEST_KEY = 'circle-best';

/**
 * "Draw a perfect circle". A pointer game, so it is clearly optional; the score logic lives in
 * `core/circle-score.ts`. The best score is a per-viewer convenience kept in localStorage.
 */
@Component({
  selector: 'app-circle-game',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Icon],
  template: `
    <h3 class="text-3xl">{{ 'play.gameTitle' | transloco }}</h3>
    <p class="mt-2">{{ 'play.gameHint' | transloco }}</p>
    <p class="mt-1 text-sm text-muted">{{ 'play.pointerOnly' | transloco }}</p>

    <div class="sticker relative mt-4 overflow-hidden" style="--shadow: 8px">
      <canvas
        #canvas
        role="img"
        [attr.aria-label]="'play.canvasLabel' | transloco"
        [width]="width"
        [height]="height"
        class="block aspect-[600/440] w-full cursor-crosshair touch-none"
        (pointerdown)="start($event)"
        (pointermove)="move($event)"
        (pointerup)="end($event)"
        (pointercancel)="end($event)"
      ></canvas>

      @if (!drawing() && !result()) {
        <p
          class="pointer-events-none absolute inset-0 grid place-items-center font-display text-2xl font-extrabold opacity-40"
          aria-hidden="true"
        >
          {{ 'play.start' | transloco }}
        </p>
      }
    </div>

    <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
      <p role="status" class="text-xl font-semibold">{{ message() }}</p>
      <div class="flex items-center gap-3">
        @if (best() !== null) {
          <span class="chip" style="--chip-bg: var(--c-sun); --chip-fg: var(--on-color)">
            {{ 'play.best' | transloco: { score: format(best() ?? 0) } }}
          </span>
        }
        <button
          type="button"
          class="btn min-h-11 text-sm"
          style="--btn-bg: var(--surface); --btn-fg: var(--fg)"
          (click)="reset()"
        >
          <app-icon name="check" class="size-4" />
          {{ 'play.again' | transloco }}
        </button>
      </div>
    </div>
  `,
})
export class CircleGame {
  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;

  private readonly locale = inject(LocaleService);
  private readonly transloco = inject(TranslocoService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private points: Point[] = [];

  protected readonly drawing = signal(false);
  protected readonly result = signal<CircleResult | null>(null);
  protected readonly best = signal<number | null>(this.readBest());

  protected readonly message = computed(() => {
    this.locale.revision(); // re-translate when the language changes
    const result = this.result();
    if (!result) return '';
    if (result.status === 'too-short') return this.text('play.tooShort');
    if (result.status === 'open') return this.text('play.open');
    const percent = this.text('play.score', { score: this.format(result.score) });
    return `${percent} ${this.text(`play.tier.${tier(result.score)}`)}`;
  });

  protected format(score: number): string {
    return formatNumber(score, this.locale.locale(), {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    });
  }

  protected start(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.reset();
    this.drawing.set(true);
    this.points = [this.pointAt(event)];
  }

  protected move(event: PointerEvent): void {
    if (!this.drawing()) return;
    const point = this.pointAt(event);
    const previous = this.points[this.points.length - 1];
    this.points.push(point);
    this.stroke(previous, point);
  }

  protected end(event: PointerEvent): void {
    if (!this.drawing()) return;
    this.drawing.set(false);
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    const result = scoreCircle(this.points);
    this.result.set(result);
    if (result.status !== 'scored') return;

    this.guide(result.center, result.radius);
    const previous = this.best();
    if (previous === null || result.score > previous) {
      this.best.set(result.score);
      this.writeBest(result.score);
    }
    if (result.score >= 90) void this.celebrate(event);
  }

  protected reset(): void {
    this.points = [];
    this.result.set(null);
    const context = this.context();
    context?.clearRect(0, 0, WIDTH, HEIGHT);
  }

  private text(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params, this.locale.locale());
  }

  private pointAt(event: PointerEvent): Point {
    const box = this.canvas().nativeElement.getBoundingClientRect();
    const sx = box.width ? WIDTH / box.width : 1;
    const sy = box.height ? HEIGHT / box.height : 1;
    return { x: (event.clientX - box.left) * sx, y: (event.clientY - box.top) * sy };
  }

  private context(): CanvasRenderingContext2D | null {
    return this.canvas().nativeElement.getContext?.('2d') ?? null;
  }

  private ink(): string {
    return (
      getComputedStyle(this.canvas().nativeElement).getPropertyValue('--ink').trim() || '#17120f'
    );
  }

  private stroke(from: Point | undefined, to: Point): void {
    const context = this.context();
    if (!context || !from) return;
    context.strokeStyle = this.ink();
    context.lineWidth = 6;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  /** Draws the ideal circle for comparison. */
  private guide(center: Point, radius: number): void {
    const context = this.context();
    if (!context) return;
    context.save();
    context.setLineDash([10, 10]);
    context.strokeStyle = '#ff5a36';
    context.lineWidth = 4;
    context.beginPath();
    context.arc(center.x, center.y, radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  private async celebrate(event: PointerEvent): Promise<void> {
    const { confetti } = await import('../core/confetti');
    confetti(event.clientX, event.clientY, 40);
  }

  private readBest(): number | null {
    try {
      const value = Number(localStorage.getItem(BEST_KEY));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }

  private writeBest(score: number): void {
    try {
      localStorage.setItem(BEST_KEY, String(score));
    } catch {
      // Storage can be blocked; the best score then lasts for the session only.
    }
  }
}
