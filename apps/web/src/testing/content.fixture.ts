import type { ContentSnapshot } from '@asa/shared';

const meta = (id: string, order: number) => ({
  id,
  order,
  published: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

/** Small, clearly fake content used by component tests. */
export const CONTENT_FIXTURE: ContentSnapshot = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  profile: {
    id: 'profile',
    fullName: 'Alex Placeholder',
    headline: { en: 'Senior Software Engineer', ar: 'مهندس برمجيات أول' },
    bio: { en: 'English bio.\n\nSecond paragraph.', fr: 'Bio française.' },
    location: { en: 'Nowhere City' },
    email: 'hello@example.com',
    availability: { status: 'limited' },
    socials: [
      { kind: 'github', url: 'https://github.com/example' },
      { kind: 'linkedin', url: 'https://www.linkedin.com/in/example' },
    ],
  },
  experiences: [
    {
      ...meta('exp-1', 0),
      company: 'Example Corp',
      role: { en: 'Lead Engineer', ar: 'مهندس رئيسي' },
      location: { en: 'Remote' },
      startDate: '2021-01-01',
      current: true,
      summary: { en: 'Fake role.' },
      highlights: { en: '- First bullet\n* Second bullet\n\n- Third bullet' },
      technologies: ['TypeScript', 'Angular'],
    },
    {
      ...meta('exp-2', 1),
      company: 'Sample Ltd',
      role: { en: 'Engineer' },
      startDate: '2018-03-01',
      endDate: '2020-12-31',
      summary: { en: 'Another fake role.' },
      technologies: [],
    },
  ],
  skills: [
    {
      ...meta('skill-1', 0),
      category: { en: 'Frontend', fr: 'Frontend' },
      items: [
        { name: 'Angular', level: 5 },
        { name: 'CSS', level: 3 },
      ],
    },
  ],
  projects: [
    {
      ...meta('proj-1', 0),
      slug: 'example',
      title: { en: 'Example project' },
      summary: { en: 'A placeholder project.' },
      technologies: ['NestJS'],
      repoUrl: 'https://github.com/example/example',
      demoUrl: 'https://example.com/demo',
      images: [],
      featured: true,
    },
    {
      ...meta('proj-2', 1),
      slug: 'second',
      title: { en: 'Second project' },
      summary: { en: 'Without links.' },
      technologies: [],
      images: [{ url: '/shot.png', alt: { en: 'A screenshot' } }],
      featured: false,
    },
  ],
  education: [
    {
      ...meta('edu-1', 0),
      institution: 'Example University',
      degree: { en: 'Master of Examples' },
      startDate: '2012-09-01',
      endDate: '2016-06-30',
    },
  ],
  certificates: [
    {
      ...meta('cert-1', 0),
      name: { en: 'Certified Example Builder' },
      issuer: 'Example Institute',
      issuedAt: '2022-05-01',
    },
  ],
  testimonials: [
    {
      ...meta('quote-1', 0),
      authorName: 'Jane Placeholder',
      authorRole: { en: 'Fictional manager' },
      authorCompany: 'Example Corp',
      quote: { en: 'A fake testimonial.', fr: 'Un faux témoignage.' },
    },
  ],
  posts: [],
};
