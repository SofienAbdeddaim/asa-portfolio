import { resolveLocalized } from '@asa/shared';

export type FieldType =
  | 'text'
  | 'email'
  | 'url'
  | 'date'
  | 'boolean'
  | 'tags'
  | 'select'
  | 'image'
  | 'localized'
  | 'localizedText'
  | 'markdown'
  | 'items'
  | 'images'
  | 'socials';

export interface FieldDef {
  /** Property path in the API entity. A dot means a nested object (`availability.status`). */
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  maxLength?: number;
  /** Select options as [value, label]. */
  options?: readonly (readonly [string, string])[];
  /** Slugs must be kebab-case. */
  slug?: boolean;
}

export interface ResourceDef {
  /** URL segment in the admin and key used everywhere (`/admin/projects`). */
  key: string;
  /** Path segment in the API (`/api/admin/<path>`). */
  path: string;
  label: string;
  singular: string;
  singleton?: boolean;
  fields: readonly FieldDef[];
  title: (entity: Entity) => string;
  subtitle?: (entity: Entity) => string;
}

export type Entity = { [key: string]: unknown };

const SHORT = 500;
const LONG = 20_000;
const MARKDOWN = 100_000;

const en = (value: unknown): string =>
  value && typeof value === 'object' ? resolveLocalized(value as { en: string }, 'en') : '';
const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const published: FieldDef = {
  key: 'published',
  label: 'Published',
  type: 'boolean',
  help: 'Drafts stay private. Published entries appear on the site.',
};

