import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { byText, fakeAdminApi, httpError, settle, typeInto } from '../../testing/admin-helpers';
import { provideI18n } from '../core/i18n';
import { AdminApi } from './admin-api';
import { AuthStore } from './auth.store';
import { ConfirmService, ToastService } from './feedback';
import { ResourceEditPage } from './resource-edit.page';
import { ResourceListPage } from './resource-list.page';
import { AdminShell } from './shell';

const items = () => [
  {
    id: '1',
    slug: 'one',
    title: { en: 'One', fr: 'Un', ar: 'واحد' },
    summary: { en: 's', fr: 's', ar: 's' },
    published: true,
  },
  { id: '2', slug: 'two', title: { en: 'Two' }, summary: { en: 's' }, published: false },
  {
    id: '3',
    slug: 'three',
    title: { en: 'Three', fr: 'Trois' },
    summary: { en: 's', fr: 'x' },
    published: true,
  },
];

function configure() {
  const api = fakeAdminApi();
  TestBed.configureTestingModule({
    providers: [
      { provide: AdminApi, useValue: api },
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideI18n(),
    ],
  });
  const router = TestBed.inject(Router);
  return {
    api,
    navigate: vi.spyOn(router, 'navigate').mockResolvedValue(true),
    navigateByUrl: vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true),
  };
}

const ids = (el: HTMLElement) =>
  [...el.querySelectorAll('ol > li')].map((li) => li.querySelector('a')?.textContent?.trim());
const status = (el: HTMLElement) =>
  el.querySelector('p[role="status"].sr-only')?.textContent?.trim();

