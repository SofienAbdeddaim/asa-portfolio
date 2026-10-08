import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormGroup } from '@angular/forms';
import { apiMessage } from './api-error';
import {
  buildForm,
  cleanLocalized,
  controlFor,
  describeErrors,
  newImage,
  newSkillItem,
  newSocial,
  parseTags,
  patchForm,
  toPayload,
  translationStatus,
} from './form-model';
import { reorder } from './reorder';
import { LIST_RESOURCES, RESOURCES, findResource, type Entity, type FieldDef } from './resources';

const project = findResource('projects')!;
const profile = findResource('profile')!;

describe('buildForm', () => {
  it('builds controls for every field and nests dotted keys', () => {
    const form = buildForm(profile.fields);
    expect(form.get('availability.status')).toBeTruthy();
    expect(form.get('availability.note.en')).toBeTruthy();
    expect(form.get('socials')).toBeInstanceOf(FormArray);
    expect(form.get('headline')).toBeInstanceOf(FormGroup);
  });

  it('requires English (only) for required localized fields', () => {
    const form = buildForm(project.fields);
    form.get('title.fr')!.setValue('Bonjour');
    expect(form.get('title.en')!.valid).toBe(false);
    form.get('title.en')!.setValue('Hello');
    expect(form.get('title.en')!.valid).toBe(true);
    expect(form.get('title.ar')!.valid).toBe(true);
    expect(buildForm(project.fields).get('description.en')!.valid).toBe(true);
  });

  it('validates slugs, URLs, emails and lengths', () => {
    const form = buildForm([...project.fields, ...profile.fields.filter((f) => f.key === 'email')]);
    const slug = form.get('slug')!;
    for (const bad of ['Hello World', 'a--b', '-a', 'a_b']) {
      slug.setValue(bad);
      expect(slug.errors?.['slug'], bad).toBe(true);
    }
    slug.setValue('my-project-2');
    expect(slug.valid).toBe(true);

    const repo = form.get('repoUrl')!;
    repo.setValue('javascript:alert(1)');
    expect(repo.errors?.['url']).toBe(true);
    repo.setValue('ftp://example.com');
    expect(repo.errors?.['url']).toBe(true);
    repo.setValue('https://github.com/example');
    expect(repo.valid).toBe(true);
    repo.setValue('');
    expect(repo.valid).toBe(true);

    form.get('email')!.setValue('not-an-email');
    expect(form.get('email')!.invalid).toBe(true);
    form.get('slug')!.setValue('a'.repeat(81));
    expect(form.get('slug')!.errors?.['maxlength']).toBeTruthy();
  });

  it('validates array rows', () => {
    expect(newSkillItem().valid).toBe(false);
    const item = newSkillItem();
    item.patchValue({ name: 'Angular', level: 9 });
    expect(item.invalid).toBe(true);
    item.patchValue({ level: 5 });
    expect(item.valid).toBe(true);
    expect(newImage().valid).toBe(false);
    const social = newSocial();
    social.patchValue({ url: 'not a url' });
    expect(social.invalid).toBe(true);
  });
});

