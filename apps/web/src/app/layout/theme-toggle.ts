import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ThemeService } from '../core/theme.service';
import { Button } from '../shared/ui/button';
import { Icon, type IconName } from '../shared/ui/icon';

const ICONS: Record<string, IconName> = { light: 'sun', dark: 'moon', system: 'monitor' };

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Icon, TranslocoPipe],
  template: `
    <button
      type="button"
      appButton
      variant="ghost"
      class="px-3!"
      [attr.aria-label]="'theme.current' | transloco: { theme: label() }"
      (click)="theme.cycle()"
    >
      <app-icon [name]="icon()" />
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  private readonly transloco = inject(TranslocoService);

  protected readonly icon = computed(() => ICONS[this.theme.preference()] ?? 'monitor');
  protected readonly label = computed(() =>
    this.transloco.translate(`theme.${this.theme.preference()}`),
  );
}
