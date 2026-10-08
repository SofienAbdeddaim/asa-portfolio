import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from './admin-api';
import { apiMessage } from './api-error';
import { ConfirmService, ToastService } from './feedback';
import { translationStatus } from './form-model';
import { reorder } from './reorder';
import { findResource, type Entity } from './resources';

type Status = 'loading' | 'ready' | 'error';

/**
 * A resource's entries in their public order. Reorder by dragging a row, or with the up and down
 * buttons (keyboard and touch friendly). Order is saved straight away and rolled back on failure.
 */
@Component({
  selector: 'app-resource-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (def(); as def) {
      <header class="flex flex-wrap items-center justify-between gap-4">
        <h1 class="text-4xl" tabindex="-1">{{ def.label }}</h1>
        <a class="a-btn a-btn-primary" [routerLink]="['/admin', def.key, 'new']"
          >New {{ def.singular }}</a
        >
      </header>
      <p class="a-help mt-2">
        The order here is the order on the site. Drag a row, or use the arrow buttons.
      </p>

      <p class="sr-only" role="status" aria-live="polite">{{ announcement() }}</p>

      @switch (status()) {
        @case ('loading') {
          <div class="mt-6 grid gap-3" aria-busy="true">
            @for (n of [1, 2, 3]; track n) {
              <div class="a-card h-20 animate-pulse bg-surface-2"></div>
            }
          </div>
        }
        @case ('error') {
          <div class="a-card mt-6 p-6">
            <p class="a-error" role="alert">{{ error() }}</p>
            <button type="button" class="a-btn mt-4" (click)="load()">Try again</button>
          </div>
        }
        @default {
          @if (items().length === 0) {
            <div class="a-card mt-6 p-8 text-center">
              <p class="text-xl font-semibold">Nothing here yet</p>
              <p class="a-help">Add your first {{ def.singular }} to show it on the site.</p>
              <a class="a-btn a-btn-primary mt-4" [routerLink]="['/admin', def.key, 'new']"
                >New {{ def.singular }}</a
              >
            </div>
          } @else {
            <ol class="mt-6 grid list-none gap-3">
              @for (
                item of items();
                track item['id'];
                let i = $index;
                let first = $first;
                let last = $last
              ) {
                <li
                  class="a-card grid gap-3 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  [class.opacity-50]="dragIndex() === i"
                  [style.outline]="
                    overIndex() === i && dragIndex() !== i ? '4px dashed var(--ink)' : null
                  "
                  draggable="true"
                  (dragstart)="dragStart($event, i)"
                  (dragover)="dragOver($event, i)"
                  (drop)="drop($event, i)"
                  (dragend)="dragEnd()"
                >
                  <span
                    class="hidden cursor-grab select-none px-2 text-2xl text-muted sm:block"
                    aria-hidden="true"
                    title="Drag to reorder"
                    >⠿</span
                  >

                  <div class="min-w-0">
                    <p class="truncate text-lg font-semibold">
                      <a
                        class="underline-offset-4 hover:underline"
                        [routerLink]="['/admin', def.key, item['id']]"
                        >{{ def.title(item) }}</a
                      >
                    </p>
                    <div class="mt-1 flex flex-wrap items-center gap-2">
                      @if (def.subtitle?.(item); as subtitle) {
                        <span class="text-sm text-muted">{{ subtitle }}</span>
                      }
                      <span class="a-chip" [attr.data-state]="item['published'] ? 'ok' : 'warn'">{{
                        item['published'] ? 'Published' : 'Draft'
                      }}</span>
                      @for (locale of locales; track locale) {
                        @if (translations(item)[locale] !== 'n/a') {
                          <span
                            class="a-chip"
                            [attr.data-state]="
                              translations(item)[locale] === 'complete' ? 'ok' : null
                            "
                            [title]="translationTitle(item, locale)"
                          >
                            {{ locale.toUpperCase() }}
                            <span class="sr-only">{{ translationTitle(item, locale) }}</span>
                          </span>
                        }
                      }
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      class="a-btn min-w-11 px-2"
                      [disabled]="first || busy()"
                      [attr.aria-label]="'Move ' + def.title(item) + ' up'"
                      (click)="move(i, -1)"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      class="a-btn min-w-11 px-2"
                      [disabled]="last || busy()"
                      [attr.aria-label]="'Move ' + def.title(item) + ' down'"
                      (click)="move(i, 1)"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      class="a-btn"
                      [disabled]="busy()"
                      [attr.aria-pressed]="!!item['published']"
                      (click)="togglePublished(item)"
                    >
                      {{ item['published'] ? 'Unpublish' : 'Publish'
                      }}<span class="sr-only"> {{ def.title(item) }}</span>
                    </button>
                    <a class="a-btn" [routerLink]="['/admin', def.key, item['id']]"
                      >Edit<span class="sr-only"> {{ def.title(item) }}</span></a
                    >
                    <button
                      type="button"
                      class="a-btn a-btn-danger"
                      [disabled]="busy()"
                      (click)="remove(item)"
                    >
                      Delete<span class="sr-only"> {{ def.title(item) }}</span>
                    </button>
                  </div>
                </li>
              }
            </ol>
          }
        }
      }
    } @else {
      <h1 class="text-4xl">Not found</h1>
      <p class="mt-3">There is no section called “{{ resource() }}”.</p>
      <a class="a-btn mt-4" routerLink="/admin">Back to the back-office</a>
    }
  `,
})
export class ResourceListPage {
  /** Route parameter `:resource`. */
  readonly resource = input<string>();

  private readonly api = inject(AdminApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly def = computed(() => findResource(this.resource()));
  protected readonly items = signal<Entity[]>([]);
  protected readonly status = signal<Status>('loading');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly announcement = signal('');
  protected readonly dragIndex = signal<number | null>(null);
  protected readonly overIndex = signal<number | null>(null);
  protected readonly locales = ['fr', 'ar'] as const;

  constructor() {
    effect(() => {
      if (this.def()) void this.load();
    });
  }

  protected async load(): Promise<void> {
    const def = this.def();
    if (!def) return;
    this.status.set('loading');
    try {
      this.items.set(await this.api.list(def.path));
      this.status.set('ready');
    } catch (error) {
      this.error.set(apiMessage(error));
      this.status.set('error');
    }
  }

  protected translations(item: Entity) {
    return translationStatus(item, this.def()?.fields ?? []);
  }

  protected translationTitle(item: Entity, locale: 'fr' | 'ar'): string {
    const name = locale === 'fr' ? 'French' : 'Arabic';
    const state = this.translations(item)[locale];
    return state === 'complete'
      ? `${name} translation complete`
      : state === 'partial'
        ? `${name} translation partly done`
        : `${name} translation missing`;
  }

  // ---- ordering ------------------------------------------------------------------------------

  protected move(from: number, delta: number): void {
    void this.applyOrder(from, from + delta);
  }

  protected dragStart(event: DragEvent, index: number): void {
    this.dragIndex.set(index);
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected dragOver(event: DragEvent, index: number): void {
    if (this.dragIndex() === null) return;
    event.preventDefault();
    this.overIndex.set(index);
  }

  protected drop(event: DragEvent, index: number): void {
    event.preventDefault();
    const from = this.dragIndex();
    this.dragEnd();
    if (from !== null && from !== index) void this.applyOrder(from, index);
  }

  protected dragEnd(): void {
    this.dragIndex.set(null);
    this.overIndex.set(null);
  }

  /** Applies the new order immediately, saves it, and puts the old order back if saving fails. */
  private async applyOrder(from: number, to: number): Promise<void> {
    const def = this.def();
    const before = this.items();
    const after = reorder(before, from, to);
    if (!def || after.every((item, index) => item === before[index])) return;

    this.items.set(after);
    this.busy.set(true);
    try {
      await this.api.reorder(
        def.path,
        after.map((item) => String(item['id'])),
      );
      const moved = def.title(before[from] as Entity);
      this.announcement.set(
        `${moved} moved to position ${after.indexOf(before[from] as Entity) + 1} of ${after.length}.`,
      );
    } catch (error) {
      this.items.set(before);
      this.toast.show(`Couldn't save the new order. ${apiMessage(error)}`, 'error');
    } finally {
      this.busy.set(false);
    }
  }

  // ---- publish and delete --------------------------------------------------------------------

  protected async togglePublished(item: Entity): Promise<void> {
    const def = this.def();
    if (!def) return;
    const next = !item['published'];
    this.busy.set(true);
    try {
      const saved = await this.api.update(def.path, String(item['id']), { published: next });
      this.items.update((list) =>
        list.map((entry) => (entry['id'] === saved['id'] ? saved : entry)),
      );
      this.toast.show(`${def.title(saved)} is now ${next ? 'published' : 'a draft'}.`);
    } catch (error) {
      this.toast.show(apiMessage(error), 'error');
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(item: Entity): Promise<void> {
    const def = this.def();
    if (!def) return;
    const name = def.title(item);
    const confirmed = await this.confirm.ask({
      title: `Delete ${def.singular}?`,
      message: `“${name}” will be removed from the site for good. This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.busy.set(true);
    try {
      await this.api.remove(def.path, String(item['id']));
      this.items.update((list) => list.filter((entry) => entry !== item));
      this.toast.show(`Deleted “${name}”.`);
    } catch (error) {
      this.toast.show(apiMessage(error), 'error');
    } finally {
      this.busy.set(false);
    }
  }
}
