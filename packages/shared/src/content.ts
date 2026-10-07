import type { LocalizedString } from './localized.js';

/** Shapes returned by the public API. Dates are ISO strings. */

interface Entry {
  id: string;
  order: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Social {
  kind: 'github' | 'linkedin' | 'x' | 'website' | 'other';
  url: string;
}

export interface Profile {
  id: string;
  fullName: string;
  headline: LocalizedString;
  bio: LocalizedString;
  location?: LocalizedString;
  email: string;
  photoUrl?: string;
  availability: { status: 'open' | 'limited' | 'closed'; note?: LocalizedString };
  socials: Social[];
}

export interface Experience extends Entry {
  company: string;
  role: LocalizedString;
  location?: LocalizedString;
  startDate: string;
  endDate?: string;
  current?: boolean;
  summary: LocalizedString;
  highlights?: LocalizedString;
  technologies: string[];
}

export interface Skill extends Entry {
  category: LocalizedString;
  items: { name: string; level: 1 | 2 | 3 | 4 | 5 }[];
}

export interface Project extends Entry {
  slug: string;
  title: LocalizedString;
  summary: LocalizedString;
  description?: LocalizedString;
  technologies: string[];
  repoUrl?: string;
  demoUrl?: string;
  images: { url: string; alt?: LocalizedString }[];
  featured: boolean;
}

export interface Education extends Entry {
  institution: string;
  degree: LocalizedString;
  field?: LocalizedString;
  startDate: string;
  endDate?: string;
  description?: LocalizedString;
}

export interface Certificate extends Entry {
  name: LocalizedString;
  issuer: string;
  issuedAt: string;
  credentialUrl?: string;
}

export interface Testimonial extends Entry {
  authorName: string;
  authorRole?: LocalizedString;
  authorCompany?: string;
  quote: LocalizedString;
}

export interface BlogPost extends Entry {
  slug: string;
  title: LocalizedString;
  excerpt: LocalizedString;
  body: LocalizedString;
  tags: string[];
  coverUrl?: string;
  publishedAt?: string;
}

/** Response of `GET /api/content` and shape of the build-time `content-snapshot.json`. */
export interface ContentSnapshot {
  generatedAt: string;
  profile: Profile | null;
  experiences: Experience[];
  skills: Skill[];
  projects: Project[];
  education: Education[];
  certificates: Certificate[];
  testimonials: Testimonial[];
  posts: BlogPost[];
}
