import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule, type FormControl, type FormGroup } from '@angular/forms';
import type { Locale } from '@asa/shared';
import { renderMarkdown } from '../../core/markdown';
import { trackControl } from '../control-events';
import { describeErrors } from '../form-model';
import type { FieldDef } from '../resources';

interface LocaleOption {
  code: Locale;
  label: string;
  dir: 'ltr' | 'rtl';
}

const LOCALES: readonly LocaleOption[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];

/** Inserts Markdown syntax around the selection of a textarea. */
const TOOLS = [
  { id: 'bold', label: 'Bold', text: 'B', before: '**', after: '**', placeholder: 'bold text' },
  { id: 'italic', label: 'Italic', text: 'I', before: '_', after: '_', placeholder: 'italic text' },
  {
    id: 'heading',
    label: 'Heading',
    text: 'H',
    before: '## ',
    after: '',
    placeholder: 'Heading',
    line: true,
  },
  {
    id: 'list',
    label: 'Bulleted list',
    text: '•',
    before: '- ',
    after: '',
    placeholder: 'List item',
    line: true,
  },
  {
    id: 'link',
    label: 'Link',
    text: '🔗',
    before: '[',
    after: '](https://)',
    placeholder: 'link text',
  },
  { id: 'code', label: 'Code', text: '</>', before: '`', after: '`', placeholder: 'code' },
] as const;

/**
 * One translatable field: three manual inputs (English, French, Arabic). English is required when
 * the field is. Markdown fields get tabs, a small toolbar and a live, sanitized preview.
 */
