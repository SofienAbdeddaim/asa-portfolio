# 9. Content API shape

Status: accepted

## Decision

- Seven ordered resources (`experiences`, `skills`, `projects`, `education`, `certificates`, `testimonials`, `posts`) share one generic service and one controller factory (`createContentControllers`), configured by a `ResourceDefinition` in `resources.ts`. Each keeps its own Mongoose schema and DTO. Adding a resource is one schema, one DTO and one registry line.
- `profile` is a singleton replaced as a whole (`PUT /admin/profile`).
- Public routes (`GET /api/<resource>`, `/slug/:slug`) return only `published` entries; admin routes under `/api/admin/<resource>` need the access cookie and offer list, get, create, partial update, delete and `PUT reorder`. Order is set by the position in the submitted id list.
- `GET /api/content` returns the profile and every published list in one response. It feeds the build-time content snapshot that keeps the site rendering while the free-tier API is asleep.
- Translatable fields are `{ fr?, en, ar? }`, validated by `IsLocalized` (English required and non-empty, unknown locales rejected). Unknown body fields are rejected, not stripped.
- Posts get `publishedAt` the first time they are published and are listed newest first.
- Markdown is stored raw. It is sanitized when rendered (Phase 5), not on write.
- Image upload (resize to WebP, GridFS) is built with the back-office in Phase 4, where it can be exercised end to end.

## Consequences

Low duplication and a uniform API for the back-office. Slug filters are guarded because Mongoose drops filters on paths missing from a schema; resources without a slug answer 404 instead.
