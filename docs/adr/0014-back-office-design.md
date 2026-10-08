# 14. Back-office design

Status: accepted

## Decisions

- **One generic editor, driven by data.** Every content type is described once in `apps/web/src/app/admin/resources.ts` (fields, types, limits, titles). The form model, the list, the editor and the completeness chips are generated from it. Adding a field means adding one line, and every content type shares the same tested behavior. Field limits mirror the API DTOs; the API stays the authority and rejects anything the form lets through.
- **Translations are typed in, never generated.** Each translatable field has three inputs (English, French, Arabic, the last with `dir="rtl"` and `lang="ar"`). Only English is required; empty translations are dropped from the payload. The list shows per entry whether French and Arabic are complete, measured against the fields that have English text.
- **Drafts and ordering.** A "Published" switch on every entry (drafts never leave the API). Order is changed by dragging a row or with up/down buttons, so keyboard and touch users are not left out. The new order is saved at once, announced through a live region, and rolled back if saving fails.
- **Clearing a value.** On update, an emptied optional field is sent as `null` (a PATCH that omitted it would leave the old value); on create it is left out. Lists (technologies, skills, screenshots, links) are always sent so they can be emptied.
- **Markdown.** Editing is a textarea per language with a small toolbar (line-based tools such as headings and lists act on the start of the line) and a live preview. The preview is rendered by `marked` and sanitized by DOMPurify (scripts, handlers, `javascript:` URLs, forms, styles and frames removed; external links get `rel="noopener noreferrer"`). Markdown is stored raw; sanitizing is a property of rendering, so every renderer must use `renderMarkdown`.
- **Images.** Uploads go to `POST /api/admin/media`. The server ignores the declared type and the file name: the bytes must decode as a JPEG, PNG, WebP, GIF or AVIF of at most 40 megapixels and 5 MB, are auto-rotated, stripped of all metadata (EXIF, GPS), resized to fit 1600px and re-encoded as WebP, then stored in GridFS. Images are served from `/api/media/:id` with a one-year immutable cache. Deleting an entry does not delete its images yet (orphans are small and harmless on the free tier).
- **Sign-in UX.** Email and password, then the authenticator code, or recovery code; the first sign-in enrolls the authenticator (QR code and manual key) and shows the ten recovery codes once, with the next step gated on confirming they were saved. A wrong password and an unknown account give the same message. An expired five-minute challenge sends the user back to the first step.
- **Session handling.** Cookies only (see ADR 8). A guard renews an expired access token once with the refresh cookie before sending someone to sign in; the HTTP interceptor does the same for API calls and redirects to sign-in when the refresh is refused.
- **Isolation from the public site.** The back-office is lazy-loaded, client-rendered only (never prerendered), `noindex`, English-only chrome, and runs without the public header, footer or command palette. Unsaved changes trigger a leave warning.
- **Confirmations.** Deleting asks first, in a native `<dialog>` (focus trap and Esc for free). Results are announced through a polite live region.

## Consequences

The editor is deliberately plain: forms need clarity, not personality. A resource with an unusual field type needs one new case in `form-model.ts` and one component. Orphaned images and a missing "forgot password" flow are known limits (see PLAN).
