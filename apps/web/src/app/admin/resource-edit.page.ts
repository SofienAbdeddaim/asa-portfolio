import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from './admin-api';
import { apiMessage } from './api-error';
import { ConfirmService, ToastService } from './feedback';
import { Field } from './fields/field';
import { buildForm, patchForm, toPayload } from './form-model';
import type { HasUnsavedChanges } from './guards';
import { findResource, type Entity, type ResourceDef } from './resources';

type Status = 'loading' | 'ready' | 'error' | 'missing';

/**
 * Create or edit one entry (or the single profile). The form is generated from the resource's
 * field list, so every content type shares the same, tested behavior: validation, three-language
 * fields, drafts, unsaved-changes protection and server error reporting.
 */
@Component({
  selector: 'app-resource-edit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Field],
  template: `
    @if (def(); as def) {
      <nav aria-label="Breadcrumb">
        @if (!def.singleton) {
          <a class="underline underline-offset-4" [routerLink]="['/admin', def.key]"
            >← {{ def.label }}</a
          >
        }
      </nav>
      <h1 class="mt-2 text-4xl" tabindex="-1">{{ heading() }}</h1>

      @switch (status()) {
        @case ('loading') {
          <div class="mt-6 grid gap-4" aria-busy="true">
            @for (n of [1, 2, 3, 4]; track n) {
              <div class="a-card h-20 animate-pulse bg-surface-2"></div>
            }
          </div>
        }
        @case ('missing') {
          <div class="a-card mt-6 p-6">
            <p class="font-semibold">This {{ def.singular }} doesn't exist any more.</p>
            <a class="a-btn mt-4" [routerLink]="['/admin', def.key]">Back to the list</a>
          </div>
        }
        @case ('error') {
          <div class="a-card mt-6 p-6">
            <p class="a-error" role="alert">{{ loadError() }}</p>
            <button type="button" class="a-btn mt-4" (click)="reload()">Try again</button>
          </div>
        }
        @default {
          @if (form(); as form) {
            <form
              class="mt-6 grid max-w-4xl gap-8"
              [formGroup]="form"
              (ngSubmit)="save()"
              novalidate
              [attr.aria-label]="heading()"
            >
              @for (field of def.fields; track field.key) {
                <div><app-field [form]="form" [field]="field" /></div>
              }

              @if (saveError()) {
                <p class="a-error rounded-lg border-2 border-danger p-3" role="alert">
                  {{ saveError() }}
                </p>
              }

              <div class="flex flex-wrap items-center gap-3 border-t-[3px] border-ink pt-6">
                <button type="submit" class="a-btn a-btn-primary" [disabled]="saving()">
                  {{ saving() ? 'Saving…' : 'Save' }}
                </button>
                @if (!def.singleton) {
                  <a class="a-btn" [routerLink]="['/admin', def.key]">Cancel</a>
                }
                @if (entityId()) {
                  <button
                    type="button"
                    class="a-btn a-btn-danger ms-auto"
                    [disabled]="saving()"
                    (click)="remove()"
                  >
                    Delete
                  </button>
                }
              </div>
            </form>
          }
        }
      }
    } @else {
      <h1 class="text-4xl">Not found</h1>
      <p class="mt-3">There is no section called “{{ resource() }}”.</p>
      <a class="a-btn mt-4" routerLink="/admin">Back to the back-office</a>
    }
  `,
})
export class ResourceEditPage implements HasUnsavedChanges {
  /** Route parameter `:resource`, or the `resource` datum of the profile route. */
  readonly resource = input<string>();
  /** Route parameter `:id`: absent when creating. */
  readonly id = input<string>();

  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly def = computed(() => findResource(this.resource()));
  protected readonly form = signal<FormGroup | null>(null);
  protected readonly status = signal<Status>('loading');
  protected readonly loadError = signal('');
  protected readonly saveError = signal('');
  protected readonly saving = signal(false);
  /** Id of the entry being edited (not for new entries or the profile before it exists). */
  protected readonly entityId = signal<string | null>(null);
  private readonly entityTitle = signal('');
  private generation = 0;

  protected readonly heading = computed(() => {
    const def = this.def();
    if (!def) return '';
    if (def.singleton) return 'Profile';
    return this.entityId()
      ? `Edit ${def.singular}${this.entityTitle() ? `: ${this.entityTitle()}` : ''}`
      : `New ${def.singular}`;
  });

  constructor() {
    effect(() => {
      const def = this.def();
      const id = this.id();
      if (def) untracked(() => void this.init(def, id));
    });
  }

  hasUnsavedChanges(): boolean {
    return this.form()?.dirty ?? false;
  }

  protected reload(): void {
    const def = this.def();
    if (def) void this.init(def, this.id());
  }

  private async init(def: ResourceDef, id: string | undefined): Promise<void> {
    const generation = ++this.generation;
    this.status.set('loading');
    this.saveError.set('');
    const form = buildForm(def.fields);
    try {
      let entity: Entity | null = null;
      if (def.singleton) entity = await this.api.getProfile();
      else if (id) entity = await this.api.get(def.path, id);
      if (generation !== this.generation) return; // a newer navigation took over

      if (entity) {
        patchForm(form, def.fields, entity);
        this.entityId.set(def.singleton ? null : String(entity['id']));
        this.entityTitle.set(def.title(entity));
      } else {
        this.entityId.set(null);
        this.entityTitle.set('');
      }
      this.form.set(form);
      this.status.set('ready');
    } catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.status.set('missing');
      } else {
        this.loadError.set(apiMessage(error));
        this.status.set('error');
      }
    }
  }

  protected async save(): Promise<void> {
    const def = this.def();
    const form = this.form();
    if (!def || !form) return;

    form.markAllAsTouched();
    form.updateValueAndValidity();
    if (form.invalid) {
      this.saveError.set('Some fields need attention. They are marked below.');
      queueMicrotask(() =>
        this.host.nativeElement
          .querySelector<HTMLElement>(
            '[aria-invalid="true"], .ng-invalid input, .ng-invalid textarea',
          )
          ?.focus(),
      );
      return;
    }

    this.saveError.set('');
    this.saving.set(true);
    try {
      const existing = this.entityId();
      if (def.singleton) {
        const saved = await this.api.saveProfile(toPayload(form, def.fields, 'update'));
        patchForm(form, def.fields, saved);
        this.toast.show('Profile saved.');
      } else if (existing) {
        const saved = await this.api.update(
          def.path,
          existing,
          toPayload(form, def.fields, 'update'),
        );
        patchForm(form, def.fields, saved);
        this.entityTitle.set(def.title(saved));
        this.toast.show(`Saved “${def.title(saved)}”.`);
      } else {
        const created = await this.api.create(def.path, toPayload(form, def.fields, 'create'));
        form.markAsPristine();
        this.toast.show(`Created “${def.title(created)}”.`);
        await this.router.navigate(['/admin', def.key]);
      }
    } catch (error) {
      this.saveError.set(apiMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const def = this.def();
    const id = this.entityId();
    if (!def || !id) return;
    const confirmed = await this.confirm.ask({
      title: `Delete ${def.singular}?`,
      message: `“${this.entityTitle()}” will be removed from the site for good. This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.saving.set(true);
    try {
      await this.api.remove(def.path, id);
      this.form()?.markAsPristine();
      this.toast.show(`Deleted “${this.entityTitle()}”.`);
      await this.router.navigate(['/admin', def.key]);
    } catch (error) {
      this.saveError.set(apiMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
