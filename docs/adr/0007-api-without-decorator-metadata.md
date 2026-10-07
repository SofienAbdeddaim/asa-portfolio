# 7. API does not rely on `emitDecoratorMetadata`

Status: accepted

## Context

NestJS 12 is ESM. The usual way to run decorator-heavy code under a fast transpiler (Vitest/esbuild, tsx) is SWC with decorator metadata. On Windows the `@swc/core` native addon refuses to load (its cache-directory ACL check fails), so SWC is not a dependable part of the toolchain. esbuild and tsx do not emit `design:paramtypes`.

## Decision

Write the API so that no behavior depends on emitted metadata:

- Constructor injection always uses an explicit `@Inject(Token)` (or `@InjectModel`, `@InjectConnection`).
- Request bodies are validated with `ValidBody(Dto)`, which passes the DTO as `expectedType` to `ValidationPipe`. There is no global validation pipe, because it needs the metadata we do not emit.
- Nested DTOs use `@Type(() => X)`, Mongoose props declare `type`, Swagger uses explicit `@ApiProperty`.
- Production is built with plain `tsc`; tests run with Vitest; dev runs with `tsx`.

## Consequences

Slightly more verbose code, but one behavior in dev, test and production, and no native build tooling beyond `argon2` and `esbuild`. A missing `@Inject` fails loudly at boot (and in the HTTP tests), not silently.

## Lessons from the first real boot

Unit tests and in-memory HTTP tests passed, but booting against MongoDB exposed two places where the dependency tree silently relied on metadata. Both are now fixed and covered by the smoke test (`pnpm --filter @asa/api smoke`):

- `ThrottlerGuard` (third party) could not resolve `Reflector`. `AppThrottlerGuard` re-declares its constructor tokens explicitly.
- Swagger cannot infer property types, so every `@ApiProperty` must carry an explicit `type`.

When adding a third-party Nest provider that has constructor dependencies, boot the app once before trusting the tests.
