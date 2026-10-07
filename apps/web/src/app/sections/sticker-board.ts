import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { prefersReducedMotion } from '../core/motion';
import { Icon } from '../shared/ui/icon';

interface Sticker {
  id: number;
  name: string;
  color: string;
  tilt: number;
  x: number;
  y: number;
  z: number;
}

const COLORS = ['sun', 'mint', 'sky', 'pink', 'lilac', 'coral'];
const STEP = 16;
const BIG_STEP = 64;
const FRICTION = 0.93;
const BOUNCE = 0.55;

/**
 * Draggable stickers on a board. Each sticker is a real button: drag it with a pointer (it keeps
 * a little momentum and bounces off the edges) or focus it and use the arrow keys (Shift moves
 * further). The board uses physical coordinates, so it is an explicit left-to-right box.
 */
@Component({
  selector: 'app-sticker-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Icon],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm font-medium">{{ 'play.boardHint' | transloco }}</p>
      <button
        type="button"
        class="btn min-h-11 text-sm"
        style="--btn-bg: var(--surface); --btn-fg: var(--fg)"
        (click)="scatter()"
      >
        <app-icon name="star" class="size-4" />
        {{ 'play.shuffle' | transloco }}
      </button>
    </div>

    <div
      #board
      dir="ltr"
      role="group"
      [attr.aria-label]="'play.boardLabel' | transloco"
      class="sticker relative mt-4 h-[26rem] touch-none overflow-hidden select-none"
      style="--shadow: 8px; background-image: radial-gradient(color-mix(in srgb, var(--ink) 18%, transparent) 1.4px, transparent 1.6px); background-size: 20px 20px"
    >
      @for (sticker of stickers(); track sticker.id) {
        <button
          type="button"
          class="chip absolute start-0 top-0 cursor-grab px-4 py-1.5 text-base font-semibold shadow-[4px_4px_0_0_var(--ink)] active:cursor-grabbing"
          [style.--chip-bg]="'var(--c-' + sticker.color + ')'"
          style="--chip-fg: var(--on-color); will-change: transform"
          [style.transform]="
            'translate(' + sticker.x + 'px, ' + sticker.y + 'px) rotate(' + sticker.tilt + 'deg)'
          "
          [style.z-index]="sticker.z"
          [attr.aria-label]="'play.moveLabel' | transloco: { name: sticker.name }"
          (pointerdown)="grab($event, sticker)"
          (pointermove)="drag($event, sticker)"
          (pointerup)="release($event, sticker)"
          (pointercancel)="release($event, sticker)"
          (keydown)="nudge($event, sticker)"
        >
          {{ sticker.name }}
        </button>
      }
    </div>
  `,
})
export class StickerBoard {
  readonly names = input.required<readonly string[]>();

  protected readonly stickers = signal<Sticker[]>([]);
  private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');
  private readonly frames = new Map<number, number>();
  private topZ = 10;
  private grabbing: {
    id: number;
    dx: number;
    dy: number;
    lastX: number;
    lastY: number;
    lastT: number;
    vx: number;
    vy: number;
  } | null = null;

  constructor() {
    afterNextRender(() => this.scatter());
    inject(DestroyRef).onDestroy(() => this.frames.forEach((frame) => cancelAnimationFrame(frame)));
  }

  /** Spreads the stickers over the board in a repeatable, slightly random-looking pattern. */
  protected scatter(): void {
    const box = this.board().nativeElement;
    const width = box.clientWidth || 600;
    const height = box.clientHeight || 400;
    this.frames.forEach((frame) => cancelAnimationFrame(frame));
    this.frames.clear();
    // A jittered grid sized to the board: stickers spread out instead of piling up.
    const columns = Math.max(1, Math.min(3, Math.floor(width / 170)));
    const rows = Math.max(1, Math.ceil(this.names().length / columns));
    const cellWidth = Math.max(width - 120, 0) / columns;
    const cellHeight = Math.max(height - 60, 0) / rows;
    this.stickers.set(
      this.names().map((name, index) => ({
        id: index,
        name,
        color: COLORS[index % COLORS.length] ?? 'sun',
        tilt: ((index * 7) % 13) - 6,
        x: 8 + (index % columns) * cellWidth + ((index * 37) % 23),
        y: 8 + Math.floor(index / columns) * cellHeight + ((index * 29) % 17),
        z: index,
      })),
    );
  }

  protected grab(event: PointerEvent, sticker: Sticker): void {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    this.stopMomentum(sticker.id);
    const box = this.board().nativeElement.getBoundingClientRect();
    this.grabbing = {
      id: sticker.id,
      dx: event.clientX - box.left - sticker.x,
      dy: event.clientY - box.top - sticker.y,
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: event.timeStamp,
      vx: 0,
      vy: 0,
    };
    this.update(sticker.id, { z: ++this.topZ });
  }

  protected drag(event: PointerEvent, sticker: Sticker): void {
    const state = this.grabbing;
    if (!state || state.id !== sticker.id) return;
    const target = event.currentTarget as HTMLElement;
    const box = this.board().nativeElement.getBoundingClientRect();
    const { x, y } = this.clamp(
      event.clientX - box.left - state.dx,
      event.clientY - box.top - state.dy,
      target,
    );
    const elapsed = Math.max(event.timeStamp - state.lastT, 1);
    state.vx = ((event.clientX - state.lastX) / elapsed) * 16;
    state.vy = ((event.clientY - state.lastY) / elapsed) * 16;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.lastT = event.timeStamp;
    this.update(sticker.id, { x, y });
  }

  protected release(event: PointerEvent, sticker: Sticker): void {
    const state = this.grabbing;
    if (!state || state.id !== sticker.id) return;
    this.grabbing = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    if (!prefersReducedMotion() && Math.hypot(state.vx, state.vy) > 1) {
      this.glide(sticker.id, state.vx, state.vy, event.currentTarget as HTMLElement);
    }
  }

  protected nudge(event: KeyboardEvent, sticker: Sticker): void {
    const step = event.shiftKey ? BIG_STEP : STEP;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    const { x, y } = this.clamp(
      sticker.x + move[0],
      sticker.y + move[1],
      event.currentTarget as HTMLElement,
    );
    this.update(sticker.id, { x, y, z: ++this.topZ });
  }

  /** Momentum after a throw: friction slows it, the walls bounce it. */
  private glide(id: number, startVx: number, startVy: number, element: HTMLElement): void {
    let vx = startVx;
    let vy = startVy;
    const step = () => {
      const sticker = this.stickers().find((s) => s.id === id);
      if (!sticker) return;
      let x = sticker.x + vx;
      let y = sticker.y + vy;
      const max = this.limits(element);
      if (x < 0 || x > max.x) {
        vx = -vx * BOUNCE;
        x = Math.min(Math.max(x, 0), max.x);
      }
      if (y < 0 || y > max.y) {
        vy = -vy * BOUNCE;
        y = Math.min(Math.max(y, 0), max.y);
      }
      vx *= FRICTION;
      vy *= FRICTION;
      this.update(id, { x, y });
      if (Math.hypot(vx, vy) > 0.3) this.frames.set(id, requestAnimationFrame(step));
      else this.frames.delete(id);
    };
    this.frames.set(id, requestAnimationFrame(step));
  }

  private stopMomentum(id: number): void {
    const frame = this.frames.get(id);
    if (frame !== undefined) cancelAnimationFrame(frame);
    this.frames.delete(id);
  }

  private limits(element: HTMLElement): { x: number; y: number } {
    const board = this.board().nativeElement;
    return {
      x: Math.max(board.clientWidth - element.offsetWidth, 0),
      y: Math.max(board.clientHeight - element.offsetHeight, 0),
    };
  }

  private clamp(x: number, y: number, element: HTMLElement): { x: number; y: number } {
    const max = this.limits(element);
    return { x: Math.min(Math.max(x, 0), max.x), y: Math.min(Math.max(y, 0), max.y) };
  }

  private update(id: number, patch: Partial<Sticker>): void {
    this.stickers.update((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
}