export const RESOURCES: readonly ResourceDef[] = [
  {
    key: 'profile',
    path: 'profile',
    label: 'Profile',
    singular: 'profile',
    singleton: true,
    title: (e) => str(e['fullName']) || 'Profile',
    fields: [
      { key: 'fullName', label: 'Full name', type: 'text', required: true, maxLength: 200 },
      {
        key: 'headline',
        label: 'Headline',
        type: 'localized',
        required: true,
        maxLength: SHORT,
        help: 'Your job title or one-line pitch.',
      },
      { key: 'bio', label: 'Bio', type: 'localizedText', required: true, maxLength: LONG },
      { key: 'location', label: 'Location', type: 'localized', maxLength: SHORT },
      { key: 'email', label: 'Contact email', type: 'email', required: true, maxLength: 254 },
      { key: 'photoUrl', label: 'Photo', type: 'image', maxLength: SHORT },
      {
        key: 'availability.status',
        label: 'Availability',
        type: 'select',
        required: true,
        options: [
          ['open', 'Open to new projects'],
          ['limited', 'Limited availability'],
          ['closed', 'Not available'],
        ],
      },
      { key: 'availability.note', label: 'Availability note', type: 'localized', maxLength: SHORT },
      { key: 'socials', label: 'Social links', type: 'socials' },
    ],
  },
  {
    key: 'experiences',
    path: 'experiences',
    label: 'Experience',
    singular: 'experience',
    title: (e) => en(e['role']) || 'Untitled role',
    subtitle: (e) => str(e['company']),
    fields: [
      { key: 'company', label: 'Company', type: 'text', required: true, maxLength: 200 },
      { key: 'role', label: 'Role', type: 'localized', required: true, maxLength: SHORT },
      { key: 'location', label: 'Location', type: 'localized', maxLength: SHORT },
      { key: 'startDate', label: 'Start date', type: 'date', required: true },
      { key: 'endDate', label: 'End date', type: 'date', help: 'Leave empty for a current role.' },
      { key: 'current', label: 'Current role', type: 'boolean' },
      { key: 'summary', label: 'Summary', type: 'localizedText', required: true, maxLength: LONG },
      {
        key: 'highlights',
        label: 'Highlights',
        type: 'localizedText',
        maxLength: LONG,
        help: 'One per line, starting with "- ".',
      },
      { key: 'technologies', label: 'Technologies', type: 'tags', help: 'Comma separated.' },
      published,
    ],
  },
  {
    key: 'skills',
    path: 'skills',
    label: 'Skills',
    singular: 'skill group',
    title: (e) => en(e['category']) || 'Untitled group',
    subtitle: (e) => `${Array.isArray(e['items']) ? e['items'].length : 0} skills`,
    fields: [
      { key: 'category', label: 'Category', type: 'localized', required: true, maxLength: 120 },
      { key: 'items', label: 'Skills', type: 'items' },
      published,
    ],
  },
  {
    key: 'projects',
    path: 'projects',
    label: 'Projects',
    singular: 'project',
    title: (e) => en(e['title']) || 'Untitled project',
    subtitle: (e) => str(e['slug']),
    fields: [
      {
        key: 'slug',
        label: 'Slug',
        type: 'text',
        required: true,
        slug: true,
        maxLength: 80,
        help: 'Used in the address. Lowercase letters, numbers and hyphens.',
      },
      { key: 'title', label: 'Title', type: 'localized', required: true, maxLength: SHORT },
      { key: 'summary', label: 'Summary', type: 'localized', required: true, maxLength: SHORT },
      { key: 'description', label: 'Description', type: 'markdown', maxLength: MARKDOWN },
      { key: 'technologies', label: 'Technologies', type: 'tags', help: 'Comma separated.' },
      { key: 'repoUrl', label: 'Code repository', type: 'url', maxLength: SHORT },
      { key: 'demoUrl', label: 'Live demo', type: 'url', maxLength: SHORT },
      { key: 'images', label: 'Screenshots', type: 'images' },
      {
        key: 'featured',
        label: 'Featured',
        type: 'boolean',
        help: 'Featured projects get a badge.',
      },
      published,
    ],
  },
  {
    key: 'education',
    path: 'education',
    label: 'Education',
    singular: 'education entry',
    title: (e) => en(e['degree']) || 'Untitled degree',
    subtitle: (e) => str(e['institution']),
    fields: [
      { key: 'institution', label: 'Institution', type: 'text', required: true, maxLength: 200 },
      { key: 'degree', label: 'Degree', type: 'localized', required: true, maxLength: SHORT },
      { key: 'field', label: 'Field of study', type: 'localized', maxLength: SHORT },
      { key: 'startDate', label: 'Start date', type: 'date', required: true },
      { key: 'endDate', label: 'End date', type: 'date' },
      { key: 'description', label: 'Description', type: 'localizedText', maxLength: LONG },
      published,
    ],
  },
  {
    key: 'certificates',
    path: 'certificates',
    label: 'Certificates',
    singular: 'certificate',
    title: (e) => en(e['name']) || 'Untitled certificate',
    subtitle: (e) => str(e['issuer']),
    fields: [
      { key: 'name', label: 'Name', type: 'localized', required: true, maxLength: SHORT },
      { key: 'issuer', label: 'Issuer', type: 'text', required: true, maxLength: 200 },
      { key: 'issuedAt', label: 'Issue date', type: 'date', required: true },
      { key: 'credentialUrl', label: 'Credential link', type: 'url', maxLength: SHORT },
      published,
    ],
  },
  {
    key: 'testimonials',
    path: 'testimonials',
    label: 'Testimonials',
    singular: 'testimonial',
    title: (e) => str(e['authorName']) || 'Unnamed author',
    subtitle: (e) => en(e['quote']).slice(0, 80),
    fields: [
      { key: 'authorName', label: 'Author', type: 'text', required: true, maxLength: 200 },
      { key: 'authorRole', label: 'Author role', type: 'localized', maxLength: SHORT },
      { key: 'authorCompany', label: 'Author company', type: 'text', maxLength: 200 },
      { key: 'quote', label: 'Quote', type: 'localizedText', required: true, maxLength: LONG },
      published,
    ],
  },
  {
    key: 'posts',
    path: 'posts',
    label: 'Blog posts',
    singular: 'blog post',
    title: (e) => en(e['title']) || 'Untitled post',
    subtitle: (e) => str(e['slug']),
    fields: [
      {
        key: 'slug',
        label: 'Slug',
        type: 'text',
        required: true,
        slug: true,
        maxLength: 80,
        help: 'Used in the address. Lowercase letters, numbers and hyphens.',
      },
      { key: 'title', label: 'Title', type: 'localized', required: true, maxLength: SHORT },
      { key: 'excerpt', label: 'Excerpt', type: 'localizedText', required: true, maxLength: LONG },
      { key: 'body', label: 'Body', type: 'markdown', required: true, maxLength: MARKDOWN },
      { key: 'tags', label: 'Tags', type: 'tags', help: 'Comma separated.' },
      { key: 'coverUrl', label: 'Cover image', type: 'image', maxLength: SHORT },
      { ...published, help: 'Drafts stay private. Publishing sets the publication date once.' },
    ],
  },
];

export const findResource = (key: string | undefined): ResourceDef | undefined =>
  RESOURCES.find((resource) => resource.key === key);

export const LIST_RESOURCES = RESOURCES.filter((resource) => !resource.singleton);
