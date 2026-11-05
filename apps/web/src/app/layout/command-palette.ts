import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CommandService, type Command } from '../core/command.service';
import { ContentStore } from '../core/content.store';
import { LocaleService } from '../core/locale.service';
import { prefersReducedMotion } from '../core/motion';
import { goToSection } from '../core/sections';
import {
  type TerminalLine,
  type TerminalTone,
  commandKey,
  completeCommand,
  looksLikeShell,
  parseCommand,
  runCommand,
  suggestCommands,
} from '../core/terminal';
import { Icon } from '../shared/ui/icon';

/** A palette row: a site command, or a terminal command that opens the console (ADR 23). */
interface PaletteItem extends Command {
  shell?: boolean;
}

interface LogEntry {
  id: number;
  input: string;
  lines: TerminalLine[];
}

/** Time between two revealed lines of output; long outputs still finish in well under a second. */
const LINE_MS = 45;
/** Pause after `sudo hire` before the palette closes on the contact section. */
const CONTACT_DELAY_MS = 900;

const TONES: Record<TerminalTone, string> = {
  ok: 'text-ok',
  accent: 'text-accent',
  muted: 'text-muted',
  hash: 'text-link',
};

/**
 * Ctrl/Cmd+K palette on a native `<dialog>`: the browser provides the focus trap, Esc handling
 * and inert background. The input/list follow the ARIA combobox + listbox pattern.
 *
 * Typing a developer command (`help`, `whoami`, `git log`…) turns it into a small terminal whose
 * answers come from the published content. The input becomes a plain text box and the output is a
 * polite live region.
 */
