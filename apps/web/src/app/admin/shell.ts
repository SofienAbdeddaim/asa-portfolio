import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from './auth.store';
import { ConfirmService, ToastService } from './feedback';
import { RESOURCES } from './resources';

/** The signed-in frame: navigation, sign out, the shared confirm dialog and status messages. */
@Component({
  selector: 'app-admin-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a
      href="#admin-main"
      class="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-sun focus:px-4 focus:py-2 focus:font-bold focus:text-on-color"
      >Skip to content</a
    >

    <div class="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside class="border-b-[3px] border-ink bg-surface p-4 lg:border-e-[3px] lg:border-b-0">
        <div class="flex items-center justify-between gap-3 lg:block">
          <p class="font-display text-2xl font-extrabold">Back-office</p>
          <a
            class="a-btn min-h-10 px-3 text-sm lg:mt-3 lg:w-full"
            routerLink="/en"
            target="_blank"
            rel="noopener"
            >View site</a
          >
        </div>

        <nav aria-label="Content" class="mt-4">
          <ul class="flex list-none gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
            @for (resource of resources; track resource.key) {
              <li>
                <a
                  class="flex min-h-11 items-center whitespace-nowrap rounded-lg border-2 border-transparent px-3 font-semibold hover:border-ink aria-[current=page]:border-ink aria-[current=page]:bg-sun aria-[current=page]:text-on-color"
                  [routerLink]="['/admin', resource.key]"
                  routerLinkActive
                  #rla="routerLinkActive"
                  [attr.aria-current]="rla.isActive ? 'page' : null"
                  >{{ resource.label }}</a
                >
              </li>
            }
          </ul>
        </nav>

        <div class="mt-4 border-t-2 border-ink pt-4">
          <p class="truncate text-sm text-muted" [title]="auth.user()?.email ?? ''">
            {{ auth.user()?.email }}
          </p>
          <button type="button" class="a-btn mt-2 w-full" (click)="signOut()">Sign out</button>
        </div>
      </aside>

      <main id="admin-main" tabindex="-1" class="min-w-0 p-4 outline-none sm:p-8">
        <router-outlet />
      </main>
    </div>

    <div
      class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      @if (toasts.toast(); as toast) {
        <p
          class="a-card pointer-events-auto max-w-xl px-5 py-3 font-semibold"
          [style.background]="toast.kind === 'error' ? 'var(--surface)' : 'var(--c-mint)'"
          [style.color]="toast.kind === 'error' ? 'var(--danger)' : 'var(--on-color)'"
        >
          {{ toast.message }}
        </p>
      }
    </div>

    <dialog
      #dialog
      class="a-card m-auto w-[min(32rem,calc(100vw-2rem))] p-6 text-fg"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      (cancel)="confirmation.answer(false)"
    >
      @if (confirmation.request(); as request) {
        <h2 id="confirm-title" class="text-2xl">{{ request.title }}</h2>
        <p id="confirm-message" class="mt-3">{{ request.message }}</p>
        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" class="a-btn" (click)="confirmation.answer(false)">Cancel</button>
          <button
            type="button"
            class="a-btn"
            [class.a-btn-primary]="!request.danger"
            [style.--btn-bg]="request.danger ? 'var(--danger)' : null"
            [style.--btn-fg]="request.danger ? '#fff' : null"
            (click)="confirmation.answer(true)"
          >
            {{ request.confirmLabel }}
          </button>
        </div>
      }
    </dialog>
  `,
})
export class AdminShell {
  protected readonly auth = inject(AuthStore);
  protected readonly confirmation = inject(ConfirmService);
  protected readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly resources = RESOURCES;

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      const open = this.confirmation.request() !== null;
      if (open && !element.open) element.showModal();
      else if (!open && element.open) element.close();
    });
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/admin/login');
  }
}
