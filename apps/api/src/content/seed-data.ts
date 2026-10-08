/**
 * Clearly fake demo content. Nothing here describes a real person, employer or school:
 * replace everything through the back-office.
 */
const t = (en: string, fr: string, ar: string) => ({ en, fr, ar });

export const DEMO_PROFILE = {
  fullName: 'Alex Placeholder',
  headline: t('Senior Software Engineer', 'Ingénieur logiciel senior', 'مهندس برمجيات أول'),
  bio: t(
    'This is placeholder text. I build fast, accessible interfaces and the services behind them, and I like teams that ship small and learn quickly.\n\nReplace this biography from the back-office.',
    "Ceci est un texte fictif. Je construis des interfaces rapides et accessibles, et les services qui les alimentent, et j'aime les équipes qui livrent petit et apprennent vite.\n\nRemplacez cette biographie depuis le back-office.",
    'هذا نص تجريبي. أبني واجهات سريعة وسهلة الوصول والخدمات التي تقف خلفها، وأحب الفرق التي تُنجز بخطوات صغيرة وتتعلم بسرعة.\n\nاستبدل هذه النبذة من لوحة الإدارة.',
  ),
  location: t('Nowhere City', 'Ville Imaginaire', 'مدينة وهمية'),
  email: 'hello@example.com',
  availability: {
    status: 'open',
    note: t('Open to examples', 'Ouvert aux exemples', 'متاح للأمثلة'),
  },
  socials: [
    { kind: 'github', url: 'https://github.com/example' },
    { kind: 'linkedin', url: 'https://www.linkedin.com/in/example' },
  ],
};