@Component({
  selector: 'app-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslocoPipe],
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -- backdrop click is a mouse shortcut; Esc closes by keyboard -->
    <dialog
      #dialog
      class="card m-auto mt-[12vh] shadow-2xl w-[min(38rem,calc(100vw-2rem))] overflow-hidden p-0 text-fg"
      [class.palette-terminal]="terminal()"
      aria-labelledby="palette-title"
      (close)="commands.hide()"
      (click)="onDialogClick($event)"
    >
      <h2 id="palette-title" class="sr-only">{{ 'palette.title' | transloco }}</h2>
      <div
        class="flex items-center gap-3 border-b-[3px] border-ink px-4"
        [attr.dir]="shellInput() ? 'ltr' : null"
      >
        @if (shellInput()) {
          <span class="shrink-0 font-mono text-sm text-ok" dir="ltr" aria-hidden="true">{{
            prompt()
          }}</span>
        } @else {
          <app-icon name="search" />
        }
        <input
          #field
          type="text"
          autocomplete="off"
          spellcheck="false"
          autocapitalize="off"
          class="min-h-14 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted"
          [class.font-mono]="shellInput()"
          [attr.dir]="shellInput() ? 'ltr' : null"
          [attr.role]="terminal() ? null : 'combobox'"
          [attr.aria-expanded]="terminal() ? null : 'true'"
          [attr.aria-controls]="terminal() ? 'palette-log' : 'palette-list'"
          [attr.aria-autocomplete]="terminal() ? null : 'list'"
          [attr.aria-activedescendant]="terminal() ? null : activeId()"
          [attr.aria-label]="terminal() ? ('palette.terminal' | transloco) : null"
          [placeholder]="terminal() ? '' : ('palette.placeholder' | transloco)"
          [value]="query()"
          (input)="onInput($any($event.target).value)"
          (keydown)="onKeydown($event)"
        />
      </div>

      @if (terminal()) {
        <div
          #logBox
          id="palette-log"
          role="log"
          aria-live="polite"
          class="max-h-[50vh] overflow-y-auto px-4 py-3 font-mono text-sm leading-relaxed"
          dir="ltr"
          [attr.aria-label]="'palette.terminalLabel' | transloco"
        >
          @for (entry of log(); track entry.id; let last = $last) {
            <div class="mb-3 last:mb-0">
              <p class="text-muted">
                <span class="text-ok" aria-hidden="true">{{ prompt() }} </span>{{ entry.input }}
              </p>
              @for (row of last ? entry.lines.slice(0, revealed()) : entry.lines; track $index) {
                <p class="whitespace-pre-wrap wrap-anywhere" dir="auto">
                  @for (segment of row; track $index) {
                    <span [class]="segment.tone ? tone(segment.tone) : ''">{{ segment.text }}</span>
                  }
                </p>
              }
            </div>
          }
        </div>
      } @else {
        <ul id="palette-list" role="listbox" class="max-h-[50vh] overflow-y-auto p-2">
          @for (command of results(); track command.id; let index = $index) {
            <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -- options are driven from the combobox input via aria-activedescendant -->
            <li
              role="option"
              [id]="'command-' + command.id"
              [attr.aria-selected]="index === active()"
              class="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md px-3 py-2 aria-selected:bg-surface-2 aria-selected:text-fg"
              (click)="choose(command)"
              (mousemove)="active.set(index)"
            >
              <span [class.font-mono]="command.shell" [attr.dir]="command.shell ? 'ltr' : null">{{
                command.label
              }}</span>
              <span class="text-xs font-semibold opacity-80">{{ command.group }}</span>
            </li>
          } @empty {
            <li role="presentation" class="px-3 py-6 text-center text-muted">
              {{ 'palette.empty' | transloco }}
            </li>
          }
        </ul>
      }

      <p
        class="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t-[3px] border-ink bg-surface-2 px-4 py-2 text-xs font-medium"
      >
        <span>{{ 'palette.hint' | transloco }}</span>
        <span class="text-muted">{{ 'palette.tip' | transloco }}</span>
      </p>
      @if (!terminal()) {
        <p class="sr-only" role="status" aria-live="polite">
          {{ 'palette.results' | transloco: { count: results().length } }}
        </p>
      }
    </dialog>
  `,
})
export class CommandPalette {
  protected readonly commands = inject(CommandService);
  private readonly store = inject(ContentStore);
  private readonly locale = inject(LocaleService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private readonly logView = viewChild<ElementRef<HTMLElement>>('logBox');

  protected readonly query = signal('');
  protected readonly active = signal(0);
  /** True once a terminal command ran: the list gives way to the console until the palette closes. */
  protected readonly terminal = signal(false);
  protected readonly log = signal<readonly LogEntry[]>([]);
  /** Lines of the latest output shown so far (it appears line by line). */
  protected readonly revealed = signal(0);

  private history: string[] = [];
  private historyIndex = -1;
  private nextId = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private contactTimer: ReturnType<typeof setTimeout> | undefined;

  /** The input reads as shell input: show the prompt and a monospace, left-to-right field. */
  protected readonly shellInput = computed(() => this.terminal() || looksLikeShell(this.query()));

  protected readonly prompt = computed(() => {
    this.locale.revision();
    const first = this.store.profile()?.fullName.split(/\s+/)[0] ?? '';
    const user =
      first
        .normalize('NFD')
        .replace(/[^A-Za-z0-9]/g, '')
        .toLowerCase() || 'guest';
    return `${user}@${this.transloco.translate('app.brand').toLowerCase()}:~$`;
  });

  protected readonly results = computed<PaletteItem[]>(() => {
    this.locale.revision();
    const query = this.query();
    const group = this.transloco.translate('terminal.group');
    const shell: PaletteItem[] = suggestCommands(query).map((name) => ({
      id: `shell-${name.replace(/[^a-z]+/g, '-')}`,
      label: name,
      group: `${group} · ${this.transloco.translate(`terminal.help.${commandKey(name)}`)}`,
      shell: true,
      run: () => this.execute(name),
    }));
    return [...shell, ...this.commands.filter(query)];
  });

  protected readonly activeId = computed(() => {
    const command = this.results()[this.active()];
    return command ? `command-${command.id}` : null;
  });

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.commands.open() && !dialog.open) {
        this.reset();
        dialog.showModal();
      } else if (!this.commands.open() && dialog.open) {
        dialog.close();
      }
    });
    inject(DestroyRef).onDestroy(() => this.stopTimers());
  }

  protected tone(tone: TerminalTone): string {
    return TONES[tone];
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.terminal()) return this.onTerminalKeydown(event);
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
    } else if (event.key === 'Tab' && looksLikeShell(this.query())) {
      this.complete(event);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // A full command runs as typed (`sudo hire sofien`), even if a search result also matches.
      if (parseCommand(this.query())) return this.execute(this.query());
      const command = this.results()[this.active()];
      if (command) this.choose(command);
      else if (looksLikeShell(this.query())) this.execute(this.query());
    }
  }

  protected choose(command: PaletteItem): void {
    if (command.shell) {
      command.run();
      return;
    }
    this.commands.hide();
    command.run();
  }

  /** A click on the backdrop lands on the dialog element itself, not on its content. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.commands.hide();
  }

  private onTerminalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.execute(this.query());
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (!this.history.length) return;
      event.preventDefault();
      const last = this.history.length;
      const index = this.historyIndex < 0 ? last : this.historyIndex;
      this.historyIndex =
        event.key === 'ArrowUp' ? Math.max(0, index - 1) : Math.min(last, index + 1);
      this.query.set(this.history[this.historyIndex] ?? '');
    } else if (event.key === 'Tab') {
      this.complete(event);
    }
  }

  /** Completes a command name; Tab keeps moving focus when there is nothing to complete. */
  private complete(event: KeyboardEvent): void {
    const completed = completeCommand(this.query());
    if (completed === this.query()) return;
    event.preventDefault();
    this.query.set(completed);
  }

  private execute(input: string): void {
    const typed = input.trim();
    if (!typed) return;
    this.locale.revision();
    const current = this.locale.locale();
    const result = runCommand(typed, {
      content: this.store.content(),
      locale: current,
      t: (key, params) => this.transloco.translate(key, params, current),
    });
    this.history.push(typed);
    this.historyIndex = -1;
    this.query.set('');
    this.terminal.set(true);
    this.focusField();

    if (result.action === 'exit') return this.commands.hide();
    if (result.action === 'clear') {
      this.stopTimers();
      this.log.set([]);
      return;
    }
    this.log.update((entries) => [
      ...entries,
      { id: this.nextId++, input: typed, lines: result.lines },
    ]);
    this.reveal(result.lines.length, () => {
      if (result.action === 'contact') {
        this.contactTimer = setTimeout(() => this.goToContact(), CONTACT_DELAY_MS);
      }
    });
  }

  /** Shows the latest output line by line, or at once when motion is reduced. */
  private reveal(count: number, done: () => void): void {
    clearInterval(this.timer);
    if (prefersReducedMotion() || count <= 1) {
      this.revealed.set(count);
      this.scrollLog();
      return done();
    }
    this.revealed.set(1);
    this.timer = setInterval(() => {
      this.revealed.update((shown) => shown + 1);
      this.scrollLog();
      if (this.revealed() >= count) {
        clearInterval(this.timer);
        done();
      }
    }, LINE_MS);
  }

  private goToContact(): void {
    this.commands.hide();
    const current = this.locale.locale();
    if (this.router.url.split(/[?#]/)[0] !== `/${current}`) {
      void this.router.navigate(['/', current], { fragment: 'contact' });
    } else {
      // Let the dialog give focus back first, then move it to the section.
      setTimeout(() => goToSection(this.document, 'contact'));
    }
  }

  private reset(): void {
    this.stopTimers();
    this.query.set('');
    this.active.set(0);
    this.terminal.set(false);
    this.log.set([]);
    this.revealed.set(0);
    this.historyIndex = -1;
  }

  private stopTimers(): void {
    clearInterval(this.timer);
    clearTimeout(this.contactTimer);
  }

  private focusField(): void {
    queueMicrotask(() => this.field()?.nativeElement.focus());
  }

  private scrollLog(): void {
    queueMicrotask(() => {
      const view = this.logView()?.nativeElement;
      if (view) view.scrollTop = view.scrollHeight;
    });
  }

  private scrollActiveIntoView(): void {
    const id = this.activeId();
    if (id) queueMicrotask(() => document.getElementById(id)?.scrollIntoView({ block: 'nearest' }));
  }
}
