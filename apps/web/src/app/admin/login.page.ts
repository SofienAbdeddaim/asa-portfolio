import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminApi, type Enrollment } from './admin-api';
import { apiMessage } from './api-error';
import { AuthStore } from './auth.store';

type Step = 'credentials' | 'verify' | 'enroll' | 'recovery-codes';

const CODE_PATTERN = /^\d{6}$/;
const RECOVERY_PATTERN = /^[0-9a-fA-F]{5}-[0-9a-fA-F]{5}$/;

/**
 * Sign-in: password, then a mandatory second factor. The first sign-in enrolls an authenticator
 * app and shows one-time recovery codes. The short-lived challenge from the first step is only
 * held in memory here.
 */
@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <main class="container-page grid min-h-dvh place-items-center py-10">
      <div
        class="a-card w-full max-w-md p-6 sm:p-8"
        style="box-shadow: calc(var(--dir-sign) * 8px) 8px 0 var(--ink)"
      >
        <p class="eyebrow">Back-office</p>
        <h1 class="mt-2 text-4xl" id="login-title" tabindex="-1">{{ heading() }}</h1>

        @if (error()) {
          <p class="a-error mt-4 rounded-lg border-2 border-danger p-3" role="alert">
            {{ error() }}
          </p>
        }

        @switch (step()) {
          @case ('credentials') {
            <form
              class="mt-6 grid gap-4"
              [formGroup]="credentials"
              (ngSubmit)="submitCredentials()"
              novalidate
            >
              <div>
                <label class="a-label" for="login-email">Email</label>
                <input
                  id="login-email"
                  class="a-input"
                  type="email"
                  autocomplete="username"
                  formControlName="email"
                  [attr.aria-invalid]="invalid(credentials, 'email')"
                />
              </div>
              <div>
                <label class="a-label" for="login-password">Password</label>
                <input
                  id="login-password"
                  class="a-input"
                  type="password"
                  autocomplete="current-password"
                  formControlName="password"
                  [attr.aria-invalid]="invalid(credentials, 'password')"
                />
              </div>
              <button class="a-btn a-btn-primary" type="submit" [disabled]="busy()">
                {{ busy() ? 'Checking…' : 'Continue' }}
              </button>
            </form>
          }

          @case ('verify') {
            <form
              class="mt-6 grid gap-4"
              [formGroup]="verification"
              (ngSubmit)="submitVerification()"
              novalidate
            >
              @if (!useRecovery()) {
                <div>
                  <label class="a-label" for="login-code">6-digit code</label>
                  <input
                    id="login-code"
                    class="a-input text-center font-mono text-2xl tracking-[0.4em]"
                    type="text"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    formControlName="code"
                    [attr.aria-invalid]="invalid(verification, 'code')"
                  />
                  <p class="a-help">From your authenticator app.</p>
                </div>
              } @else {
                <div>
                  <label class="a-label" for="login-recovery">Recovery code</label>
                  <input
                    id="login-recovery"
                    class="a-input font-mono"
                    type="text"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder="a1b2c-3d4e5"
                    formControlName="recovery"
                    [attr.aria-invalid]="invalid(verification, 'recovery')"
                  />
                  <p class="a-help">Each recovery code works once.</p>
                </div>
              }
              <button class="a-btn a-btn-primary" type="submit" [disabled]="busy()">
                {{ busy() ? 'Checking…' : 'Sign in' }}
              </button>
              <button class="a-btn" type="button" (click)="toggleRecovery()">
                {{ useRecovery() ? 'Use an authenticator code' : 'Use a recovery code' }}
              </button>
            </form>
          }

          @case ('enroll') {
            @if (enrollment(); as e) {
              <p class="mt-4">
                Two-factor authentication is required. Scan this code with an authenticator app,
                then enter the 6-digit code it shows.
              </p>
              <img
                class="mx-auto mt-4 size-48 rounded-lg border-2 border-ink bg-white p-2"
                [src]="e.qrDataUrl"
                alt="QR code to add this account to your authenticator app"
                width="192"
                height="192"
              />
              <p class="a-help mt-3 text-center">Can't scan? Enter this key by hand:</p>
              <p
                class="mt-1 break-all rounded-lg bg-surface-2 p-3 text-center font-mono text-sm"
                data-testid="secret"
              >
                <code>{{ e.secret }}</code>
              </p>
              <form
                class="mt-6 grid gap-4"
                [formGroup]="verification"
                (ngSubmit)="submitEnrollment()"
                novalidate
              >
                <div>
                  <label class="a-label" for="enroll-code">6-digit code</label>
                  <input
                    id="enroll-code"
                    class="a-input text-center font-mono text-2xl tracking-[0.4em]"
                    type="text"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    formControlName="code"
                    [attr.aria-invalid]="invalid(verification, 'code')"
                  />
                </div>
                <button class="a-btn a-btn-primary" type="submit" [disabled]="busy()">
                  {{ busy() ? 'Checking…' : 'Turn on two-factor authentication' }}
                </button>
              </form>
            }
          }

          @case ('recovery-codes') {
            <p class="mt-4">
              Two-factor authentication is on. Save these recovery codes somewhere safe. Each works
              once if you lose your authenticator, and they won't be shown again.
            </p>
            <ul
              class="mt-4 grid list-none grid-cols-2 gap-2 rounded-lg bg-surface-2 p-4 font-mono"
              data-testid="recovery-codes"
            >
              @for (code of recoveryCodes(); track code) {
                <li>
                  <code>{{ code }}</code>
                </li>
              }
            </ul>
            <div class="mt-4 flex flex-wrap gap-2">
              <button class="a-btn" type="button" (click)="copyCodes()">
                {{ copied() ? 'Copied' : 'Copy codes' }}
              </button>
            </div>
            <label class="mt-5 flex items-start gap-3">
              <input
                type="checkbox"
                class="mt-1 size-5 accent-[var(--ink)]"
                [checked]="saved()"
                (change)="saved.set(!saved())"
              />
              <span>I have saved these recovery codes.</span>
            </label>
            <button
              class="a-btn a-btn-primary mt-5 w-full"
              type="button"
              [disabled]="!saved()"
              (click)="finish()"
            >
              Open the back-office
            </button>
          }
        }
      </div>
    </main>
  `,
})
export class LoginPage {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly step = signal<Step>('credentials');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly enrollment = signal<Enrollment | null>(null);
  protected readonly recoveryCodes = signal<string[]>([]);
  protected readonly useRecovery = signal(false);
  protected readonly saved = signal(false);
  protected readonly copied = signal(false);

  /** Held in memory only, valid for five minutes. */
  private challenge = '';

  protected readonly credentials = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly verification = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(CODE_PATTERN)],
    }),
    recovery: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(RECOVERY_PATTERN)],
    }),
  });

  protected heading(): string {
    switch (this.step()) {
      case 'credentials':
        return 'Sign in';
      case 'verify':
        return 'Two-factor check';
      case 'enroll':
        return 'Set up two-factor';
      default:
        return 'Save your recovery codes';
    }
  }

  protected invalid(group: FormGroup, name: string): boolean {
    const control = group.get(name);
    return !!control && control.invalid && control.touched;
  }

  protected async submitCredentials(): Promise<void> {
    this.credentials.markAllAsTouched();
    if (this.credentials.invalid) {
      this.error.set('Enter your email and password.');
      return;
    }
    await this.run(async () => {
      const { email, password } = this.credentials.getRawValue();
      const result = await this.api.login(email, password);
      this.challenge = result.challenge;
      this.credentials.controls.password.reset('');
      if (result.mfaEnrolled) {
        this.step.set('verify');
      } else {
        this.enrollment.set(await this.api.beginEnrollment(this.challenge));
        this.step.set('enroll');
      }
    }, 'Email or password is incorrect.');
  }

  protected toggleRecovery(): void {
    this.useRecovery.update((value) => !value);
    this.verification.reset();
    this.error.set('');
  }

  protected async submitVerification(): Promise<void> {
    const { code, recovery } = this.verification.getRawValue();
    const proof = this.useRecovery()
      ? RECOVERY_PATTERN.test(recovery)
        ? { recoveryCode: recovery.toLowerCase() }
        : null
      : CODE_PATTERN.test(code)
        ? { code }
        : null;
    if (!proof) {
      this.verification.markAllAsTouched();
      this.error.set(
        this.useRecovery() ? 'Enter a recovery code like a1b2c-3d4e5.' : 'Enter the 6-digit code.',
      );
      return;
    }
    await this.run(async () => {
      await this.api.verify(this.challenge, proof);
      await this.open();
    }, 'That code was not accepted. Check the code and try again.');
  }

  protected async submitEnrollment(): Promise<void> {
    const { code } = this.verification.getRawValue();
    if (!CODE_PATTERN.test(code)) {
      this.verification.markAllAsTouched();
      this.error.set('Enter the 6-digit code.');
      return;
    }
    await this.run(async () => {
      const result = await this.api.enable(this.challenge, code);
      this.recoveryCodes.set(result.recoveryCodes);
      this.enrollment.set(null);
      this.step.set('recovery-codes');
    }, 'That code was not accepted. Check the code and try again.');
  }

  protected async copyCodes(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.recoveryCodes().join('\n'));
      this.copied.set(true);
    } catch {
      this.error.set('Copying was blocked. Select the codes and copy them by hand.');
    }
  }

  protected async finish(): Promise<void> {
    await this.run(() => this.open(), 'Could not open the back-office.');
  }

  private async open(): Promise<void> {
    await this.auth.signedIn();
    this.recoveryCodes.set([]);
    await this.router.navigateByUrl('/admin');
  }

  /** Runs a step with a busy flag, mapping failures to plain messages. */
  private async run(action: () => Promise<void>, rejected: string): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        const detail = (error.error as { message?: string } | null)?.message;
        if (detail === 'Invalid or expired token') {
          // The five-minute challenge from the password step ran out.
          this.step.set('credentials');
          this.verification.reset();
          this.error.set('That took too long and the sign-in expired. Start again.');
        } else {
          this.error.set(rejected);
        }
      } else {
        this.error.set(apiMessage(error));
      }
    } finally {
      this.busy.set(false);
    }
  }
}
