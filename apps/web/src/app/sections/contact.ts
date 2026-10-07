import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Profile, Social } from '@asa/shared';
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
  imports: [TranslocoPipe, Reveal, Button, Icon],
  template: `
    <section id="contact" class="container-page py-20" aria-labelledby="contact-title">
      <div
        appReveal
        class="sticker sticker-color relative overflow-hidden p-8 sm:p-14"
        style="--sticker-bg: var(--c-coral); --shadow: 12px"
      >
        <span
          class="anim-spin pointer-events-none absolute -end-10 -top-10 size-28 opacity-90 sm:-end-16 sm:-top-16 sm:size-56"
          style="--spin-time: 40s"
          aria-hidden="true"
        >
          <app-icon
            name="star"
            class="size-full text-sun [&_svg]:fill-current [&_svg]:stroke-ink"
          />
        </span>

        <p class="eyebrow">{{ 'contact.eyebrow' | transloco }}</p>
        <h2 id="contact-title" class="mt-4 max-w-3xl text-[clamp(2.75rem,8vw,6rem)]">
          {{ 'contact.title' | transloco }}
        </h2>
        <p class="mt-6 max-w-xl text-xl">{{ 'contact.lead' | transloco }}</p>

        @if (profile(); as p) {
          <p class="mt-10">
            <a
              class="ltr-island inline-block break-all font-display text-[clamp(1.5rem,4.5vw,3rem)] font-extrabold underline decoration-[6px] underline-offset-[10px] hover:decoration-wavy"
              [href]="'mailto:' + p.email"
              >{{ p.email }}</a
            >
          </p>

          <div class="mt-8 flex flex-wrap items-center gap-4">
            <button type="button" appButton color="paper" (click)="copy(p.email, $event)">
              <app-icon [name]="copied() ? 'check' : 'copy'" />
              {{ 'contact.copy' | transloco }}
            </button>
            <span role="status" class="font-semibold">{{
              copied() ? ('contact.copied' | transloco) : ''
            }}</span>
          </div>

          @if (socials().length) {
            <h3 class="mt-12 text-2xl">{{ 'contact.elsewhere' | transloco }}</h3>
            <ul class="mt-4 flex flex-wrap gap-4">
              @for (social of socials(); track social.url) {
                <li>
                  <a
                    class="btn min-h-12 min-w-12 px-4"
                    style="--btn-bg: var(--surface); --btn-fg: var(--fg)"
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
          }
        }
      </div>
    </section>
  `,
})
export class Contact {
  readonly profile = input.required<Profile | null>();

  protected readonly copied = signal(false);
  protected readonly socials = computed(() =>
    (this.profile()?.socials ?? []).map((social) => ({ ...SOCIAL[social.kind], url: social.url })),
  );

  protected async copy(email: string, event: Event): Promise<void> {
    // Read the button position now: `currentTarget` is cleared once the event finishes dispatching.
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      return; // Clipboard can be blocked; the address stays visible and selectable.
    }
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2500);

    const { confetti } = await import('../core/confetti');
    confetti(box.left + box.width / 2, box.top + box.height / 2);
  }
}
