import { ChangeDetectionStrategy, Component, Directive, computed, input } from '@angular/core';
import {
  ReactiveFormsModule,
  type AbstractControl,
  type FormArray,
  type FormControl,
  type FormGroup,
} from '@angular/forms';
import { trackControl } from '../control-events';
import { describeErrors, newImage, newSkillItem, newSocial } from '../form-model';
import { reorder } from '../reorder';
import type { FieldDef } from '../resources';
import { ImageInput } from './image-input';
import { LocalizedField } from './localized-field';

/** Shared behavior of the repeating-row editors: add, remove and move rows. */
@Directive()
abstract class RowsBase {
  readonly array = input.required<FormArray>();
  readonly field = input.required<FieldDef>();
  protected readonly version = trackControl(() => this.array());
  protected readonly rows = computed(() => {
    this.version();
    return [...this.array().controls] as FormGroup[]; // a new array, so OnPush views notice outside changes
  });

  protected abstract newRow(): FormGroup;

  protected add(): void {
    this.array().push(this.newRow());
    this.array().markAsDirty();
  }

  protected remove(index: number): void {
    this.array().removeAt(index);
    this.array().markAsDirty();
  }

  protected move(index: number, delta: number): void {
    const array = this.array();
    const next = reorder(array.controls, index, index + delta);
    array.clear({ emitEvent: false });
    for (const control of next) array.push(control as AbstractControl, { emitEvent: false });
    array.markAsDirty();
    array.updateValueAndValidity();
  }

  protected controlAt(row: FormGroup, name: string): FormControl<string> {
    return row.get(name) as FormControl<string>;
  }

  protected error(row: FormGroup, name: string): string {
    this.version();
    const control = row.get(name);
    return control?.touched ? describeErrors(control) : '';
  }
}

