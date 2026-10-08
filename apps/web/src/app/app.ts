import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LOCALES } from '@asa/shared';
import { CommandService, type Command } from './core/command.service';
import { LocaleService } from './core/locale.service';
import { SECTIONS, goToSection } from './core/sections';
import { ScrollService } from './core/scroll.service';
import { ThemeService } from './core/theme.service';
import { CommandPalette } from './layout/command-palette';
import { LANGUAGE_NAMES } from './layout/language-switcher';
import { SiteHeader } from './layout/site-header';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TranslocoPipe, SiteHeader, CommandPalette],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    @if (!admin()) {
      <a
        href="#main"
        class="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-xl focus:border-[3px] focus:border-ink focus:bg-sun focus:px-4 focus:py-2 focus:font-bold focus:text-on-color"
        >{{ 'app.skipToContent' | transloco }}</a
      >

      <div
        class="scroll-progress pointer-events-none fixed inset-x-0 top-0 z-50 h-1.5 bg-coral"
        style="transform: scaleX(0)"
        aria-hidden="true"
      ></div>

      <app-site-header />
    }

    <!-- One outlet for both areas. The back-office pages bring their own landmarks. -->
    <div
      [class.pb-10]="!admin()"
      [attr.role]="admin() ? null : 'main'"
      [attr.id]="admin() ? null : 'main'"
      [attr.tabindex]="admin() ? null : -1"
      class="outline-none"
    >
      <router-outlet />
    </div>

    @if (!admin()) {
      <footer class="mt-10 border-t-[3px] border-ink bg-surface py-8">
        <div
          class="container-page flex flex-wrap items-center justify-between gap-4 text-sm font-medium"
        >
          <p>{{ 'footer.note' | transloco }}</p>
          <a href="#main" class="btn min-h-11 text-sm" style="--btn-bg: var(--c-sun)">{{
            'footer.top' | transloco
          }}</a>
        </div>
      </footer>

      <app-command-palette />
    }
  `,
})
export class App {
  protected readonly locale = inject(LocaleService);
  protected readonly commands = inject(CommandService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  /** The back-office runs without the public header, footer and palette. */
  protected readonly admin = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.startsWith('/admin')),
    ),
    { initialValue: this.router.url.startsWith('/admin') },
  );
  private readonly transloco = inject(TranslocoService);
  private readonly theme = inject(ThemeService);

  constructor() {
    inject(ScrollService).start();

    // Labels are translated, so the shell's commands are rebuilt whenever translations load.
    effect(() => {
      this.locale.revision(); // translations finished loading
      const current = this.locale.locale();
      const t = (key: string, params?: Record<string, unknown>) =>
        this.transloco.translate(key, params, current);
      const navigate = t('commands.group.navigate');
      const languageGroup = t('commands.group.language');

      const sectionCommands: Command[] = SECTIONS.map(({ id }) => ({
        id: `go-${id}`,
        label: t('commands.goTo', { section: t(`nav.${id}`) }),
        keywords: t(`nav.${id}`),
        group: navigate,
        run: () => {
          if (this.router.url.split(/[?#]/)[0] !== `/${current}`) {
            void this.router.navigate(['/', current], { fragment: id });
          } else {
            goToSection(this.document, id);
          }
        },
      }));

      const pageCommands: Command[] = (['blog', 'cv'] as const).map((id) => ({
        id: `go-${id}`,
        label: t('commands.goTo', { section: t(`nav.${id}`) }),
        keywords: t(`nav.${id}`),
        group: navigate,
        run: () => void this.router.navigate(['/', current, id]),
      }));

      this.commands.register('shell', [
        {
          id: 'home',
          label: t('commands.goHome'),
          keywords: t('nav.home'),
          group: navigate,
          run: () => void this.router.navigate(['/', current]).then(() => scrollTo({ top: 0 })),
        },
        ...sectionCommands,
        ...pageCommands,
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
        {
          id: 'confetti',
          label: t('commands.confetti'),
          keywords: 'party celebrate fun',
          group: t('commands.group.fun'),
          run: () =>
            void import('./core/confetti').then(({ confetti }) =>
              confetti(innerWidth / 2, innerHeight / 3, 60),
            ),
        },
      ]);
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.admin() && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.commands.toggle();
    }
  }
}