@Component({
  selector: 'app-localized-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <fieldset class="min-w-0">
      <legend class="a-label">
        {{ field().label }}
        @if (field().required) {
          <span class="text-danger" aria-hidden="true">*</span>
          <span class="sr-only">(English is required)</span>
        }
      </legend>
      @if (field().help) {
        <p class="a-help -mt-1 mb-2">{{ field().help }}</p>
      }

      @if (markdown()) {
        <div role="tablist" [attr.aria-label]="field().label + ' language'" class="flex gap-2">
          @for (option of options; track option.code) {
            <button
              type="button"
              role="tab"
              class="a-btn min-h-10 px-3 text-sm"
              [id]="id() + '-tab-' + option.code"
              [attr.aria-selected]="active() === option.code"
              [attr.aria-controls]="id() + '-panel'"
              [style.--btn-bg]="active() === option.code ? 'var(--c-sun)' : 'var(--surface)'"
              [style.--btn-fg]="'var(--on-color)'"
              (click)="active.set(option.code)"
            >
              {{ option.code.toUpperCase() }}
              @if (hasText(option.code)) {
                <span class="sr-only">(has text)</span>
                <span aria-hidden="true">●</span>
              }
            </button>
          }
        </div>

        <div
          [id]="id() + '-panel'"
          role="tabpanel"
          [attr.aria-labelledby]="id() + '-tab-' + active()"
          class="mt-2 grid gap-3 lg:grid-cols-2"
        >
          <div>
            <div class="mb-2 flex flex-wrap gap-1" role="toolbar" aria-label="Formatting">
              @for (tool of tools; track tool.id) {
                <button
                  type="button"
                  class="a-btn min-h-9 min-w-9 px-2 text-sm"
                  [attr.aria-label]="tool.label"
                  [title]="tool.label"
                  (click)="apply(tool)"
                >
                  {{ tool.text }}
                </button>
              }
            </div>
            <textarea
              #editor
              class="a-input font-mono text-sm"
              rows="14"
              [id]="id() + '-input'"
              [formControl]="control(active())"
              [attr.dir]="current().dir"
              [attr.lang]="current().code"
              [attr.aria-invalid]="control(active()).invalid && control(active()).touched"
              [attr.aria-describedby]="id() + '-error'"
              [attr.aria-label]="field().label + ' (' + current().label + ')'"
            ></textarea>
          </div>
          <div>
            <p class="a-label">Preview</p>
            <div
              class="a-card prose-preview min-h-40 overflow-auto p-4"
              [attr.dir]="current().dir"
              [attr.lang]="current().code"
              [innerHTML]="preview()"
            ></div>
          </div>
        </div>
        <p class="a-error" [id]="id() + '-error'" role="alert">{{ firstError() }}</p>
      } @else {
        <div class="grid gap-3">
          @for (option of options; track option.code) {
            <div>
              <label class="a-help mt-0! mb-1 block font-semibold" [for]="id() + '-' + option.code">
                {{ option.label }}
                @if (option.code === 'en' && field().required) {
                  <span class="font-normal">(required)</span>
                }
              </label>
              @if (field().type === 'localizedText') {
                <textarea
                  class="a-input"
                  rows="4"
                  [id]="id() + '-' + option.code"
                  [formControl]="control(option.code)"
                  [attr.dir]="option.dir"
                  [attr.lang]="option.code"
                  [attr.aria-invalid]="control(option.code).invalid && control(option.code).touched"
                  [attr.aria-describedby]="id() + '-' + option.code + '-error'"
                ></textarea>
              } @else {
                <input
                  type="text"
                  class="a-input"
                  [id]="id() + '-' + option.code"
                  [formControl]="control(option.code)"
                  [attr.dir]="option.dir"
                  [attr.lang]="option.code"
                  [attr.aria-invalid]="control(option.code).invalid && control(option.code).touched"
                  [attr.aria-describedby]="id() + '-' + option.code + '-error'"
                />
              }
              <p class="a-error" [id]="id() + '-' + option.code + '-error'" role="alert">
                {{ error(option.code) }}
              </p>
            </div>
          }
        </div>
      }
    </fieldset>
  `,
})
export class LocalizedField {
  readonly group = input.required<FormGroup>();
  readonly field = input.required<FieldDef>();
  /** Unique prefix for element ids (the field key plus an optional row index). */
  readonly idPrefix = input<string>('');

  protected readonly options = LOCALES;
  protected readonly tools = TOOLS;
  protected readonly active = signal<Locale>('en');
  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  private readonly version = trackControl(() => this.group());

  protected readonly id = computed(
    () => `f-${this.idPrefix()}${this.field().key.replace(/\./g, '-')}`,
  );
  protected readonly markdown = computed(() => this.field().type === 'markdown');
  protected readonly current = computed(
    () => LOCALES.find((l) => l.code === this.active()) as LocaleOption,
  );

  protected readonly preview = computed(() => {
    this.version();
    return renderMarkdown(String(this.control(this.active()).value ?? ''));
  });

  protected control(code: Locale): FormControl<string> {
    return this.group().get(code) as FormControl<string>;
  }

  protected hasText(code: Locale): boolean {
    this.version();
    return String(this.control(code).value ?? '').trim().length > 0;
  }

  protected error(code: Locale): string {
    this.version();
    const control = this.control(code);
    return control.touched ? describeErrors(control) : '';
  }

  /** The first problem across the three languages, for the single Markdown error line. */
  protected firstError(): string {
    this.version();
    for (const option of LOCALES) {
      const message = this.error(option.code);
      if (message) return `${option.label}: ${message}`;
    }
    return '';
  }

  protected apply(tool: (typeof TOOLS)[number]): void {
    const element = this.editor()?.nativeElement;
    const control = this.control(this.active());
    if (!element) return;

    const { selectionStart: start, selectionEnd: end, value } = element;
    let next: string;
    let from: number;
    let to: number;

    if ('line' in tool && tool.line) {
      // Headings and lists belong at the start of the line, wherever the cursor is in it.
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      next = `${value.slice(0, lineStart)}${tool.before}${value.slice(lineStart)}`;
      from = start + tool.before.length;
      to = end + tool.before.length;
    } else {
      const selected = value.slice(start, end) || tool.placeholder;
      next = `${value.slice(0, start)}${tool.before}${selected}${tool.after}${value.slice(end)}`;
      from = start + tool.before.length;
      to = from + selected.length;
    }

    control.setValue(next);
    control.markAsDirty();
    queueMicrotask(() => {
      element.focus();
      element.setSelectionRange(from, to);
    });
  }
}