@Component({
  selector: 'app-items-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <fieldset class="min-w-0">
      <legend class="a-label">{{ field().label }}</legend>
      <ul class="grid list-none gap-3">
        @for (row of rows(); track row; let i = $index; let first = $first; let last = $last) {
          <li class="a-card grid gap-3 p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-start">
            <div>
              <label class="a-help mt-0! block font-semibold" [for]="'skill-name-' + i"
                >Skill {{ i + 1 }}</label
              >
              <input
                class="a-input"
                [id]="'skill-name-' + i"
                type="text"
                [formControl]="controlAt(row, 'name')"
                [attr.aria-invalid]="!!error(row, 'name')"
              />
              <p class="a-error" role="alert">{{ error(row, 'name') }}</p>
            </div>
            <div>
              <label class="a-help mt-0! block font-semibold" [for]="'skill-level-' + i"
                >Level</label
              >
              <select
                class="a-input"
                [id]="'skill-level-' + i"
                [formControl]="controlAt(row, 'level')"
              >
                @for (level of levels; track level) {
                  <option [ngValue]="level">{{ level }} of 5</option>
                }
              </select>
            </div>
            <div class="flex gap-1 sm:pt-6">
              <button
                type="button"
                class="a-btn min-w-11 px-2"
                [disabled]="first"
                [attr.aria-label]="'Move skill ' + (i + 1) + ' up'"
                (click)="move(i, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="a-btn min-w-11 px-2"
                [disabled]="last"
                [attr.aria-label]="'Move skill ' + (i + 1) + ' down'"
                (click)="move(i, 1)"
              >
                ↓
              </button>
              <button
                type="button"
                class="a-btn a-btn-danger px-3"
                [attr.aria-label]="'Remove skill ' + (i + 1)"
                (click)="remove(i)"
              >
                Remove
              </button>
            </div>
          </li>
        } @empty {
          <li class="a-help">No skills yet.</li>
        }
      </ul>
      <button type="button" class="a-btn mt-3" (click)="add()">Add a skill</button>
    </fieldset>
  `,
})
export class ItemsField extends RowsBase {
  protected readonly levels = [1, 2, 3, 4, 5];
  protected override newRow(): FormGroup {
    return newSkillItem();
  }
}

@Component({
  selector: 'app-images-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ImageInput, LocalizedField],
  template: `
    <fieldset class="min-w-0">
      <legend class="a-label">{{ field().label }}</legend>
      <ul class="grid list-none gap-4">
        @for (row of rows(); track row; let i = $index; let first = $first; let last = $last) {
          <li class="a-card grid gap-4 p-4">
            <app-image-input [control]="controlAt(row, 'url')" [inputId]="'shot-' + i" />
            <app-localized-field
              [group]="altGroup(row)"
              [field]="altField"
              [idPrefix]="'shot-' + i + '-'"
            />
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="a-btn"
                [disabled]="first"
                [attr.aria-label]="'Move screenshot ' + (i + 1) + ' up'"
                (click)="move(i, -1)"
              >
                ↑ Up
              </button>
              <button
                type="button"
                class="a-btn"
                [disabled]="last"
                [attr.aria-label]="'Move screenshot ' + (i + 1) + ' down'"
                (click)="move(i, 1)"
              >
                ↓ Down
              </button>
              <button
                type="button"
                class="a-btn a-btn-danger"
                [attr.aria-label]="'Remove screenshot ' + (i + 1)"
                (click)="remove(i)"
              >
                Remove
              </button>
            </div>
          </li>
        } @empty {
          <li class="a-help">No screenshots yet.</li>
        }
      </ul>
      <button type="button" class="a-btn mt-3" (click)="add()">Add a screenshot</button>
    </fieldset>
  `,
})
export class ImagesField extends RowsBase {
  protected readonly altField: FieldDef = {
    key: 'alt',
    label: 'Description for screen readers',
    type: 'localized',
    maxLength: 500,
  };
  protected override newRow(): FormGroup {
    return newImage();
  }
  protected altGroup(row: FormGroup): FormGroup {
    return row.get('alt') as FormGroup;
  }
}

const KINDS: readonly (readonly [string, string])[] = [
  ['github', 'GitHub'],
  ['linkedin', 'LinkedIn'],
  ['x', 'X'],
  ['website', 'Website'],
  ['other', 'Other'],
];

@Component({
  selector: 'app-socials-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <fieldset class="min-w-0">
      <legend class="a-label">{{ field().label }}</legend>
      <ul class="grid list-none gap-3">
        @for (row of rows(); track row; let i = $index) {
          <li class="a-card grid gap-3 p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-start">
            <div>
              <label class="a-help mt-0! block font-semibold" [for]="'social-kind-' + i"
                >Network</label
              >
              <select
                class="a-input"
                [id]="'social-kind-' + i"
                [formControl]="controlAt(row, 'kind')"
              >
                @for (kind of kinds; track kind[0]) {
                  <option [value]="kind[0]">{{ kind[1] }}</option>
                }
              </select>
            </div>
            <div>
              <label class="a-help mt-0! block font-semibold" [for]="'social-url-' + i"
                >Address</label
              >
              <input
                class="a-input"
                [id]="'social-url-' + i"
                type="text"
                inputmode="url"
                [formControl]="controlAt(row, 'url')"
                [attr.aria-invalid]="!!error(row, 'url')"
              />
              <p class="a-error" role="alert">{{ error(row, 'url') }}</p>
            </div>
            <button
              type="button"
              class="a-btn a-btn-danger sm:mt-6"
              [attr.aria-label]="'Remove link ' + (i + 1)"
              (click)="remove(i)"
            >
              Remove
            </button>
          </li>
        } @empty {
          <li class="a-help">No links yet.</li>
        }
      </ul>
      <button type="button" class="a-btn mt-3" (click)="add()">Add a link</button>
    </fieldset>
  `,
})
export class SocialsField extends RowsBase {
  protected readonly kinds = KINDS;
  protected override newRow(): FormGroup {
    return newSocial();
  }
}
