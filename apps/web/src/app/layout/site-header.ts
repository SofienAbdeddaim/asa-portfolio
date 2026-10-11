import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CommandService } from '../core/command.service';
import { ContentStore } from '../core/content.store';
import { LocaleService } from '../core/locale.service';
import { SECTIONS, ScrollSpy } from '../core/sections';
import { Icon } from '../shared/ui/icon';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';

@Component({
  selector: 'app-site-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, Icon, LanguageSwitcher, ThemeToggle],
  template: `
    <header
      class="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] backdrop-blur-md"
    >
      <div class="container-page flex min-h-16 items-center gap-6">
        <a
          [routerLink]="['/', locale.locale()]"
          class="inline-flex min-h-11 items-center gap-2.5 font-display font-semibold"
        >
          <img class="size-8" src="/favicon.svg" alt="" width="32" height="32" />
          <span>{{ store.content()?.profile?.fullName ?? ('app.brand' | transloco) }}</span>
        </a>

        <nav class="ms-auto hidden xl:block" [attr.aria-label]="'nav.label' | transloco">
          <ul class="flex items-center gap-5 text-sm">
            @for (section of sections; track section.id) {
              <li>
                <a
                  [routerLink]="['/', locale.locale()]"
                  [fragment]="section.id"
                  class="nav-link inline-flex min-h-11 items-center"
                  [attr.aria-current]="spy.active() === section.id ? 'true' : null"
                  >{{ 'nav.' + section.id | transloco }}</a
                >
              </li>
            }
            <li>
              <a
                [routerLink]="['/', locale.locale(), 'blog']"
                routerLinkActive
                #blog="routerLinkActive"
                [attr.aria-current]="blog.isActive ? 'page' : null"
                class="nav-link inline-flex min-h-11 items-center"
                >{{ 'nav.blog' | transloco }}</a
              >
            </li>
          </ul>
        </nav>

        <div class="ms-auto flex items-center gap-1 xl:ms-0">
          <button
            type="button"
            class="btn btn-ghost size-10 min-h-10 px-0"
            [attr.aria-label]="'palette.open' | transloco"
            (click)="commands.show()"
          >
            <app-icon name="search" />
          </button>
          <app-language-switcher class="hidden sm:block" />
          <app-theme-toggle />
          <a
            [routerLink]="['/', locale.locale(), 'cv']"
            routerLinkActive
            #cv="routerLinkActive"
            [attr.aria-current]="cv.isActive ? 'page' : null"
            class="btn ms-2 hidden min-h-9 px-3 text-sm sm:inline-flex"
            >{{ 'nav.cv' | transloco }}</a
          >
          <button
            type="button"
            class="btn btn-ghost size-10 min-h-10 px-0 xl:hidden"
            popovertarget="mobile-menu"
            [attr.aria-label]="'nav.menu' | transloco"
          >
            <app-icon name="menu" />
          </button>
        </div>
      </div>

      <div
        #menu
        id="mobile-menu"
        popover
        class="card fixed inset-x-4 top-20 m-0 w-auto max-w-md p-2 shadow-xl sm:mx-auto sm:mt-0"
        style="position: fixed"
      >
        <nav [attr.aria-label]="'nav.label' | transloco">
          <ul class="grid">
            @for (section of sections; track section.id) {
              <li>
                <a
                  [routerLink]="['/', locale.locale()]"
                  [fragment]="section.id"
                  class="flex min-h-12 items-center rounded-md px-4 font-semibold hover:bg-surface-2"
                  (click)="menu.hidePopover()"
                  >{{ 'nav.' + section.id | transloco }}</a
                >
              </li>
            }
            @for (page of pages; track page) {
              <li>
                <a
                  [routerLink]="['/', locale.locale(), page]"
                  class="flex min-h-12 items-center rounded-md px-4 font-semibold hover:bg-surface-2"
                  (click)="menu.hidePopover()"
                  >{{ 'nav.' + page | transloco }}</a
                >
              </li>
            }
          </ul>
        </nav>
        <app-language-switcher class="mt-2 block border-t border-line px-2 pt-2 sm:hidden" />
      </div>
    </header>
  `,
})
export class SiteHeader {
  protected readonly locale = inject(LocaleService);
  protected readonly commands = inject(CommandService);
  protected readonly store = inject(ContentStore);
  protected readonly spy = inject(ScrollSpy);
  protected readonly sections = SECTIONS;
  protected readonly pages = ['blog', 'cv'] as const;
}
