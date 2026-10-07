/**
 * Clearly fake demo content. Nothing here describes a real person, employer or school:
 * replace everything through the back-office.
 */
const t = (en: string, fr: string, ar: string) => ({ en, fr, ar });

export const DEMO_PROFILE = {
  fullName: 'Your Name (placeholder)',
  headline: t('Senior Software Engineer', 'Ingénieur logiciel senior', 'مهندس برمجيات أول'),
  bio: t(
    'Placeholder biography. Replace this text from the back-office.',
    'Biographie fictive. Remplacez ce texte depuis le back-office.',
    'نبذة تجريبية. استبدل هذا النص من لوحة الإدارة.',
  ),
  location: t('Nowhere City', 'Ville Imaginaire', 'مدينة وهمية'),
  email: 'hello@example.com',
  availability: {
    status: 'open',
    note: t('Open to examples', 'Ouvert aux exemples', 'متاح للأمثلة'),
  },
  socials: [{ kind: 'github', url: 'https://github.com/example' }],
};

export const DEMO_CONTENT: Record<string, Record<string, unknown>[]> = {
  experiences: [
    {
      company: 'Example Corp',
      role: t('Lead Engineer', 'Ingénieur référent', 'مهندس رئيسي'),
      startDate: '2021-01-01',
      current: true,
      summary: t(
        'Fake role used to preview the timeline.',
        'Poste fictif pour la frise.',
        'دور وهمي لمعاينة الخط الزمني.',
      ),
      technologies: ['TypeScript', 'Angular'],
      published: true,
    },
    {
      company: 'Sample Ltd',
      role: t('Engineer', 'Ingénieur', 'مهندس'),
      startDate: '2017-09-01',
      endDate: '2020-12-31',
      summary: t('Another fake role.', 'Un autre poste fictif.', 'دور وهمي آخر.'),
      technologies: ['Node.js'],
      published: true,
    },
  ],
  skills: [
    {
      category: t('Frontend', 'Frontend', 'الواجهة الأمامية'),
      items: [
        { name: 'Angular', level: 5 },
        { name: 'TypeScript', level: 5 },
      ],
      published: true,
    },
  ],
  projects: [
    {
      slug: 'example-project',
      title: t('Example project', 'Projet exemple', 'مشروع تجريبي'),
      summary: t('A placeholder project.', 'Un projet fictif.', 'مشروع وهمي.'),
      technologies: ['NestJS', 'MongoDB'],
      repoUrl: 'https://github.com/example/example-project',
      featured: true,
      published: true,
    },
  ],
  education: [
    {
      institution: 'Example University',
      degree: t('Master of Examples', 'Master en exemples', 'ماجستير الأمثلة'),
      startDate: '2012-09-01',
      endDate: '2017-06-30',
      published: true,
    },
  ],
  certificates: [
    {
      name: t('Certified Example Builder', 'Constructeur d’exemples certifié', 'منشئ أمثلة معتمد'),
      issuer: 'Example Institute',
      issuedAt: '2022-05-01',
      published: true,
    },
  ],
  testimonials: [
    {
      authorName: 'Jane Placeholder',
      authorRole: t('Fictional manager', 'Manager fictive', 'مديرة وهمية'),
      authorCompany: 'Example Corp',
      quote: t('A fake testimonial.', 'Un témoignage fictif.', 'شهادة وهمية.'),
      published: true,
    },
  ],
  posts: [
    {
      slug: 'hello-world',
      title: t('Hello, world', 'Bonjour le monde', 'مرحبا بالعالم'),
      excerpt: t('A placeholder post.', 'Un article fictif.', 'مقال وهمي.'),
      body: t(
        '# Hello\n\nPlaceholder **markdown**.',
        '# Bonjour\n\nMarkdown **fictif**.',
        '# مرحبا\n\nنص **تجريبي**.',
      ),
      tags: ['example'],
      published: true,
    },
  ],
};
