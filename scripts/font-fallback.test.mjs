import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const css = await readFile(new URL('../apps/web/src/styles.css', import.meta.url), 'utf8');
const faces = [...css.matchAll(/@font-face\s*\{[^}]*IBM Plex Sans Fallback[^}]*\}/g)].map(
  (match) => match[0],
);

// The stand-in faces are Arial stretched to the metrics of IBM Plex Sans. Linux has no Arial, and
// when the face fails to load the page is drawn in the (wider) system font and jumps when Plex
// arrives: /fr measured a layout shift of 0.108 on the GitHub runner that way.
test('both stand-in faces for IBM Plex Sans name Arial and its Linux equivalents', () => {
  assert.equal(faces.length, 2);
  for (const face of faces) {
    assert.match(face, /local\('Arial/);
    assert.match(face, /local\('Liberation Sans/);
    assert.match(face, /local\('Arimo/);
  }
});