describe('patchForm and toPayload', () => {
  const entity = {
    id: 'p1',
    slug: 'example',
    title: { en: 'Example', fr: 'Exemple' },
    summary: { en: 'Short' },
    description: { en: '# Hi', ar: 'مرحبا' },
    technologies: ['NestJS', 'MongoDB'],
    repoUrl: 'https://github.com/example',
    images: [{ url: '/api/media/1', alt: { en: 'Shot' } }, { url: 'https://x.test/a.png' }],
    featured: true,
    published: false,
    startDate: '2021-03-01T00:00:00.000Z',
  };

  it('loads an entity into the form and back without losing anything', () => {
    const form = buildForm(project.fields);
    patchForm(form, project.fields, entity);
    expect(form.get('title.fr')!.value).toBe('Exemple');
    expect(form.get('technologies')!.value).toBe('NestJS, MongoDB');
    expect((form.get('images') as FormArray).length).toBe(2);
    expect(form.pristine).toBe(true);

    const payload = toPayload(form, project.fields, 'update');
    expect(payload).toMatchObject({
      slug: 'example',
      title: { en: 'Example', fr: 'Exemple' },
      summary: { en: 'Short' },
      description: { en: '# Hi', ar: 'مرحبا' },
      technologies: ['NestJS', 'MongoDB'],
      repoUrl: 'https://github.com/example',
      images: [{ url: '/api/media/1', alt: { en: 'Shot' } }, { url: 'https://x.test/a.png' }],
      featured: true,
      published: false,
    });
    expect(payload['id']).toBeUndefined();
  });

  it('clears optional values with null on update but leaves them out on create', () => {
    const form = buildForm(project.fields);
    patchForm(form, project.fields, entity);
    form.get('repoUrl')!.setValue('');
    form.get('description')!.patchValue({ en: '', ar: '' });

    const update = toPayload(form, project.fields, 'update');
    expect(update['repoUrl']).toBeNull();
    expect(update['description']).toBeNull();

    const create = toPayload(form, project.fields, 'create');
    expect('repoUrl' in create).toBe(false);
    expect('description' in create).toBe(false);
  });

  it('drops empty translations, trims values and de-duplicates tags', () => {
    const form = buildForm(project.fields);
    form.get('slug')!.setValue('  spaced  ');
    form.get('title')!.patchValue({ en: ' Hello ', fr: '   ', ar: '' });
    form.get('technologies')!.setValue('a, b ,, a ,c');
    const payload = toPayload(form, project.fields, 'create');
    expect(payload['slug']).toBe('spaced');
    expect(payload['title']).toEqual({ en: 'Hello' });
    expect(payload['technologies']).toEqual(['a', 'b', 'c']);
  });

  it('builds nested objects for dotted keys and handles rows of every array type', () => {
    const form = buildForm(profile.fields);
    patchForm(form, profile.fields, {
      fullName: 'Alex',
      headline: { en: 'Engineer' },
      bio: { en: 'Bio' },
      email: 'a@example.com',
      availability: { status: 'limited', note: { en: 'Busy', fr: 'Occupé' } },
      socials: [{ kind: 'github', url: 'https://github.com/a' }],
    });
    const payload = toPayload(form, profile.fields, 'update');
    expect(payload['availability']).toEqual({
      status: 'limited',
      note: { en: 'Busy', fr: 'Occupé' },
    });
    expect(payload['socials']).toEqual([{ kind: 'github', url: 'https://github.com/a' }]);
    expect(payload['location']).toBeNull();

    const skills = findResource('skills')!;
    const skillForm = buildForm(skills.fields);
    patchForm(skillForm, skills.fields, {
      category: { en: 'Frontend' },
      items: [{ name: 'Angular', level: 5 }],
    });
    expect(toPayload(skillForm, skills.fields, 'update')['items']).toEqual([
      { name: 'Angular', level: 5 },
    ]);
    (skillForm.get('items') as FormArray).clear();
    expect(toPayload(skillForm, skills.fields, 'update')['items']).toEqual([]);
  });

  it('formats dates for date inputs and tolerates missing data', () => {
    const experiences = findResource('experiences')!;
    const form = buildForm(experiences.fields);
    patchForm(form, experiences.fields, { startDate: '2021-03-01T00:00:00.000Z' });
    expect(form.get('startDate')!.value).toBe('2021-03-01');
    expect(form.get('endDate')!.value).toBe('');
    expect(form.get('technologies')!.value).toBe('');
    expect(controlFor(form, experiences.fields[0] as FieldDef)).toBeTruthy();
  });
});

