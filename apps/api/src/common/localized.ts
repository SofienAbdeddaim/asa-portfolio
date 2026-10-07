import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { LOCALES, hasDefaultLocale } from '@asa/shared';
import { registerDecorator, type ValidationOptions } from 'class-validator';

export const MAX_SHORT = 500;
export const MAX_LONG = 20_000;
export const MAX_MARKDOWN = 100_000;

export function isLocalizedValue(value: unknown, maxLength: number): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (!keys.every((key) => (LOCALES as readonly string[]).includes(key))) return false;
  if (
    !keys.every(
      (key) => typeof record[key] === 'string' && (record[key] as string).length <= maxLength,
    )
  ) {
    return false;
  }
  return hasDefaultLocale(record as Partial<Record<(typeof LOCALES)[number], string>>);
}

/** `{ fr?, en, ar? }`: English is required and non-empty, unknown keys are rejected. */
export function IsLocalized(maxLength = MAX_SHORT, options?: ValidationOptions): PropertyDecorator {
  const validate: PropertyDecorator = (target, propertyKey) => {
    registerDecorator({
      name: 'isLocalized',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: {
        message: `${String(propertyKey)} must be an object with a non-empty "en" value and optional "fr"/"ar" strings (max ${maxLength} chars)`,
        ...options,
      },
      validator: { validate: (value: unknown) => isLocalizedValue(value, maxLength) },
    });
  };
  return applyDecorators(
    validate,
    ApiProperty({
      type: 'object',
      properties: { fr: { type: 'string' }, en: { type: 'string' }, ar: { type: 'string' } },
      required: ['en'],
    }),
  );
}
