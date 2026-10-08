import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  Validators,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { LOCALES, type Locale } from '@asa/shared';
import type { Entity, FieldDef } from './resources';

const URL_PATTERN = /^https?:\/\/\S+$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCALIZED_TYPES = new Set(['localized', 'localizedText', 'markdown']);

export const isLocalizedType = (type: string): boolean => LOCALIZED_TYPES.has(type);

const urlValidator: ValidatorFn = (control): ValidationErrors | null =>
  !control.value || URL_PATTERN.test(String(control.value)) ? null : { url: true };

const slugValidator: ValidatorFn = (control): ValidationErrors | null =>
  !control.value || SLUG_PATTERN.test(String(control.value)) ? null : { slug: true };

function textControl(field: FieldDef, extra: ValidatorFn[] = []): FormControl<string> {
  const validators = [...extra];
  if (field.required) validators.push(Validators.required);
  if (field.maxLength) validators.push(Validators.maxLength(field.maxLength));
  return new FormControl('', { nonNullable: true, validators });
}

/** `{ en, fr, ar }`: English is required when the field is, the others are always optional. */
export function localizedGroup(field: Pick<FieldDef, 'required' | 'maxLength'>): FormGroup {
  const limit = field.maxLength ? [Validators.maxLength(field.maxLength)] : [];
  return new FormGroup({
    en: new FormControl('', {
      nonNullable: true,
      validators: field.required ? [Validators.required, ...limit] : limit,
    }),
    fr: new FormControl('', { nonNullable: true, validators: limit }),
    ar: new FormControl('', { nonNullable: true, validators: limit }),
  });
}

export const newSkillItem = (): FormGroup =>
  new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    level: new FormControl(3, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(5)],
    }),
  });

export const newImage = (): FormGroup =>
  new FormGroup({
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
    alt: localizedGroup({ maxLength: 500 }),
  });

export const newSocial = (): FormGroup =>
  new FormGroup({
    kind: new FormControl('github', { nonNullable: true, validators: [Validators.required] }),
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, urlValidator, Validators.maxLength(500)],
    }),
  });

function buildControl(field: FieldDef): AbstractControl {
  switch (field.type) {
    case 'localized':
    case 'localizedText':
    case 'markdown':
      return localizedGroup(field);
    case 'boolean':
      return new FormControl(false, { nonNullable: true });
    case 'url':
      return textControl(field, [urlValidator]);
    case 'email':
      return textControl(field, [Validators.email]);
    case 'items':
    case 'images':
    case 'socials':
      return new FormArray<AbstractControl>([]);
    default:
      return textControl(field, field.slug ? [slugValidator] : []);
  }
}

function groupAt(root: FormGroup, parts: string[]): FormGroup {
  let group = root;
  for (const part of parts) {
    let next = group.get(part);
    if (!(next instanceof FormGroup)) {
      next = new FormGroup({});
      group.addControl(part, next);
    }
    group = next as FormGroup;
  }
  return group;
}

/** Builds a reactive form from the field list. Dotted keys become nested groups. */
export function buildForm(fields: readonly FieldDef[]): FormGroup {
  const root = new FormGroup({});
  for (const field of fields) {
    const parts = field.key.split('.');
    groupAt(root, parts.slice(0, -1)).addControl(
      parts[parts.length - 1] as string,
      buildControl(field),
    );
  }
  return root;
}

export const controlFor = (form: FormGroup, field: FieldDef): AbstractControl =>
  form.get(field.key) as AbstractControl;

function valueAt(entity: Entity, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, part) => (value && typeof value === 'object' ? (value as Entity)[part] : undefined),
      entity,
    );
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

function localizedValue(value: unknown): Record<Locale, string> {
  const record = asRecord(value);
  return { en: asString(record['en']), fr: asString(record['fr']), ar: asString(record['ar']) };
}

/** Fills the form from an API entity. Array rows are rebuilt to match the data. */
export function patchForm(form: FormGroup, fields: readonly FieldDef[], entity: Entity): void {
  for (const field of fields) {
    const control = controlFor(form, field);
    const value = valueAt(entity, field.key);

    if (control instanceof FormArray) {
      control.clear();
      const rows = Array.isArray(value) ? (value as Entity[]) : [];
      for (const row of rows) {
        if (field.type === 'items') {
          const group = newSkillItem();
          group.patchValue({ name: asString(row['name']), level: Number(row['level']) || 3 });
          control.push(group);
        } else if (field.type === 'images') {
          const group = newImage();
          group.patchValue({ url: asString(row['url']), alt: localizedValue(row['alt']) });
          control.push(group);
        } else {
          const group = newSocial();
          group.patchValue({ kind: asString(row['kind']) || 'other', url: asString(row['url']) });
          control.push(group);
        }
      }
    } else if (isLocalizedType(field.type)) {
      control.patchValue(localizedValue(value));
    } else if (field.type === 'boolean') {
      control.patchValue(Boolean(value));
    } else if (field.type === 'tags') {
      control.patchValue(Array.isArray(value) ? value.join(', ') : '');
    } else if (field.type === 'date') {
      control.patchValue(asString(value).slice(0, 10));
    } else {
      control.patchValue(asString(value));
    }
  }
  form.markAsPristine();
  form.markAsUntouched();
}