describe('helpers', () => {
  it('parses tags', () => {
    expect(parseTags('')).toEqual([]);
    expect(parseTags(' a,b , a')).toEqual(['a', 'b']);
    expect(parseTags('Angular, angular, ANGULAR, NestJS')).toEqual(['Angular', 'NestJS']);
  });

  it('cleans localized values', () => {
    expect(cleanLocalized({ en: ' x ', fr: '', ar: ' y' })).toEqual({ en: 'x', ar: 'y' });
    expect(cleanLocalized({ en: '', fr: 'only French' })).toBeNull();
  });

  it('describes the first error in plain words', () => {
    const form = buildForm(project.fields);
    expect(describeErrors(form.get('slug'))).toBe('This is required.');
    form.get('slug')!.setValue('Bad Slug');
    expect(describeErrors(form.get('slug'))).toContain('lowercase');
    form.get('repoUrl')!.setValue('nope');
    expect(describeErrors(form.get('repoUrl'))).toContain('http');
    form.get('slug')!.setValue('a'.repeat(100));
    expect(describeErrors(form.get('slug'))).toContain('at most 80');
    expect(describeErrors(form.get('featured'))).toBe('');
    expect(describeErrors(null)).toBe('');
    const level = newSkillItem();
    level.patchValue({ level: 0 });
    expect(describeErrors(level.get('level'))).toContain('1 to 5');
  });

  it('reports which translations are complete, relative to the English text', () => {
    const fields = project.fields;
    const status = (entity: Entity) => translationStatus(entity, fields);
    expect(status({ slug: 'x' })).toEqual({ fr: 'n/a', ar: 'n/a' });
    expect(status({ title: { en: 'A' }, summary: { en: 'B' } })).toEqual({
      fr: 'none',
      ar: 'none',
    });
    expect(status({ title: { en: 'A', fr: 'a', ar: 'ا' }, summary: { en: 'B', fr: 'b' } })).toEqual(
      { fr: 'complete', ar: 'partial' },
    );
    expect(status({ title: { en: 'A', fr: 'a' }, summary: { en: 'B', fr: 'b' } }).fr).toBe(
      'complete',
    );
  });

  it('moves list items, clamping the target', () => {
    expect(reorder([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(reorder([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
    expect(reorder([1, 2, 3], 1, 99)).toEqual([1, 3, 2]);
    expect(reorder([1, 2, 3], 1, -5)).toEqual([2, 1, 3]);
    expect(reorder([1, 2, 3], 7, 0)).toEqual([1, 2, 3]);
    const original = [1, 2, 3];
    reorder(original, 0, 2);
    expect(original).toEqual([1, 2, 3]);
  });

  it('has a consistent resource catalog', () => {
    expect(RESOURCES.map((r) => r.key)).toEqual([
      'profile',
      'experiences',
      'skills',
      'projects',
      'education',
      'certificates',
      'testimonials',
      'posts',
    ]);
    expect(LIST_RESOURCES).toHaveLength(7);
    expect(findResource('nope')).toBeUndefined();
    for (const resource of RESOURCES) {
      expect(new Set(resource.fields.map((f) => f.key)).size).toBe(resource.fields.length);
      expect(resource.title({})).toBeTruthy();
    }
    expect(findResource('skills')!.subtitle!({ items: [1, 2] })).toBe('2 skills');
  });
});

describe('apiMessage', () => {
  const error = (status: number, body?: unknown) => new HttpErrorResponse({ status, error: body });

  it('explains common failures without leaking server details', () => {
    expect(apiMessage(error(0))).toContain("Can't reach the server");
    expect(
      apiMessage(error(400, { message: ['slug must be kebab-case', 'title is invalid'] })),
    ).toBe('slug must be kebab-case · title is invalid');
    expect(apiMessage(error(400, { message: 'Bad thing' }))).toBe('Bad thing');
    expect(apiMessage(error(400))).toBe('Some fields are not valid.');
    expect(apiMessage(error(401))).toContain('session expired');
    expect(apiMessage(error(403))).toContain('blocked');
    expect(apiMessage(error(404))).toContain("doesn't exist");
    expect(apiMessage(error(409, { message: 'Slug already in use' }))).toBe('Slug already in use');
    expect(apiMessage(error(409))).toContain('conflicts');
    expect(apiMessage(error(413))).toContain('5 MB');
    expect(apiMessage(error(429))).toContain('Too many');
    expect(apiMessage(error(500, { stack: 'secret trace' }))).not.toContain('secret');
    expect(apiMessage(error(503))).toContain('server had a problem');
    expect(apiMessage(error(418))).toBe('Something went wrong. Try again.');
    expect(apiMessage(new Error('boom'))).toBe('Something went wrong. Try again.');
  });
});
