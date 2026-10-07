import { Directive, computed, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'outline' | 'ghost';

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium ' +
  'transition-colors disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  outline: 'border border-border bg-surface text-fg hover:bg-surface-2',
  ghost: 'text-fg hover:bg-surface-2',
};

/** Styles a native `<button>` or `<a>` as a button, so semantics stay native. */
@Directive({
  selector: 'button[appButton], a[appButton]',
  host: { '[class]': 'classes()' },
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  protected readonly classes = computed(() => `${BASE} ${VARIANTS[this.variant()]}`);
}
