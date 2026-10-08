import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders common Markdown', () => {
    const html = renderMarkdown('# Title\n\nSome **bold** and `code`.\n\n- one\n- two\n');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<li>two</li>');
  });

  it('returns nothing for empty input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown('  \n ')).toBe('');
  });

  it('removes scripts, event handlers and javascript: URLs', () => {
    const html = renderMarkdown(
      [
        '<script>alert(1)</script>',
        '<img src="x" onerror="alert(2)">',
        '[click](javascript:alert(3))',
        '<a href="javascript:alert(4)" onclick="alert(5)">bad</a>',
        '<svg onload="alert(6)"></svg>',
      ].join('\n\n'),
    );
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror|onclick|onload/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it('removes forms, inline styles and embedded frames', () => {
    const html = renderMarkdown(
      '<form action="https://evil.example"><input name="x"><button>go</button></form>\n\n<iframe src="https://evil.example"></iframe>\n\n<p style="position:fixed">x</p>',
    );
    expect(html).not.toMatch(/<form|<input|<button|<iframe|style=/i);
    expect(html).toContain('x');
  });

  it('isolates external links and leaves relative ones alone', () => {
    const html = renderMarkdown('[out](https://example.com) and [in](/en#about)');
    expect(html).toMatch(
      /<a href="https:\/\/example\.com" target="_blank" rel="noopener noreferrer">out<\/a>/,
    );
    expect(html).toContain('<a href="/en#about">in</a>');
    expect(html).not.toMatch(/\/en#about"[^>]*target/);
  });

  it('keeps images from the media library', () => {
    const html = renderMarkdown('![A shot](/api/media/64b7f0c2a1b2c3d4e5f60718)');
    expect(html).toContain('<img src="/api/media/64b7f0c2a1b2c3d4e5f60718" alt="A shot">');
  });

  it('handles right-to-left text', () => {
    expect(renderMarkdown('# مرحبا\n\nنص **تجريبي**')).toContain('<strong>تجريبي</strong>');
  });
});
