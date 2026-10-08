import DOMPurify, { type DOMPurify as Purifier } from 'dompurify';
import { marked } from 'marked';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const hooked = new WeakSet<object>();

function configure(purifier: Purifier): Purifier {
  if (hooked.has(purifier)) return purifier;
  hooked.add(purifier);
  // Every link that opens a new context is also isolated from the page that opened it.
  purifier.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? '';
      if (/^https?:\/\//i.test(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });
  return purifier;
}

let serverPurifier: Purifier | null = null;

/**
 * Prerendering has no browser DOM, so the server build supplies a DOMPurify bound to a jsdom
 * window (see `app.config.server.ts`). Browsers never call this.
 */
export function useServerPurifier(purifier: Purifier): void {
  serverPurifier = configure(purifier);
}

function activePurifier(): Purifier | null {
  if (serverPurifier) return serverPurifier;
  if (typeof window !== 'undefined' && DOMPurify.isSupported) return configure(DOMPurify);
  return null;
}

/**
 * Renders Markdown to HTML that is safe to bind with `[innerHTML]`: the output is sanitized
 * (scripts, event handlers, `javascript:` URLs, forms and styles are removed). If no sanitizer is
 * available, the source is returned escaped instead, never as raw HTML.
 */
export function renderMarkdown(source: string): string {
  if (!source.trim()) return '';
  const purifier = activePurifier();
  if (!purifier) return `<p>${escapeHtml(source)}</p>`;

  const html = marked.parse(source, { async: false, gfm: true, breaks: false });
  return purifier.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      'style',
      'form',
      'input',
      'button',
      'textarea',
      'select',
      'iframe',
      'object',
      'embed',
    ],
    FORBID_ATTR: ['style'],
  });
}

/** Plain text of a Markdown document, for descriptions and reading-time estimates. */
export function markdownToText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
