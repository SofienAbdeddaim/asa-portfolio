import { Schema, type SchemaDefinition } from 'mongoose';
import { AVAILABILITY, SOCIAL_KINDS } from './dto.js';

const localized = (required = false): SchemaDefinition[string] => ({
  type: new Schema(
    {
      en: { type: String, required, default: '' },
      fr: { type: String, default: '' },
      ar: { type: String, default: '' },
    },
    { _id: false },
  ),
  required,
});

const ordered: SchemaDefinition = {
  order: { type: Number, default: 0, index: true },
  published: { type: Boolean, default: false, index: true },
};

function build(definition: SchemaDefinition, { ordering = true } = {}): Schema {
  const schema = new Schema(ordering ? { ...ordered, ...definition } : definition, {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret['id'] = String(ret['_id']);
        delete ret['_id'];
        return ret;
      },
    },
  });
  return schema;
}

export const profileSchema = build(
  {
    fullName: { type: String, required: true },
    headline: localized(true),
    bio: localized(true),
    location: localized(),
    email: { type: String, required: true },
    photoUrl: String,
    availability: {
      type: new Schema(
        { status: { type: String, enum: AVAILABILITY, required: true }, note: localized() },
        { _id: false },
      ),
      required: true,
    },
    socials: [
      new Schema(
        {
          kind: { type: String, enum: SOCIAL_KINDS, required: true },
          url: { type: String, required: true },
        },
        { _id: false },
      ),
    ],
  },
  { ordering: false },
);

export const experienceSchema = build({
  company: { type: String, required: true },
  role: localized(true),
  location: localized(),
  startDate: { type: Date, required: true },
  endDate: Date,
  current: { type: Boolean, default: false },
  summary: localized(true),
  highlights: localized(),
  technologies: [String],
});

export const skillSchema = build({
  category: localized(true),
  items: [
    new Schema(
      {
        name: { type: String, required: true },
        level: { type: Number, min: 1, max: 5, required: true },
      },
      { _id: false },
    ),
  ],
});

export const projectSchema = build({
  slug: { type: String, required: true, unique: true },
  title: localized(true),
  summary: localized(true),
  description: localized(),
  technologies: [String],
  repoUrl: String,
  demoUrl: String,
  images: [new Schema({ url: { type: String, required: true }, alt: localized() }, { _id: false })],
  featured: { type: Boolean, default: false },
});

export const educationSchema = build({
  institution: { type: String, required: true },
  degree: localized(true),
  field: localized(),
  startDate: { type: Date, required: true },
  endDate: Date,
  description: localized(),
});

export const certificateSchema = build({
  name: localized(true),
  issuer: { type: String, required: true },
  issuedAt: { type: Date, required: true },
  credentialUrl: String,
});

export const testimonialSchema = build({
  authorName: { type: String, required: true },
  authorRole: localized(),
  authorCompany: String,
  quote: localized(true),
});

export const blogPostSchema = build({
  slug: { type: String, required: true, unique: true },
  title: localized(true),
  excerpt: localized(true),
  body: localized(true),
  tags: [String],
  coverUrl: String,
  publishedAt: Date,
});
