# 5. i18n data model and fallback

Status: accepted

## Decision

Every translatable field is `{ fr, en, ar }` (`LocalizedString` in `@asa/shared`), entered manually. The default locale (`en`) is mandatory; other locales are optional. Rendering falls back to English when a translation is blank. The back-office shows a completeness ratio per entry (`completeness()`), implemented once in the shared package and covered by tests.

## Consequences

Locale logic (direction, fallback, completeness) is shared by API validation, web rendering and the admin UI.
