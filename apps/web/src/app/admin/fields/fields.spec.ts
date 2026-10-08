import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { FormArray, FormControl, FormGroup } from '@angular/forms';
import { byText, fakeAdminApi, httpError, settle, typeInto } from '../../../testing/admin-helpers';
import { AdminApi } from '../admin-api';
import { buildForm, localizedGroup, newImage } from '../form-model';
import { findResource, type FieldDef } from '../resources';
import { Field } from './field';
import { ImageInput } from './image-input';

function configure() {
  const api = fakeAdminApi();
  TestBed.configureTestingModule({
    providers: [
      { provide: AdminApi, useValue: api },
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });
  return api;
}

async function renderField(fields: readonly FieldDef[], key: string) {
  const api = configure();
  const form = buildForm(fields);
  const fixture = TestBed.createComponent(Field);
  fixture.componentRef.setInput('form', form);
  fixture.componentRef.setInput(
    'field',
    fields.find((f) => f.key === key),
  );
  await settle(fixture);
  return { api, form, fixture, el: fixture.nativeElement as HTMLElement };
}

const projectFields = findResource('projects')!.fields;
const skillFields = findResource('skills')!.fields;
const profileFields = findResource('profile')!.fields;
const q = <T extends HTMLElement>(el: HTMLElement, selector: string) =>
  el.querySelector<T>(selector)!;

describe('Field: simple controls', () => {
  it('renders a labelled text input, marks required fields and reports errors once touched', async () => {
    const { form, fixture, el } = await renderField(projectFields, 'slug');
    expect(q(el, 'label').textContent).toContain('Slug *');
    expect(q(el, '#f-slug-help').textContent).toContain('Lowercase letters');
    expect(q(el, '#f-slug-error').textContent?.trim()).toBe('');

    form.get('slug')!.markAsTouched();
    await settle(fixture);
    expect(q(el, '#f-slug-error').textContent).toContain('required');
    expect(q(el, '#f-slug').getAttribute('aria-invalid')).toBe('true');

    typeInto(q<HTMLInputElement>(el, '#f-slug'), 'Not Valid');
    await settle(fixture);
    expect(q(el, '#f-slug-error').textContent).toContain('lowercase');
    typeInto(q<HTMLInputElement>(el, '#f-slug'), 'valid-slug');
    await settle(fixture);
    expect(q(el, '#f-slug-error').textContent?.trim()).toBe('');
  });

  it('uses the right input types', async () => {
    expect(q<HTMLInputElement>((await renderField(profileFields, 'email')).el, 'input').type).toBe(
      'email',
    );
    TestBed.resetTestingModule();
    const experience = findResource('experiences')!.fields;
    expect(q<HTMLInputElement>((await renderField(experience, 'startDate')).el, 'input').type).toBe(
      'date',
    );
    TestBed.resetTestingModule();
    const url = await renderField(projectFields, 'repoUrl');
    expect(url.el.querySelector('input')!.getAttribute('inputmode')).toBe('url');
  });

  it('renders checkboxes, selects with options, and tags', async () => {
    const checkbox = await renderField(projectFields, 'featured');
    typeInto(q<HTMLInputElement>(checkbox.el, 'input'), '');
    q<HTMLInputElement>(checkbox.el, 'input').click();
    expect(checkbox.form.get('featured')!.value).toBe(true);
    expect(checkbox.el.textContent).toContain('Featured');
    TestBed.resetTestingModule();

    const select = await renderField(profileFields, 'availability.status');
    expect([...select.el.querySelectorAll('option')].map((o) => o.value)).toEqual([
      'open',
      'limited',
      'closed',
    ]);
    typeInto(q<HTMLSelectElement>(select.el, 'select'), 'closed');
    expect(select.form.get('availability.status')!.value).toBe('closed');
    TestBed.resetTestingModule();

    const tags = await renderField(projectFields, 'technologies');
    typeInto(q<HTMLInputElement>(tags.el, 'input'), 'a, b');
    expect(tags.form.get('technologies')!.value).toBe('a, b');
  });
});

describe('Field: three-language text', () => {
  it('has English, French and Arabic inputs, with the right language and direction', async () => {
    const { el } = await renderField(projectFields, 'title');
    expect(q(el, 'legend').textContent).toContain('Title');
    expect(q(el, 'legend').textContent).toContain('English is required');
    expect(q(el, 'label[for="f-title-en"]').textContent).toContain('(required)');
    expect(q(el, 'label[for="f-title-fr"]').textContent).not.toContain('(required)');
    expect(q(el, '#f-title-ar').getAttribute('dir')).toBe('rtl');
    expect(q(el, '#f-title-ar').getAttribute('lang')).toBe('ar');
    expect(q(el, '#f-title-fr').getAttribute('dir')).toBe('ltr');
  });

  it('requires English only, and says so after the field is touched', async () => {
    const { form, fixture, el } = await renderField(projectFields, 'title');
    typeInto(q<HTMLInputElement>(el, '#f-title-fr'), 'Bonjour');
    form.get('title.en')!.markAsTouched(); // as when the whole form is submitted
    await settle(fixture);
    expect(q(el, '#f-title-en-error').textContent).toContain('required');
    expect(q(el, '#f-title-fr-error').textContent?.trim()).toBe('');
    expect(form.get('title')!.valid).toBe(false);
    typeInto(q<HTMLInputElement>(el, '#f-title-en'), 'Hello');
    expect(form.get('title')!.valid).toBe(true);
  });

  it('uses text areas for long text', async () => {
    const { el } = await renderField(findResource('testimonials')!.fields, 'quote');
    expect(el.querySelectorAll('textarea')).toHaveLength(3);
  });
});

describe('Field: Markdown', () => {
  async function markdown() {
    const ctx = await renderField(projectFields, 'description');
    const editor = () => q<HTMLTextAreaElement>(ctx.el, 'textarea');
    const preview = () => q(ctx.el, '.markdown');
    const tab = (code: string) => q<HTMLButtonElement>(ctx.el, `#f-description-tab-${code}`);
    return { ...ctx, editor, preview, tab };
  }

  it('has one tab per language and shows only the active language editor', async () => {
    const { fixture, tab, editor } = await markdown();
    expect(tab('en').getAttribute('aria-selected')).toBe('true');
    expect(editor().getAttribute('dir')).toBe('ltr');
    tab('ar').click();
    await settle(fixture);
    expect(tab('ar').getAttribute('aria-selected')).toBe('true');
    expect(editor().getAttribute('dir')).toBe('rtl');
    expect(editor().getAttribute('lang')).toBe('ar');
  });

  it('previews sanitized HTML and marks languages that have text', async () => {
    const { fixture, editor, preview, tab } = await markdown();
    typeInto(
      editor(),
      '## Title\n\n**bold** <script>alert(1)</script><img src=x onerror=alert(2)>',
    );
    await settle(fixture);
    expect(preview().innerHTML).toContain('<h2>Title</h2>');
    expect(preview().innerHTML).toContain('<strong>bold</strong>');
    expect(preview().innerHTML).not.toMatch(/<script|onerror/);
    expect(tab('en').textContent).toContain('has text');
    expect(tab('fr').textContent).not.toContain('has text');
  });

  it('formats the selection with the toolbar and keeps the selection on the new text', async () => {
    const { fixture, el, editor } = await markdown();
    typeInto(editor(), 'make this strong');
    editor().setSelectionRange(5, 9);
    q<HTMLButtonElement>(el, 'button[aria-label="Bold"]').click();
    await settle(fixture);
    expect(editor().value).toBe('make **this** strong');

    editor().setSelectionRange(0, 0);
    q<HTMLButtonElement>(el, 'button[aria-label="Link"]').click();
    await settle(fixture);
    expect(editor().value).toBe('[link text](https://)make **this** strong');
    q<HTMLButtonElement>(el, 'button[aria-label="Bulleted list"]').click();
    await settle(fixture);
    expect(editor().value.startsWith('- ')).toBe(true);
  });

  it('reports a missing required body in the Markdown editor', async () => {
    const ctx = await renderField(findResource('posts')!.fields, 'body');
    ctx.form.get('body')!.markAllAsTouched();
    await settle(ctx.fixture);
    expect(ctx.el.querySelector('[role="alert"]')?.textContent).toContain(
      'English: This is required.',
    );
  });
});

describe('ImageInput', () => {
  async function render() {
    const api = configure();
    const control = (localizedGroup({}) as FormGroup).get('en') as FormControl<string>;
    const fixture: ComponentFixture<ImageInput> = TestBed.createComponent(ImageInput);
    fixture.componentRef.setInput('control', control);
    fixture.componentRef.setInput('inputId', 'photo');
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    const choose = async (file: File) => {
      const input = q<HTMLInputElement>(el, 'input[type="file"]');
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      await settle(fixture);
    };
    return { api, control, fixture, el, choose };
  }

  it('uploads an image and shows the stored address and a preview', async () => {
    const { api, control, el, choose } = await render();
    expect(el.textContent).toContain('No image');
    api['upload']!.mockResolvedValue({
      url: '/api/media/abc',
      id: 'abc',
      bytes: 1,
      width: 1,
      height: 1,
    });
    await choose(new File(['x'], 'a.png', { type: 'image/png' }));
    expect(control.value).toBe('/api/media/abc');
    expect(control.dirty).toBe(true);
    expect(q<HTMLImageElement>(el, 'img').getAttribute('src')).toBe('/api/media/abc');
    expect(el.textContent).toContain('Replace image');
  });

  it('rejects non-images and oversized files before uploading', async () => {
    const { api, el, choose } = await render();
    await choose(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Choose an image file');

    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
    await choose(big);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('too large');
    expect(api['upload']).not.toHaveBeenCalled();
  });

  it('shows the server’s reason when an upload fails, and can remove the image', async () => {
    const { api, control, fixture, el, choose } = await render();
    api['upload']!.mockRejectedValue(httpError(400, 'The file is not a supported image'));
    await choose(new File(['x'], 'fake.png', { type: 'image/png' }));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('not a supported image');
    expect(control.value).toBe('');

    control.setValue('/api/media/old');
    await settle(fixture);
    byText<HTMLButtonElement>(el, 'button', /Remove/).click();
    await settle(fixture);
    expect(control.value).toBe('');
    expect(el.textContent).toContain('No image');
  });

  it('also accepts a pasted address', async () => {
    const { control, fixture, el } = await render();
    typeInto(q<HTMLInputElement>(el, 'input[type="text"]'), 'https://example.com/a.png');
    await settle(fixture);
    expect(control.value).toBe('https://example.com/a.png');
    expect(q<HTMLImageElement>(el, 'img').src).toBe('https://example.com/a.png');
  });
});

describe('repeating rows', () => {
  const rows = (el: HTMLElement) => el.querySelectorAll('ul > li:not(.a-help)');

  it('edits skills: add, validate, move and remove', async () => {
    const { form, fixture, el } = await renderField(skillFields, 'items');
    const array = form.get('items') as FormArray;
    expect(el.textContent).toContain('No skills yet');

    byText<HTMLButtonElement>(el, 'button', /Add a skill/).click();
    byText<HTMLButtonElement>(el, 'button', /Add a skill/).click();
    await settle(fixture);
    expect(rows(el)).toHaveLength(2);
    typeInto(q<HTMLInputElement>(el, '#skill-name-0'), 'Angular');
    typeInto(q<HTMLInputElement>(el, '#skill-name-1'), 'CSS');
    const level = q<HTMLSelectElement>(el, '#skill-level-1');
    level.selectedIndex = 3; // "4 of 5"
    level.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(fixture);
    expect(array.value).toEqual([
      { name: 'Angular', level: 3 },
      { name: 'CSS', level: 4 },
    ]);

    q<HTMLButtonElement>(el, 'button[aria-label="Move skill 1 down"]').click();
    await settle(fixture);
    expect(array.value.map((r: { name: string }) => r.name)).toEqual(['CSS', 'Angular']);
    expect(q<HTMLButtonElement>(el, 'button[aria-label="Move skill 1 up"]').disabled).toBe(true);
    expect(q<HTMLButtonElement>(el, 'button[aria-label="Move skill 2 down"]').disabled).toBe(true);

    typeInto(q<HTMLInputElement>(el, '#skill-name-0'), '');
    array.controls[0]!.get('name')!.markAsTouched();
    await settle(fixture);
    expect(el.querySelector('.a-error')?.textContent).toContain('required');

    q<HTMLButtonElement>(el, 'button[aria-label="Remove skill 1"]').click();
    await settle(fixture);
    expect(array.value).toEqual([{ name: 'Angular', level: 3 }]);
    expect(array.dirty).toBe(true);
  });

  it('edits screenshots: each has an upload and an optional three-language description', async () => {
    const { form, fixture, el } = await renderField(projectFields, 'images');
    byText<HTMLButtonElement>(el, 'button', /Add a screenshot/).click();
    await settle(fixture);
    expect(el.querySelectorAll('app-image-input')).toHaveLength(1);
    expect(el.querySelector('#f-shot-0-alt-en')).not.toBeNull();
    expect(el.querySelector('#f-shot-0-alt-ar')?.getAttribute('dir')).toBe('rtl');

    const array = form.get('images') as FormArray;
    array.push(newImage());
    await settle(fixture);
    expect(rows(el)).toHaveLength(2);
    byText<HTMLButtonElement>(el, 'button', /↓ Down/).click();
    await settle(fixture);
    byText<HTMLButtonElement>(el, 'button', /Remove/).click();
    await settle(fixture);
    expect(array.length).toBe(1);
  });

  it('edits social links with a network and a validated address', async () => {
    const { form, fixture, el } = await renderField(profileFields, 'socials');
    byText<HTMLButtonElement>(el, 'button', /Add a link/).click();
    await settle(fixture);
    expect([...el.querySelectorAll('select option')].map((o) => o.textContent)).toEqual([
      'GitHub',
      'LinkedIn',
      'X',
      'Website',
      'Other',
    ]);
    typeInto(q<HTMLSelectElement>(el, '#social-kind-0'), 'linkedin');
    typeInto(q<HTMLInputElement>(el, '#social-url-0'), 'not a url');
    (form.get('socials') as FormArray).controls[0]!.get('url')!.markAsTouched();
    await settle(fixture);
    expect(el.querySelector('.a-error')?.textContent).toContain('http');
    typeInto(q<HTMLInputElement>(el, '#social-url-0'), 'https://www.linkedin.com/in/example');
    await settle(fixture);
    expect((form.get('socials') as FormArray).value).toEqual([
      { kind: 'linkedin', url: 'https://www.linkedin.com/in/example' },
    ]);
  });
});