export const DEMO_CONTENT: Record<string, Record<string, unknown>[]> = {
  experiences: [
    {
      company: 'Example Corp',
      role: t('Lead Frontend Engineer', 'Ingénieur frontend référent', 'مهندس واجهات رئيسي'),
      location: t('Remote', 'À distance', 'عن بُعد'),
      startDate: '2021-01-01',
      current: true,
      summary: t(
        'Fake role used to preview the timeline: leads a design system and a team of five.',
        'Poste fictif pour la frise : pilote un design system et une équipe de cinq personnes.',
        'دور وهمي لمعاينة الخط الزمني: يقود نظام تصميم وفريقًا من خمسة أشخاص.',
      ),
      highlights: t(
        '- Cut page weight by 40% with lazy loading\n- Introduced accessibility checks in CI',
        '- Poids des pages réduit de 40 % grâce au lazy loading\n- Contrôles d’accessibilité ajoutés à la CI',
        '- خفض حجم الصفحات بنسبة 40٪ عبر التحميل الكسول\n- إضافة فحوصات إتاحة إلى التكامل المستمر',
      ),
      technologies: ['TypeScript', 'Angular', 'Tailwind CSS'],
      published: true,
    },
    {
      company: 'Sample Ltd',
      role: t('Full-stack Engineer', 'Ingénieur full-stack', 'مهندس متكامل'),
      location: t('Nowhere City', 'Ville Imaginaire', 'مدينة وهمية'),
      startDate: '2018-03-01',
      endDate: '2020-12-31',
      summary: t(
        'Another fake role: built internal tools and an events API.',
        "Un autre poste fictif : outils internes et API d'événements.",
        'دور وهمي آخر: بناء أدوات داخلية وواجهة برمجية للأحداث.',
      ),
      technologies: ['Node.js', 'MongoDB'],
      published: true,
    },
    {
      company: 'Demo Studio',
      role: t('Junior Developer', 'Développeur junior', 'مطوّر مبتدئ'),
      startDate: '2016-09-01',
      endDate: '2018-02-28',
      summary: t(
        'Fake first job: shipped marketing sites and learned to review code.',
        'Faux premier emploi : sites vitrines et apprentissage de la revue de code.',
        'أول وظيفة وهمية: مواقع تسويقية وتعلّم مراجعة الشيفرة.',
      ),
      technologies: ['JavaScript', 'CSS'],
      published: true,
    },
  ],
  skills: [
    {
      category: t('Frontend', 'Frontend', 'الواجهة الأمامية'),
      items: [
        { name: 'Angular', level: 5 },
        { name: 'TypeScript', level: 5 },
        { name: 'CSS', level: 4 },
        { name: 'Accessibility', level: 4 },
      ],
      published: true,
    },
    {
      category: t('Backend', 'Backend', 'الخلفية'),
      items: [
        { name: 'Node.js', level: 4 },
        { name: 'NestJS', level: 4 },
        { name: 'MongoDB', level: 3 },
      ],
      published: true,
    },
    {
      category: t('Tooling', 'Outillage', 'الأدوات'),
      items: [
        { name: 'Git', level: 5 },
        { name: 'Docker', level: 3 },
        { name: 'CI/CD', level: 4 },
      ],
      published: true,
    },
  ],
  projects: [
    {
      slug: 'example-design-system',
      title: t('Example design system', 'Design system exemple', 'نظام تصميم تجريبي'),
      summary: t(
        'A fake component library with tokens, docs and visual tests.',
        'Une fausse bibliothèque de composants avec tokens, documentation et tests visuels.',
        'مكتبة مكوّنات وهمية بعناصر تصميم وتوثيق واختبارات مرئية.',
      ),
      technologies: ['Angular', 'Storybook', 'Playwright'],
      repoUrl: 'https://github.com/example/design-system',
      demoUrl: 'https://example.com/design-system',
      featured: true,
      published: true,
    },
    {
      slug: 'example-api',
      title: t('Example events API', "API d'événements exemple", 'واجهة أحداث تجريبية'),
      summary: t(
        'A placeholder REST API with auth, rate limiting and OpenAPI docs.',
        'Une API REST fictive avec authentification, limitation de débit et documentation OpenAPI.',
        'واجهة REST وهمية مع مصادقة وتحديد للمعدل وتوثيق OpenAPI.',
      ),
      technologies: ['NestJS', 'MongoDB', 'Docker'],
      repoUrl: 'https://github.com/example/events-api',
      published: true,
    },
    {
      slug: 'example-dashboard',
      title: t('Example dashboard', 'Tableau de bord exemple', 'لوحة معلومات تجريبية'),
      summary: t(
        'A made-up analytics dashboard with live charts and keyboard shortcuts.',
        'Un tableau de bord fictif avec graphiques en direct et raccourcis clavier.',
        'لوحة تحليلات متخيَّلة برسوم مباشرة واختصارات لوحة المفاتيح.',
      ),
      technologies: ['TypeScript', 'D3', 'Signals'],
      demoUrl: 'https://example.com/dashboard',
      published: true,
    },
  ],
  education: [
    {
      institution: 'Example University',
      degree: t('Master of Examples', 'Master en exemples', 'ماجستير الأمثلة'),
      startDate: '2012-09-01',
      endDate: '2016-06-30',
      published: true,
    },
  ],
  certificates: [
    {
      name: t('Certified Example Builder', "Constructeur d'exemples certifié", 'منشئ أمثلة معتمد'),
      issuer: 'Example Institute',
      issuedAt: '2022-05-01',
      published: true,
    },
    {
      name: t('Accessibility Fundamentals', "Fondamentaux de l'accessibilité", 'أساسيات الإتاحة'),
      issuer: 'Sample Academy',
      issuedAt: '2023-02-01',
      published: true,
    },
  ],
  testimonials: [
    {
      authorName: 'Jane Placeholder',
      authorRole: t('Fictional manager', 'Manager fictive', 'مديرة وهمية'),
      authorCompany: 'Example Corp',
      quote: t(
        'A fake testimonial that praises shipping small and often.',
        'Un faux témoignage qui loue les livraisons petites et fréquentes.',
        'شهادة وهمية تثني على الإنجاز بخطوات صغيرة ومتكررة.',
      ),
      published: true,
    },
    {
      authorName: 'Sam Sample',
      authorRole: t('Imaginary designer', 'Designer imaginaire', 'مصمم متخيَّل'),
      authorCompany: 'Demo Studio',
      quote: t(
        'Another made-up quote about pixel-perfect handoffs.',
        'Une autre citation inventée sur des intégrations au pixel près.',
        'اقتباس متخيَّل آخر عن تسليم دقيق حتى البكسل.',
      ),
      published: true,
    },
    {
      authorName: 'Robin Mock',
      authorRole: t('Pretend CTO', 'CTO pour de faux', 'مدير تقني افتراضي'),
      authorCompany: 'Sample Ltd',
      quote: t(
        'A third pretend review, short and sweet.',
        'Un troisième avis fictif, court et gentil.',
        'مراجعة وهمية ثالثة، قصيرة ولطيفة.',
      ),
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
    {
      slug: 'building-for-rtl',
      title: t(
        'Building for right-to-left',
        'Construire pour la droite à gauche',
        'البناء للاتجاه من اليمين إلى اليسار',
      ),
      excerpt: t(
        'Placeholder notes from making a trilingual site.',
        'Notes fictives sur la création d’un site trilingue.',
        'ملاحظات تجريبية من بناء موقع بثلاث لغات.',
      ),
      body: {
        en: '# Building for right-to-left\n\nLogical properties make mirroring **free**.\n\n- Use `margin-inline-start`\n- Test in Arabic early\n\n[MDN](https://developer.mozilla.org)',
        ar: '# البناء للاتجاه من اليمين إلى اليسار\n\nالخصائص المنطقية تجعل الانعكاس **مجانيًا**.',
      },
      tags: ['css', 'rtl', 'i18n'],
      published: true,
    },
  ],
};
