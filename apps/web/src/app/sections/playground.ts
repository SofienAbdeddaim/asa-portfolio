import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Skeleton } from '../shared/ui/skeleton';
import { CircleGame } from './circle-game';
import { StickerBoard } from './sticker-board';

/**
 * Optional playground: draggable stickers and a "draw a perfect circle" game. The interactive
 * parts are deferred until the section is near the viewport, so they cost nothing up front.
 */
@Component({
  selector: 'app-playground',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Skeleton, StickerBoard, CircleGame],
  template: `
    <section id="play" class="container-page py-20" aria-labelledby="play-title">
      <p
        class="eyebrow sticker sticker-color px-3 py-1"
        style="--sticker-bg: var(--c-lilac); --shadow: 3px"
      >
        {{ 'play.eyebrow' | transloco }}
      </p>
      <h2 id="play-title" class="section-title mt-5">{{ 'play.title' | transloco }}</h2>
      <p class="mt-4 max-w-2xl text-xl">{{ 'play.lead' | transloco }}</p>

      @defer (on viewport; prefetch on idle) {
        <div class="mt-12 grid gap-12 lg:grid-cols-2">
          <div><app-sticker-board [names]="names()" /></div>
          <div><app-circle-game /></div>
        </div>
      } @placeholder {
        <div appSkeleton class="mt-12 h-[30rem]"></div>
      }
    </section>
  `,
})
export class Playground {
  readonly names = input.required<readonly string[]>();
}
