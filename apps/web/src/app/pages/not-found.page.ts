import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../core/locale.service';
import { Button } from '../shared/ui/button';
import { Icon } from '../shared/ui/icon';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, Button, Icon],
  template: `
    <section class="reveal max-w-xl">
      <p class="font-mono text-sm text-accent"><code>404</code></p>
      <h1 class="mt-3 text-4xl">{{ 'notFound.title' | transloco }}</h1>
      <p class="mt-4 text-lg text-muted">{{ 'notFound.body' | transloco }}</p>
      <a appButton class="mt-8" [routerLink]="['/', locale.locale()]">
        <app-icon name="home" />
        {{ 'notFound.back' | transloco }}
      </a>
    </section>
  `,
})
export class NotFoundPage {
  protected readonly locale = inject(LocaleService);
}
