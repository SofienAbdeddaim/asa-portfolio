import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LOCALES } from '@asa/shared';
import { CommandService } from './core/command.service';
import { LocaleService } from './core/locale.service';
import { ScrollService } from './core/scroll.service';
import { ThemeService } from './core/theme.service';
import { CommandPalette } from './layout/command-palette';
import { LANGUAGE_NAMES, LanguageSwitcher } from './layout/language-switcher';
import { ThemeToggle } from './layout/theme-toggle';
import { Button } from './shared/ui/button';
import { Icon } from './shared/ui/icon';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    TranslocoPipe,
    Button,
    Icon,
    LanguageSwitcher,
    ThemeToggle,
    CommandPalette,
  ],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg"
      >{{ 'app.skipToContent' | transloco }}</a
    >

    <header
      class="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70"
    >
      <div class="container-page flex min-h-16 items-center justify-between gap-3">
        <a
          [routerLink]="['/', locale.locale()]"
          class="inline-flex min-h-11 items-center text-lg font-semibold tracking-tight"
          >{{ 'app.brand' | transloco }}</a
        >

        <div class="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            appButton
            variant="outline"
            class="px-3"
            [attr.aria-label]="'palette.open' | transloco"
            (click)="commands.show()"
          >
            <app-icon name="search" />
            <span class="ltr-island hidden items-center gap-1 text-xs text-muted sm:inline-flex">
              <kbd class="rounded border border-border px-1.5 py-0.5 font-mono">Ctrl</kbd>
              <kbd class="rounded border border-border px-1.5 py-0.5 font-mono">K</kbd>
            </span>
          </button>
          <app-language-switcher />
          <app-theme-toggle />
        </div>
      </div>
    </header>

    <main id="main" tabindex="-1" class="container-page py-10 outline-none sm:py-16">
      <router-outlet />
    </main>

    <footer class="border-t border-border py-8 text-sm text-muted">
      <div class="container-page">{{ 'footer.note' | transloco }}</div>
    </footer>

    <app-command-palette />
  `,
})
export class App {
  protected readonly locale = inject(LocaleService);
  protected readonly commands = inject(CommandService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly theme = inject(ThemeService);

  constructor() {
    inject(ScrollService).start();

    // Labels are translated, so the shell's commands are rebuilt whenever the language changes.
    effect(() => {
      this.locale.revision(); // translations finished loading
      const current = this.locale.locale();
      const t = (key: string, params?: Record<string, unknown>) =>
        this.transloco.translate(key, params, current);
      const languageGroup = t('commands.group.language');

      this.commands.register('shell', [
        {
          id: 'home',
          label: t('commands.goHome'),
          group: t('commands.group.navigate'),
          run: () => void this.router.navigate(['/', current]),
        },
        ...LOCALES.filter((code) => code !== current).map((code) => ({
          id: `lang-${code}`,
          label: t('language.switchTo', { language: LANGUAGE_NAMES[code] }),
          keywords: `${code} ${LANGUAGE_NAMES[code]} ${t(`language.names.${code}`)}`,
          group: languageGroup,
          run: () => void this.router.navigateByUrl(this.locale.urlFor(code)),
        })),
        {
          id: 'theme',
          label: t('commands.toggleTheme'),
          keywords: 'dark light system',
          group: t('commands.group.appearance'),
          run: () => this.theme.cycle(),
        },
      ]);
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.commands.toggle();
    }
  }
}
