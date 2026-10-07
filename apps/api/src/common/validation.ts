import { Body, ValidationPipe, type Type } from '@nestjs/common';

/**
 * Body decorator that validates against an explicit DTO class. The API does not rely on
 * `emitDecoratorMetadata` (see ADR 7), so the DTO type is always passed explicitly.
 */
export const ValidBody = (dto: Type<unknown>): ParameterDecorator =>
  Body(
    new ValidationPipe({
      expectedType: dto,
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
