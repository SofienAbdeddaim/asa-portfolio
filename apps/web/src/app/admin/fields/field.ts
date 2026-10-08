import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  ReactiveFormsModule,
  type FormArray,
  type FormControl,
  type FormGroup,
} from '@angular/forms';
import { trackControl } from '../control-events';
import { controlFor, describeErrors } from '../form-model';
import type { FieldDef } from '../resources';
import { ImagesField, ItemsField, SocialsField } from './array-fields';
import { ImageInput } from './image-input';
import { LocalizedField } from './localized-field';

/** Renders the right editor for a field definition, with its label, help and error. */
@Component({
  selector: 'app-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LocalizedField, ImageInput, ItemsField, ImagesField, SocialsField],
  template: `
    @switch (field().type) {
      @case ('localized') {
        <app-localized-field [group]="group()" [field]="field()" />
      }
      @case ('localizedText') {
        <app-localized-field [group]="group()" [field]="field()" />
      }
      @case ('markdown') {
        <app-localized-field [group]="group()" [field]="field()" />
      }
      @case ('items') {
        <app-items-field [array]="array()" [field]="field()" />
      }
      @case ('images') {
        <app-images-field [array]="array()" [field]="field()" />
      }
      @case ('socials') {
        <app-socials-field [array]="array()" [field]="field()" />
      }
      @case ('boolean') {
        <div class="a-card flex items-start gap-3 p-4">
          <input
            type="checkbox"
            class="mt-1 size-5 accent-[var(--ink)]"
            [id]="id()"
            [formControl]="control()"
            [attr.aria-describedby]="id() + '-help'"
          />
          <div>
            <label class="font-semibold" [for]="id()">{{ field().label }}</label>
            @if (field().help) {
              <p class="a-help mt-0!" [id]="id() + '-help'">{{ field().help }}</p>
            }
          </div>
        </div>
      }
      @case ('select') {
        <label class="a-label" [for]="id()"
          >{{ field().label }}{{ field().required ? ' *' : '' }}</label
        >
        <select
          class="a-input"
          [id]="id()"
          [formControl]="control()"
          [attr.aria-invalid]="!!error()"
          [attr.aria-describedby]="id() + '-error'"
        >
          @for (option of field().options ?? []; track option[0]) {
            <option [value]="option[0]">{{ option[1] }}</option>
          }
        </select>
        <p class="a-error" [id]="id() + '-error'" role="alert">{{ error() }}</p>
      }
      @case ('image') {
        <p class="a-label">{{ field().label }}</p>
        <app-image-input [control]="control()" [inputId]="id()" />
      }
      @default {
        <label class="a-label" [for]="id()"
          >{{ field().label }}{{ field().required ? ' *' : '' }}</label
        >
        <input
          class="a-input"
          [id]="id()"
          [type]="inputType()"
          [attr.inputmode]="field().type === 'url' ? 'url' : null"
          [attr.autocomplete]="field().type === 'email' ? 'email' : 'off'"
          [formControl]="control()"
          [attr.aria-invalid]="!!error()"
          [attr.aria-describedby]="id() + '-help ' + id() + '-error'"
        />
        @if (field().help) {
          <p class="a-help" [id]="id() + '-help'">{{ field().help }}</p>
        }
        <p class="a-error" [id]="id() + '-error'" role="alert">{{ error() }}</p>
      }
    }
  `,
})
export class Field {
  readonly form = input.required<FormGroup>();
  readonly field = input.required<FieldDef>();

  private readonly version = trackControl(() => this.form());
  protected readonly id = computed(() => `f-${this.field().key.replace(/\./g, '-')}`);

  protected readonly inputType = computed(() => {
    const type = this.field().type;
    return type === 'date' ? 'date' : type === 'email' ? 'email' : 'text';
  });

  protected control(): FormControl {
    return controlFor(this.form(), this.field()) as FormControl;
  }
  protected group(): FormGroup {
    return controlFor(this.form(), this.field()) as FormGroup;
  }
  protected array(): FormArray {
    return controlFor(this.form(), this.field()) as FormArray;
  }

  protected error(): string {
    this.version();
    const control = this.control();
    return control.touched ? describeErrors(control) : '';
  }
}