export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** `{ en, fr?, ar? }` without empty translations, or null when the English text is empty. */
export function cleanLocalized(value: Record<string, unknown>): Record<string, string> | null {
  const result: Record<string, string> = {};
  for (const locale of LOCALES) {
    const text = asString(value[locale]).trim();
    if (text) result[locale] = text;
  }
  return result['en'] ? result : null;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let node = target;
  for (const part of parts.slice(0, -1)) {
    node[part] = asRecord(node[part]);
    node = node[part] as Record<string, unknown>;
  }
  node[parts[parts.length - 1] as string] = value;
}

/**
 * Turns the form into an API body. Optional fields left empty become `null` on update (so a value
 * can be cleared) and are left out on create; array fields are always sent so they can be emptied.
 */
export function toPayload(
  form: FormGroup,
  fields: readonly FieldDef[],
  mode: 'create' | 'update',
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const empty = mode === 'update' ? null : undefined;

  for (const field of fields) {
    const control = controlFor(form, field);
    const raw = control.value as unknown;
    let value: unknown;

    if (isLocalizedType(field.type)) {
      value = cleanLocalized(asRecord(raw)) ?? empty;
    } else if (field.type === 'tags') {
      value = parseTags(asString(raw));
    } else if (field.type === 'boolean') {
      value = Boolean(raw);
    } else if (field.type === 'items') {
      value = (raw as Entity[]).map((row) => ({
        name: asString(row['name']).trim(),
        level: Number(row['level']),
      }));
    } else if (field.type === 'images') {
      value = (raw as Entity[]).map((row) => {
        const alt = cleanLocalized(asRecord(row['alt']));
        return { url: asString(row['url']).trim(), ...(alt ? { alt } : {}) };
      });
    } else if (field.type === 'socials') {
      value = (raw as Entity[]).map((row) => ({
        kind: asString(row['kind']),
        url: asString(row['url']).trim(),
      }));
    } else {
      const text = asString(raw).trim();
      value = text === '' ? empty : text;
    }

    if (value !== undefined) setPath(payload, field.key, value);
  }

  // A nested group whose members are all cleared (e.g. availability with no note) stays as is:
  // `availability.status` is required, so the object is never empty.
  return payload;
}

/** The first problem with a control, in plain words (or an empty string when it is valid). */
export function describeErrors(control: AbstractControl | null): string {
  const errors = control?.errors;
  if (!errors) return '';
  if (errors['required']) return 'This is required.';
  if (errors['maxlength'])
    return `Use at most ${(errors['maxlength'] as { requiredLength: number }).requiredLength} characters.`;
  if (errors['url']) return 'Enter a full web address starting with http:// or https://.';
  if (errors['email']) return 'Enter a valid email address.';
  if (errors['slug']) return 'Use lowercase letters, numbers and single hyphens.';
  if (errors['min'] || errors['max']) return 'Choose a level from 1 to 5.';
  return 'This value is not valid.';
}

/** Which of French and Arabic are fully translated, judged on the fields that have English text. */
export function translationStatus(
  entity: Entity,
  fields: readonly FieldDef[],
): Record<'fr' | 'ar', 'complete' | 'partial' | 'none' | 'n/a'> {
  const status = { fr: 'n/a', ar: 'n/a' } as Record<
    'fr' | 'ar',
    'complete' | 'partial' | 'none' | 'n/a'
  >;
  const filled = fields
    .filter((field) => isLocalizedType(field.type))
    .map((field) => localizedValue(valueAt(entity, field.key)))
    .filter((value) => value.en.trim());
  if (filled.length === 0) return status;

  for (const locale of ['fr', 'ar'] as const) {
    const done = filled.filter((value) => value[locale].trim()).length;
    status[locale] = done === filled.length ? 'complete' : done === 0 ? 'none' : 'partial';
  }
  return status;
}
