import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LocaleService } from '../core/locale.service';
import { provideI18n } from '../core/i18n';
import { GALLERY_INTERVAL_MS, ProjectGallery } from './project-gallery';

const IMAGES = [
  { url: '/one.webp', alt: { en: 'First' } },
  { url: '/two.webp', alt: { en: 'Second' } },
  { url: '/three.webp', alt: { en: 'Third' } },
];

async function render(images = IMAGES) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideI18n()],
  });
  await TestBed.inject(LocaleService).activate('en');
  const fixture = TestBed.createComponent(ProjectGallery);
  fixture.componentRef.setInput('images', images);
  fixture.componentRef.setInput('locale', 'en');
  fixture.componentRef.setInput('label', 'Screenshots of Example');
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const active = () => el.querySelector('img.is-active')?.getAttribute('src');
  return { fixture, el, active };
}

describe('ProjectGallery', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // On screen as soon as it is observed.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private readonly cb: (entries: { isIntersecting: boolean }[]) => void) {}
        observe = () => this.cb([{ isIntersecting: true }]);
        disconnect = vi.fn();
      },
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the first screenshot, labels the group and hides the others from screen readers', async () => {
    const { el, active } = await render();
    expect(active()).toBe('/one.webp');
    expect(el.getAttribute('aria-label')).toBe('Screenshots of Example');
    expect(el.querySelectorAll('img[aria-hidden="true"]')).toHaveLength(2);
    expect(el.querySelectorAll('.gallery-dot')).toHaveLength(3);
  });

  it('moves on by itself, even under the pointer, and stops when paused', async () => {
    const { fixture, el, active } = await render();
    vi.advanceTimersByTime(GALLERY_INTERVAL_MS);
    fixture.detectChanges();
    expect(active()).toBe('/two.webp');

    el.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(GALLERY_INTERVAL_MS);
    fixture.detectChanges();
    expect(active()).toBe('/three.webp');

    const pause = el.querySelector<HTMLButtonElement>('.gallery-control')!;
    expect(pause.getAttribute('aria-label')).toBe('Pause the slideshow');
    pause.click();
    fixture.detectChanges();
    vi.advanceTimersByTime(GALLERY_INTERVAL_MS * 2);
    fixture.detectChanges();
    expect(active()).toBe('/three.webp');
    expect(pause.getAttribute('aria-label')).toBe('Play the slideshow');
  });

  it('resumes from the play button even though the click left focus on it', async () => {
    const { fixture, el, active } = await render();
    const control = el.querySelector<HTMLButtonElement>('.gallery-control')!;
    vi.spyOn(control, 'matches').mockReturnValue(false); // focus from a mouse click
    control.click(); // pause
    control.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    control.click(); // play
    fixture.detectChanges();
    vi.advanceTimersByTime(GALLERY_INTERVAL_MS);
    fixture.detectChanges();
    expect(active()).toBe('/two.webp');
    expect(control.getAttribute('aria-label')).toBe('Pause the slideshow');
  });

  it('pauses when keyboard focus enters it, until the play button is pressed', async () => {
    const { fixture, el, active } = await render();
    const control = el.querySelector<HTMLButtonElement>('.gallery-control')!;
    vi.spyOn(control, 'matches').mockReturnValue(true); // focus from the Tab key
    control.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();
    vi.advanceTimersByTime(GALLERY_INTERVAL_MS * 2);
    fixture.detectChanges();
    expect(active()).toBe('/one.webp');
    expect(control.getAttribute('aria-label')).toBe('Play the slideshow');

    control.click();
    fixture.detectChanges();
    vi.advanceTimersByTime(GALLERY_INTERVAL_MS);
    fixture.detectChanges();
    expect(active()).toBe('/two.webp');
  });

  it('jumps to a screenshot from its dot and stays there', async () => {
    const { fixture, el, active } = await render();
    const dots = el.querySelectorAll<HTMLButtonElement>('.gallery-dot');
    expect(dots[2]!.getAttribute('aria-label')).toBe('Screenshot 3 of 3');
    dots[2]!.click();
    fixture.detectChanges();
    expect(active()).toBe('/three.webp');
    expect(dots[2]!.getAttribute('aria-current')).toBe('true');
    vi.advanceTimersByTime(GALLERY_INTERVAL_MS * 2);
    fixture.detectChanges();
    expect(active()).toBe('/three.webp');
  });

  it('never moves by itself under prefers-reduced-motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    const { fixture, active } = await render();
    vi.advanceTimersByTime(GALLERY_INTERVAL_MS * 3);
    fixture.detectChanges();
    expect(active()).toBe('/one.webp');
  });

  it('stays still when it cannot tell it is on screen', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { fixture, active } = await render();
    vi.advanceTimersByTime(GALLERY_INTERVAL_MS * 3);
    fixture.detectChanges();
    expect(active()).toBe('/one.webp');
  });

  it('has no controls with a single screenshot', async () => {
    const { el } = await render([IMAGES[0]!]);
    expect(el.querySelector('.gallery-control')).toBeNull();
    expect(el.querySelector('img')?.classList).toContain('is-active');
  });
});
