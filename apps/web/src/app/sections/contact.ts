import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Locale, Profile, Social } from '@asa/shared';
import { Reveal } from '../core/reveal.directive';
import { Button } from '../shared/ui/button';
import { Icon, type IconName } from '../shared/ui/icon';

const SOCIAL: Record<Social['kind'], { label: string; icon: IconName }> = {
  github: { label: 'GitHub', icon: 'github' },
  linkedin: { label: 'LinkedIn', icon: 'linkedin' },
  x: { label: 'X', icon: 'x' },
  website: { label: 'Website', icon: 'globe' },
  other: { label: 'Link', icon: 'external' },
};

@Component({
  selector: 'app-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, Reveal, Button, Icon],
  template: `
    <section id="contact" class="section" aria-labelledby="contact-title">
      <div class="container-page section-grid">
        <p class="eyebrow self-start lg:sticky lg:top-24">{{ 'contact.eyebrow' | transloco }}</p>

        <div appReveal>
          <h2 id="contact-title" class="section-title">{{ 'contact.title' | transloco }}</h2>
          <p class="mt-3 max-w-xl text-lg text-muted">{{ 'contact.lead' | transloco }}</p>

          @if (profile(); as p) {
            <p class="mt-8">
              <a
                class="ltr-island inline-block font-display text-[clamp(1.4rem,3.6vw,2.25rem)] font-semibold break-all underline decoration-1 underline-offset-[6px] transition-[text-underline-offset,color] duration-300 hover:text-accent hover:underline-offset-[10px]"
                [href]="'mailto:' + p.email"
                >{{ p.email }}</a
              >
            </p>

            <div class="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" appButton variant="primary" (click)="copy(p.email)">
                <app-icon [name]="copied() ? 'check' : 'copy'" />
                {{ 'contact.copy' | transloco }}
              </button>
              <a appButton [routerLink]="['/', locale(), 'cv']">
                {{ 'contact.cv' | transloco }}
                <app-icon name="arrow" [mirror]="true" class="btn-arrow" />
              </a>
              <span role="status" class="text-sm text-muted">{{
                copied() ? ('contact.copied' | transloco) : ''
              }}</span>
            </div>

            @if (socials().length) {
              <div class="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2">
                <h3 class="text-sm font-normal tracking-normal text-muted">
                  {{ 'contact.elsewhere' | transloco }}
                </h3>
                <ul class="flex flex-wrap gap-x-6 gap-y-2">
                  @for (social of socials(); track social.url) {
                    <li>
                      <a
                        class="nav-link inline-flex min-h-11 items-center gap-2 font-semibold"
                        [href]="social.url"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <app-icon [name]="social.icon" />
                        {{ social.label }}
                        <span class="sr-only">({{ 'common.newTab' | transloco }})</span>
                      </a>
                    </li>
                  }
                </ul>
              </div>
            }
          }
        </div>
      </div>
    </section>
  `,
})
export class Contact {
  readonly profile = input.required<Profile | null>();
  readonly locale = input<Locale>('en');

  protected readonly copied = signal(false);
  protected readonly socials = computed(() =>
    (this.profile()?.socials ?? []).map((social) => ({ ...SOCIAL[social.kind], url: social.url })),
  );

  protected async copy(email: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      return; // Clipboard can be blocked; the address stays visible and selectable.
    }
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2500);
  }
}
