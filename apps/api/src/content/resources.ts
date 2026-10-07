import type { Type } from '@nestjs/common';
import type { Schema } from 'mongoose';
import {
  BlogPostDto,
  CertificateDto,
  EducationDto,
  ExperienceDto,
  ProjectDto,
  SkillDto,
  TestimonialDto,
} from './dto.js';
import {
  blogPostSchema,
  certificateSchema,
  educationSchema,
  experienceSchema,
  projectSchema,
  skillSchema,
  testimonialSchema,
} from './schemas.js';

export interface ResourceDefinition {
  /** URL segment and key in the content snapshot. */
  path: string;
  modelName: string;
  schema: Schema;
  dto: Type<unknown>;
  /** Exposes `GET /<path>/slug/:slug` and requires a unique slug. */
  hasSlug?: boolean;
  /** Stamps `publishedAt` the first time the entry is published. */
  stampPublishedAt?: boolean;
  /** Public list order. Defaults to the manual drag-and-drop `order`. */
  publicSort?: Record<string, 1 | -1>;
}

export const RESOURCES: readonly ResourceDefinition[] = [
  { path: 'experiences', modelName: 'Experience', schema: experienceSchema, dto: ExperienceDto },
  { path: 'skills', modelName: 'Skill', schema: skillSchema, dto: SkillDto },
  { path: 'projects', modelName: 'Project', schema: projectSchema, dto: ProjectDto, hasSlug: true },
  { path: 'education', modelName: 'Education', schema: educationSchema, dto: EducationDto },
  {
    path: 'certificates',
    modelName: 'Certificate',
    schema: certificateSchema,
    dto: CertificateDto,
  },
  {
    path: 'testimonials',
    modelName: 'Testimonial',
    schema: testimonialSchema,
    dto: TestimonialDto,
  },
  {
    path: 'posts',
    modelName: 'BlogPost',
    schema: blogPostSchema,
    dto: BlogPostDto,
    hasSlug: true,
    stampPublishedAt: true,
    publicSort: { publishedAt: -1 },
  },
];

export const serviceToken = (definition: ResourceDefinition): string =>
  `CONTENT:${definition.path}`;