describe('ResourceListPage', () => {
  async function render(resource = 'projects', list = items()) {
    const ctx = configure();
    ctx.api['list']!.mockResolvedValue(list);
    const fixture = TestBed.createComponent(ResourceListPage);
    fixture.componentRef.setInput('resource', resource);
    await settle(fixture);
    return { ...ctx, fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('lists entries in their public order with status and translation chips', async () => {
    const { api, el } = await render();
    expect(api['list']).toHaveBeenCalledWith('projects');
    expect(ids(el)).toEqual(['One', 'Two', 'Three']);
    const chips = (index: number) =>
      [...el.querySelectorAll('ol > li')[index]!.querySelectorAll('.a-chip')].map((c) =>
        c.textContent?.replace(/\s+/g, ' ').trim(),
      );
    expect(chips(0)).toEqual([
      'Published',
      'FR French translation complete',
      'AR Arabic translation complete',
    ]);
    expect(chips(1)).toEqual([
      'Draft',
      'FR French translation missing',
      'AR Arabic translation missing',
    ]);
    expect(chips(2)[2]).toBe('AR Arabic translation missing');
    expect(el.querySelector('h1')?.textContent).toBe('Projects');
    expect(el.textContent).toContain('three'); // subtitle (slug)
  });

  it('disables moving the first up and the last down', async () => {
    const { el } = await render();
    const rows = el.querySelectorAll('ol > li');
    expect((rows[0]!.querySelector('button[aria-label$="up"]') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (rows[2]!.querySelector('button[aria-label$="down"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((rows[1]!.querySelector('button[aria-label$="up"]') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('shows an inviting empty state', async () => {
    const { el } = await render('projects', []);
    expect(el.textContent).toContain('Nothing here yet');
    expect(el.querySelectorAll('a[href="/admin/projects/new"]').length).toBeGreaterThan(0);
  });

  it('explains a load failure and retries', async () => {
    const ctx = configure();
    ctx.api['list']!.mockRejectedValueOnce(httpError(500)).mockResolvedValueOnce(items());
    const fixture = TestBed.createComponent(ResourceListPage);
    fixture.componentRef.setInput('resource', 'skills');
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('server had a problem');
    byText<HTMLButtonElement>(el, 'button', /Try again/).click();
    await settle(fixture);
    expect(ids(el)).toHaveLength(3);
  });

  it('does not invent sections', async () => {
    const { api, el } = await render('nope');
    expect(el.textContent).toContain('There is no section called');
    expect(api['list']).not.toHaveBeenCalled();
  });

  it('saves a new order straight away and announces it', async () => {
    const { api, fixture, el } = await render();
    byText<HTMLButtonElement>(el, 'ol > li:first-child button', /↓/).click();
    await settle(fixture);
    expect(api['reorder']).toHaveBeenCalledWith('projects', ['2', '1', '3']);
    expect(ids(el)).toEqual(['Two', 'One', 'Three']);
    expect(status(el)).toBe('One moved to position 2 of 3.');
  });

  it('puts the old order back when saving the order fails', async () => {
    const { api, fixture, el } = await render();
    api['reorder']!.mockRejectedValue(httpError(500));
    byText<HTMLButtonElement>(el, 'ol > li:first-child button', /↓/).click();
    await settle(fixture);
    expect(ids(el)).toEqual(['One', 'Two', 'Three']);
    expect(TestBed.inject(ToastService).toast()).toMatchObject({ kind: 'error' });
    expect(TestBed.inject(ToastService).toast()?.message).toContain("Couldn't save the new order");
  });

  it('reorders by drag and drop', async () => {
    const { api, fixture, el } = await render();
    const rows = el.querySelectorAll<HTMLElement>('ol > li');
    const fire = (target: HTMLElement, type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    };
    fire(rows[0]!, 'dragstart');
    expect(fire(rows[2]!, 'dragover').defaultPrevented).toBe(true);
    fire(rows[2]!, 'drop');
    fire(rows[0]!, 'dragend');
    await settle(fixture);
    expect(api['reorder']).toHaveBeenCalledWith('projects', ['2', '3', '1']);

    // A drop that did not start from a row, or onto the same row, changes nothing.
    api['reorder']!.mockClear();
    expect(fire(rows[1]!, 'dragover').defaultPrevented).toBe(false);
    fire(rows[1]!, 'drop');
    await settle(fixture);
    expect(api['reorder']).not.toHaveBeenCalled();
  });

  it('publishes and unpublishes in place', async () => {
    const { api, fixture, el } = await render();
    api['update']!.mockImplementation(
      async (_path: string, id: string, body: Record<string, unknown>) => ({
        ...items().find((i) => i.id === id),
        ...body,
      }),
    );
    byText<HTMLButtonElement>(el, 'ol > li:nth-child(2) button', /Publish/).click();
    await settle(fixture);
    expect(api['update']).toHaveBeenCalledWith('projects', '2', { published: true });
    expect(el.querySelectorAll('ol > li')[1]!.querySelector('.a-chip')?.textContent?.trim()).toBe(
      'Published',
    );
    expect(TestBed.inject(ToastService).toast()?.message).toContain('is now published');

    api['update']!.mockRejectedValue(httpError(500));
    byText<HTMLButtonElement>(el, 'ol > li:nth-child(1) button', /Unpublish/).click();
    await settle(fixture);
    expect(TestBed.inject(ToastService).toast()).toMatchObject({ kind: 'error' });
    expect(el.querySelectorAll('ol > li')[0]!.querySelector('.a-chip')?.textContent?.trim()).toBe(
      'Published',
    );
  });

  it('deletes only after confirmation', async () => {
    const { api, fixture, el } = await render();
    const confirm = TestBed.inject(ConfirmService);

    byText<HTMLButtonElement>(el, 'ol > li:nth-child(2) button', /Delete/).click();
    expect(confirm.request()).toMatchObject({ title: 'Delete project?', danger: true });
    expect(confirm.request()?.message).toContain('“Two”');
    confirm.answer(false);
    await settle(fixture);
    expect(api['remove']).not.toHaveBeenCalled();
    expect(ids(el)).toHaveLength(3);

    byText<HTMLButtonElement>(el, 'ol > li:nth-child(2) button', /Delete/).click();
    confirm.answer(true);
    await settle(fixture);
    expect(api['remove']).toHaveBeenCalledWith('projects', '2');
    expect(ids(el)).toEqual(['One', 'Three']);

    api['remove']!.mockRejectedValue(httpError(404));
    byText<HTMLButtonElement>(el, 'ol > li:nth-child(1) button', /Delete/).click();
    confirm.answer(true);
    await settle(fixture);
    expect(ids(el)).toEqual(['One', 'Three']);
    expect(TestBed.inject(ToastService).toast()?.message).toContain("doesn't exist");
  });
});

describe('ResourceEditPage', () => {
  async function render(resource: string, id?: string) {
    const ctx = configure();
    const fixture = TestBed.createComponent(ResourceEditPage);
    fixture.componentRef.setInput('resource', resource);
    if (id) fixture.componentRef.setInput('id', id);
    return { ...ctx, fixture, el: fixture.nativeElement as HTMLElement };
  }
  const q = (el: HTMLElement, selector: string) => el.querySelector<HTMLInputElement>(selector)!;
  const submit = async (fixture: ComponentFixture<unknown>) => {
    (fixture.nativeElement as HTMLElement)
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
  };

  it('refuses to save an incomplete form and moves focus to the first problem', async () => {
    const { api, fixture, el } = await render('projects');
    document.body.append(el);
    await settle(fixture);
    expect(el.querySelector('h1')?.textContent).toBe('New project');
    await submit(fixture);
    await settle(fixture);
    expect(api['create']).not.toHaveBeenCalled();
    expect(el.querySelector('form [role="alert"]:not(.a-error:empty)')).not.toBeNull();
    expect(el.textContent).toContain('Some fields need attention');
    expect(el.querySelector('#f-slug-error')?.textContent).toContain('required');
    expect(document.activeElement?.id).toBe('f-slug');
    el.remove();
  });

  it('creates an entry with a clean payload and returns to the list', async () => {
    const { api, navigate, fixture, el } = await render('projects');
    api['create']!.mockResolvedValue({ id: '9', title: { en: 'Hello' } });
    await settle(fixture);
    typeInto(q(el, '#f-slug'), 'hello-world');
    typeInto(q(el, '#f-title-en'), '  Hello  ');
    typeInto(q(el, '#f-summary-en'), 'Short');
    typeInto(q(el, '#f-technologies'), 'Angular, angular, NestJS');
    await submit(fixture);

    expect(api['create']).toHaveBeenCalledWith('projects', {
      slug: 'hello-world',
      title: { en: 'Hello' },
      summary: { en: 'Short' },
      technologies: ['Angular', 'NestJS'],
      images: [],
      featured: false,
      published: false,
    });
    expect(navigate).toHaveBeenCalledWith(['/admin', 'projects']);
    expect(TestBed.inject(ToastService).toast()?.message).toBe('Created “Hello”.');
  });

  it('shows the server’s reason when saving fails and keeps the form', async () => {
    const { api, fixture, el } = await render('projects');
    api['create']!.mockRejectedValue(httpError(409, 'Slug already in use'));
    await settle(fixture);
    typeInto(q(el, '#f-slug'), 'taken');
    typeInto(q(el, '#f-title-en'), 'T');
    typeInto(q(el, '#f-summary-en'), 'S');
    await submit(fixture);
    expect(
      [...el.querySelectorAll('form [role="alert"]')].map((e) => e.textContent).join(' '),
    ).toContain('Slug already in use');
    expect(q(el, '#f-slug').value).toBe('taken');
  });

  it('edits an existing entry and sends only what the form holds', async () => {
    const { api, fixture, el } = await render('projects', '1');
    api['get']!.mockResolvedValue({
      id: '1',
      slug: 'one',
      title: { en: 'One', fr: 'Un' },
      summary: { en: 's' },
      technologies: ['A'],
      repoUrl: 'https://github.com/x',
      published: true,
      featured: false,
      images: [],
    });
    api['update']!.mockImplementation(
      async (_p: string, _id: string, body: Record<string, unknown>) => ({ id: '1', ...body }),
    );
    await settle(fixture);
    expect(api['get']).toHaveBeenCalledWith('projects', '1');
    expect(el.querySelector('h1')?.textContent).toBe('Edit project: One');
    expect(q(el, '#f-title-fr').value).toBe('Un');
    expect(q(el, '#f-repoUrl').value).toBe('https://github.com/x');

    typeInto(q(el, '#f-repoUrl'), '');
    typeInto(q(el, '#f-title-en'), 'Uno');
    await submit(fixture);
    const [, id, payload] = api['update']!.mock.calls[0]!;
    expect(id).toBe('1');
    expect(payload).toMatchObject({
      slug: 'one',
      title: { en: 'Uno', fr: 'Un' },
      repoUrl: null,
      description: null,
      published: true,
    });
    expect(el.querySelector('h1')?.textContent).toBe('Edit project: Uno');
    expect(TestBed.inject(ToastService).toast()?.message).toBe('Saved “Uno”.');
    expect((fixture.componentInstance as ResourceEditPage).hasUnsavedChanges()).toBe(false);
  });

  it('knows when there are unsaved changes', async () => {
    const { fixture, el } = await render('projects');
    await settle(fixture);
    const page = fixture.componentInstance as ResourceEditPage;
    expect(page.hasUnsavedChanges()).toBe(false);
    typeInto(q(el, '#f-slug'), 'x');
    expect(page.hasUnsavedChanges()).toBe(true);
  });

  it('reports a missing entry and a failed load, with a retry', async () => {
    const missing = await render('projects', 'gone');
    missing.api['get']!.mockRejectedValue(httpError(404));
    await settle(missing.fixture);
    expect(missing.el.textContent).toContain("doesn't exist any more");
    TestBed.resetTestingModule();

    const broken = await render('projects', '1');
    broken.api['get']!.mockRejectedValueOnce(httpError(0)).mockResolvedValueOnce({
      id: '1',
      slug: 'one',
      title: { en: 'One' },
      summary: { en: 's' },
    });
    await settle(broken.fixture);
    expect(broken.el.querySelector('[role="alert"]')?.textContent).toContain(
      "Can't reach the server",
    );
    byText<HTMLButtonElement>(broken.el, 'button', /Try again/).click();
    await settle(broken.fixture);
    expect(q(broken.el, '#f-slug').value).toBe('one');
  });

  it('deletes an entry after confirmation and goes back to the list', async () => {
    const { api, navigate, fixture, el } = await render('projects', '1');
    api['get']!.mockResolvedValue({
      id: '1',
      slug: 'one',
      title: { en: 'One' },
      summary: { en: 's' },
    });
    await settle(fixture);
    byText<HTMLButtonElement>(el, 'button', /^\s*Delete\s*$/).click();
    const confirm = TestBed.inject(ConfirmService);
    expect(confirm.request()?.message).toContain('“One”');
    confirm.answer(false);
    await settle(fixture);
    expect(api['remove']).not.toHaveBeenCalled();

    byText<HTMLButtonElement>(el, 'button', /^\s*Delete\s*$/).click();
    confirm.answer(true);
    await settle(fixture);
    expect(api['remove']).toHaveBeenCalledWith('projects', '1');
    expect(navigate).toHaveBeenCalledWith(['/admin', 'projects']);
  });

  it('edits the single profile: empty at first, then saved as a whole', async () => {
    const { api, fixture, el } = await render('profile');
    api['getProfile']!.mockResolvedValue(null);
    api['saveProfile']!.mockImplementation(async (body: Record<string, unknown>) => ({
      id: 'p',
      ...body,
    }));
    await settle(fixture);
    expect(el.querySelector('h1')?.textContent).toBe('Profile');
    expect(el.querySelector('nav[aria-label="Breadcrumb"] a')).toBeNull();
    expect(q(el, '#f-fullName').value).toBe('');
    expect(el.querySelector('button.a-btn-danger')).toBeNull();
  });

  it('saves the profile with nested availability and social links', async () => {
    const { api, fixture, el } = await render('profile');
    api['getProfile']!.mockResolvedValue({
      id: 'p',
      fullName: 'Alex',
      headline: { en: 'Engineer' },
      bio: { en: 'Bio' },
      email: 'a@example.com',
      availability: { status: 'open' },
      socials: [{ kind: 'github', url: 'https://github.com/a' }],
    });
    api['saveProfile']!.mockImplementation(async (body: Record<string, unknown>) => ({
      id: 'p',
      ...body,
    }));
    await settle(fixture);
    expect(q(el, '#f-fullName').value).toBe('Alex');
    typeInto(q(el, '#f-availability-note-en'), 'Booked until June');
    await submit(fixture);
    const payload = api['saveProfile']!.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload['availability']).toEqual({ status: 'open', note: { en: 'Booked until June' } });
    expect(payload['socials']).toEqual([{ kind: 'github', url: 'https://github.com/a' }]);
    expect(payload['location']).toBeNull();
    expect(TestBed.inject(ToastService).toast()?.message).toBe('Profile saved.');
    expect(
      [...el.querySelectorAll('button')].some((b) => /^\s*Delete\s*$/.test(b.textContent ?? '')),
    ).toBe(false); // the profile can't be deleted
  });

  it('does not invent sections', async () => {
    const { api, el, fixture } = await render('nope');
    await settle(fixture);
    expect(el.textContent).toContain('There is no section called');
    expect(api['get']).not.toHaveBeenCalled();
  });
});

describe('AdminShell', () => {
  async function render() {
    const ctx = configure();
    ctx.api['me']!.mockResolvedValue({ id: '1', email: 'owner@example.com' });
    await TestBed.inject(AuthStore).ensure();
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
    const fixture = TestBed.createComponent(AdminShell);
    await settle(fixture);
    return { ...ctx, fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('lists every content type and shows who is signed in', async () => {
    const { el } = await render();
    const links = [...el.querySelectorAll('nav[aria-label="Content"] a')].map((a) =>
      a.textContent?.trim(),
    );
    expect(links).toEqual([
      'Profile',
      'Experience',
      'Skills',
      'Projects',
      'Education',
      'Certificates',
      'Testimonials',
      'Blog posts',
    ]);
    expect(el.textContent).toContain('owner@example.com');
  });

  it('signs out and returns to the sign-in page', async () => {
    const { api, navigateByUrl, fixture, el } = await render();
    byText<HTMLButtonElement>(el, 'button', /Sign out/).click();
    await settle(fixture);
    expect(api['logout']).toHaveBeenCalled();
    expect(TestBed.inject(AuthStore).user()).toBeNull();
    expect(navigateByUrl).toHaveBeenCalledWith('/admin/login');
  });

  it('shows the confirm dialog and status messages', async () => {
    const { fixture, el } = await render();
    const confirm = TestBed.inject(ConfirmService);
    const answer = confirm.ask({
      title: 'Sure?',
      message: 'Really?',
      confirmLabel: 'Yes',
      danger: true,
    });
    await settle(fixture);
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    expect(el.querySelector('dialog h2')?.textContent).toBe('Sure?');
    byText<HTMLButtonElement>(el, 'dialog button', /^\s*Yes\s*$/).click();
    expect(await answer).toBe(true);
    await settle(fixture);
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(false);

    TestBed.inject(ToastService).show('Saved it.');
    await settle(fixture);
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Saved it.');
    TestBed.inject(ToastService).clear();
    await settle(fixture);
    expect(el.querySelector('[role="status"] p')).toBeNull();
  });
});
