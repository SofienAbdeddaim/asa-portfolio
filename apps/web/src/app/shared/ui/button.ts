import { Directive, computed, input } from '@angular/core';

export type StickerColor = 'sun' | 'coral' | 'mint' | 'sky' | 'lilac' | 'pink' | 'paper';

/** Styles a native `<button>` or `<a>` as a sticker button, so semantics stay native. */
@Directive({
  selector: 'button[appButton], a[appButton]',
  host: { class: 'btn', '[style.--btn-bg]': 'background()', '[style.--btn-fg]': 'foreground()' },
})
export class Button {
  readonly color = input<StickerColor>('sun');
  protected readonly foreground = computed(() =>
    this.color() === 'paper' ? 'var(--fg)' : 'var(--on-color)',
  );
  protected readonly background = computed(() =>
    this.color() === 'paper' ? 'var(--surface)' : `var(--c-${this.color()})`,
  );
}
