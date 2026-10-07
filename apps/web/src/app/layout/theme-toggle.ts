import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { prefersReducedMotion } from '../core/motion';
import { ThemeService } from '../core/theme.service';
import { Icon, type IconName } from '../shared/ui/icon';

const ICONS: Record<string, IconName> = { light: 'sun', dark: 'moon', system: 'monitor' };

type TransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslocoPipe],
  template: `
    <button
      type="button"
      class="btn size-12 min-h-12 px-0"
      style="--btn-bg: var(--surface); --btn-fg: var(--fg)"
      [attr.aria-label]="'theme.current' | transloco: { theme: label() }"
      (click)="cycle($event)"
    >
      <app-icon [name]="icon()" />
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT) as TransitionDocument;
  private readonly transloco = inject(TranslocoService);

  protected readonly icon = computed(() => ICONS[this.theme.preference()] ?? 'monitor');
  protected readonly label = computed(() =>
    this.transloco.translate(`theme.${this.theme.preference()}`),
  );

  /** The new theme grows out of the button as a circle (View Transitions API, where available). */
  protected cycle(event: MouseEvent): void {
    const button = event.currentTarget as HTMLElement;
    const box = button.getBoundingClientRect();
    const root = this.document.documentElement;
    root.style.setProperty('--vt-x', `${box.left + box.width / 2}px`);
    root.style.setProperty('--vt-y', `${box.top + box.height / 2}px`);

    const animate = !prefersReducedMotion();
    if (animate && this.document.startViewTransition) {
      this.document.startViewTransition(() => this.theme.cycle());
    } else {
      this.theme.cycle();
    }
  }
}
