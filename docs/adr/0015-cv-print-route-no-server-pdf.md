# 15. CV: a print-optimized route, no server-side PDF

Status: accepted

## Context

The brief asks for a downloadable CV in the active language, with a print route as the baseline and a server-side PDF only if Arabic shaping and free-tier memory limits are verified.

## What was verified

The route `/:lang/cv` was printed to PDF with headless Chrome (`--print-to-pdf`) for English, French and Arabic from the prerendered static site, and the PDF pages were rendered and inspected.

- **Arabic shaping and direction are correct** when the browser lays the page out: letters join, the whole page is right-to-left (name block, dates, bullets, column order), Latin technology names and links stay left-to-right inside Arabic lines, and Western digits sit correctly in Arabic text.
- English and French fit one A4 page with the demo content; Arabic takes slightly more room (taller line-height) and flows onto a second page with whole entries kept together.
- The print stylesheet removes the site chrome (header, footer, palette, buttons), forces a white page with black text whatever theme is on screen, and sets A4 with 14 mm margins.

## Decision

- The CV is an HTML page designed for paper (`app-cv-page`, styles under `.cv` and `@media print`). The "Print or save as PDF" button opens the browser print dialog. No PDF library or headless browser runs on the server.
- Why not a server-side PDF: it needs a headless Chromium (or a PDF engine that shapes Arabic itself, which is the hard part), about 150 MB of binaries and several hundred MB of RAM per render. The free API tier has 512 MB and sleeps. The browser already does the layout correctly, and the result is the same engine that was verified above.

## Possible later improvement

Phase 6 brings Playwright and Chromium into CI. It could print one static `cv-<lang>.pdf` per language at build time, so the site can offer a direct download link with no print dialog and still no runtime PDF service. That would be an additive change to this decision.

## Consequences

The CV always matches the site content and active language, and costs nothing to host. Users must pick "Save as PDF" in their print dialog; the page says so.
