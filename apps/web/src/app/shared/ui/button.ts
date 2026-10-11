import { Directive, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary';

/** Styles a native `<button>` or `<a>` as a button, so semantics stay native. */
@Directive({
  selector: 'button[appButton], a[appButton]',
  host: { class: 'btn', '[class.btn-primary]': "variant() === 'primary'" },
})
export class Button {
  readonly variant = input<ButtonVariant>('secondary');
}
