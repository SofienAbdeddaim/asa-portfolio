import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CommandService, type Command } from '../core/command.service';
import { Icon } from '../shared/ui/icon';

/**
 * Ctrl/Cmd+K palette on a native `<dialog>`: the browser provides the focus trap, Esc handling
 * and inert background. The input/list follow the ARIA combobox + listbox pattern.
 */
@Component({
  selector: 'app-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslocoPipe],
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -- backdrop click is a mouse shortcut; Esc closes by keyboard -->
    <dialog
      #dialog
      class="sticker m-auto mt-[12vh] w-[min(38rem,calc(100vw-2rem))] overflow-hidden p-0 text-fg"
      style="--shadow: 10px"
      aria-labelledby="palette-title"
      (close)="commands.hide()"
      (click)="onDialogClick($event)"
    >
      <h2 id="palette-title" class="sr-only">{{ 'palette.title' | transloco }}</h2>
      <div class="flex items-center gap-3 border-b-[3px] border-ink px-4">
        <app-icon name="search" />
        <input
          #field
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-autocomplete="list"
          autocomplete="off"
          spellcheck="false"
          class="min-h-14 w-full bg-transparent text-base outline-none placeholder:text-muted"
          [attr.aria-activedescendant]="activeId()"
          [placeholder]="'palette.placeholder' | transloco"
          [value]="query()"
          (input)="onInput($any($event.target).value)"
          (keydown)="onKeydown($event)"
        />
      </div>

      <ul id="palette-list" role="listbox" class="max-h-[50vh] overflow-y-auto p-2">
        @for (command of results(); track command.id; let index = $index) {
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -- options are driven from the combobox input via aria-activedescendant -->
          <li
            role="option"
            [id]="'command-' + command.id"
            [attr.aria-selected]="index === active()"
            class="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2 font-medium aria-selected:bg-sun aria-selected:text-on-color"
            (click)="run(command)"
            (mousemove)="active.set(index)"
          >
            <span>{{ command.label }}</span>
            <span class="text-xs font-semibold opacity-80">{{ command.group }}</span>
          </li>
        } @empty {
          <li role="presentation" class="px-3 py-6 text-center text-muted">
            {{ 'palette.empty' | transloco }}
          </li>
        }
      </ul>

      <p class="border-t-[3px] border-ink bg-surface-2 px-4 py-2 text-xs font-medium">
        {{ 'palette.hint' | transloco }}
      </p>
      <p class="sr-only" role="status" aria-live="polite">
        {{ 'palette.results' | transloco: { count: results().length } }}
      </p>
    </dialog>
  `,
})
export class CommandPalette {
  protected readonly commands = inject(CommandService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly results = computed(() => this.commands.filter(this.query()));
  protected readonly activeId = computed(() => {
    const command = this.results()[this.active()];
    return command ? `command-${command.id}` : null;
  });

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.commands.open() && !dialog.open) {
        this.query.set('');
        this.active.set(0);
        dialog.showModal();
      } else if (!this.commands.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active.update((index) => (count ? (index + step + count) % count : 0));
      this.scrollActiveIntoView();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this.active.set(event.key === 'Home' ? 0 : Math.max(count - 1, 0));
      this.scrollActiveIntoView();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = this.results()[this.active()];
      if (command) this.run(command);
    }
  }

  protected run(command: Command): void {
    this.commands.hide();
    command.run();
  }

  /** A click on the backdrop lands on the dialog element itself, not on its content. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.commands.hide();
  }

  private scrollActiveIntoView(): void {
    const id = this.activeId();
    if (id) queueMicrotask(() => document.getElementById(id)?.scrollIntoView({ block: 'nearest' }));
  }
}
