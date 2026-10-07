import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CommandService } from '../core/command.service';
import { LocaleService } from '../core/locale.service';
import { SECTIONS, ScrollSpy } from '../core/sections';
import { Icon } from '../shared/ui/icon';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';

@Component({
  selector: 'app-site-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, Icon, LanguageSwitcher, ThemeToggle],
  template: `
    <header class="sticky top-3 z-40 px-3 sm:px-6">
      <div
        class="sticker mx-auto flex max-w-[76rem] items-center justify-between gap-2 rounded-full py-2 ps-4 pe-2"
        style="--shadow: 4px"
      >
        <a
          [routerLink]="['/', locale.locale()]"
          class="group inline-flex min-h-11 items-center gap-2 font-display text-2xl font-extrabold"
          (click)="brandClick($event)"
        >
          <app-icon
            name="star"
            class="size-8 text-sun transition-transform duration-500 group-hover:rotate-[216deg] [&_svg]:fill-current [&_svg]:stroke-ink"
          />
          {{ 'app.brand' | transloco }}
        </a>

        <nav class="hidden xl:block" [attr.aria-label]="'nav.label' | transloco">
          <ul class="flex items-center gap-1">
            @for (section of sections; track section.id) {
              <li>
                <a
                  [routerLink]="['/', locale.locale()]"
                  [fragment]="section.id"
                  class="inline-flex min-h-11 items-center rounded-full border-2 border-transparent px-4 text-sm font-bold hover:border-ink aria-[current=true]:border-ink aria-[current=true]:text-on-color"
                  [style.background]="spy.active() === section.id ? section.color : null"
                  [attr.aria-current]="spy.active() === section.id ? 'true' : null"
                  >{{ 'nav.' + section.id | transloco }}</a
                >
              </li>
            }
          </ul>
        </nav>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn size-12 min-h-12 px-0 sm:w-auto sm:px-4"
            style="--btn-bg: var(--surface); --btn-fg: var(--fg)"
            [attr.aria-label]="'palette.open' | transloco"
            (click)="commands.show()"
          >
            <app-icon name="search" />
            <span class="ltr-island hidden items-center gap-1 text-xs font-bold sm:inline-flex">
              <kbd>Ctrl</kbd>
              <kbd>K</kbd>
            </span>
          </button>
          <app-language-switcher class="hidden sm:block" />
          <app-theme-toggle />
          <button
            type="button"
            class="btn size-12 min-h-12 px-0 xl:hidden"
            style="--btn-bg: var(--c-coral)"
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
        class="sticker fixed inset-x-4 top-24 m-0 w-auto max-w-md p-3 sm:mx-auto sm:mt-0"
        style="--shadow: 8px; position: fixed"
      >
        <nav [attr.aria-label]="'nav.label' | transloco">
          <ul class="grid gap-2">
            @for (section of sections; track section.id) {
              <li>
                <a
                  [routerLink]="['/', locale.locale()]"
                  [fragment]="section.id"
                  class="flex min-h-12 items-center rounded-xl border-[3px] border-ink px-4 text-lg font-bold text-on-color"
                  [style.background]="section.color"
                  (click)="menu.hidePopover()"
                  >{{ 'nav.' + section.id | transloco }}</a
                >
              </li>
            }
          </ul>
        </nav>
        <app-language-switcher class="mt-4 block sm:hidden" />
      </div>
    </header>
  `,
})
export class SiteHeader {
  protected readonly locale = inject(LocaleService);
  protected readonly commands = inject(CommandService);
  protected readonly spy = inject(ScrollSpy);
  protected readonly sections = SECTIONS;

  /** Tiny easter egg: the logo throws confetti, then navigates home as usual. */
  protected async brandClick(event: MouseEvent): Promise<void> {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const { confetti } = await import('../core/confetti');
    confetti(box.left + 40, box.top + box.height / 2, 18);
  }
}
