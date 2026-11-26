# 24. Project status badge and professional projects

Status: accepted.

## Context

The Projects section was meant for personal projects only, so it would not repeat the client work already told in the experience timeline. The owner now has several personal projects at different stages (live, in development, pre-alpha), including one built for a client in his spare time, and may want to show professional work too, clearly marked as such. The project model had no way to say either.

## Decisions

- **`status` (optional): `live`, `in-development` or `pre-alpha`.** Shown as a chip on the card (the live one in the accent color, no new colors). Left empty, no badge is shown.
- **`professional` (boolean, default `false`).** A professional project gets a "Professional project" label and is listed after every personal project, whatever its back-office order; personal and professional projects keep the back-office order among themselves. Without a code link it says the code is not public, so a missing link does not read as an omission.
- **The live link reads "Visit the site".** `demoUrl` now points to real sites more than to demos, so the button and its accessible name say so in the three languages.
- **A screenshot can belong to one language.** An image with a `locale` is shown on that language's page; the card otherwise shows an image meant for every language (or the first one). This lets a bilingual product show its English screens on the French and English pages and its Arabic screens on the Arabic page.
- **Screenshots of personal projects ship as static files** in `apps/web/public/projects/` (WebP, 1280×720) and are referenced by path from the project entry. Uploads through the back-office (GridFS) still work for images that should not live in the public repository.

## Consequences

- The fields are optional for the API and default safely in MongoDB, so existing entries and content files keep working.
- The rule "client projects stay in the timeline" becomes "client projects can appear, labelled and after personal ones"; the timeline is still where the work itself is described.
