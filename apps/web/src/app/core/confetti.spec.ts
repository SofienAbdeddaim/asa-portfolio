import { confetti } from './confetti';

describe('confetti', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('throws paper pieces from a point and cleans up when they finish', async () => {
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
    confetti(100, 200, 10);

    const layer = document.body.lastElementChild!;
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.children).toHaveLength(10);
    expect(animate).toHaveBeenCalledTimes(10);
    await vi.waitFor(() => expect(layer.isConnected).toBe(false));
  });

  it('does nothing when the viewer prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    confetti(0, 0);
    expect(document.body.children).toHaveLength(0);
  });

  it('does nothing where the Web Animations API is missing', () => {
    Element.prototype.animate = undefined as unknown as typeof Element.prototype.animate;
    confetti(0, 0);
    expect(document.body.children).toHaveLength(0);
  });
});
