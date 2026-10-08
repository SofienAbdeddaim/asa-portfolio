import DOMPurify from 'dompurify';
import { marked } from 'marked';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

let hooked = false;

function installHooks(): void {
  if (hooked) return;
  hooked = true;
  // Every link that opens a new context is also isolated from the page that opened it.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? '';
      if (/^https?:\/\//i.test(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });
}

/**
 * Renders Markdown to HTML that is safe to bind with `[innerHTML]`: the output is sanitized
 * (scripts, event handlers, `javascript:` URLs, forms and styles are removed). Where no DOM is
 * available (server-side), the source is returned escaped instead, never as raw HTML.
 */
export function renderMarkdown(source: string): string {
  if (!source.trim()) return '';
  if (typeof window === 'undefined' || !DOMPurify.isSupported) {
    return `<p>${escapeHtml(source)}</p>`;
  }
  installHooks();
  const html = marked.parse(source, { async: false, gfm: true, breaks: false });
  return DOMPurify.sanitize(html, {
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
