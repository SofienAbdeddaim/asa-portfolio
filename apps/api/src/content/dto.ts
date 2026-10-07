import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsLocalized, MAX_LONG, MAX_MARKDOWN, MAX_SHORT } from '../common/localized.js';

const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true };
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---- reusable property decorators ------------------------------------------------------------

type Decorator = PropertyDecorator;
const apply =
  (...decorators: Decorator[]): Decorator =>
  (target, key) =>
    decorators.forEach((decorator) => decorator(target, key));

const Text = (max = 200): Decorator =>
  apply(ApiProperty({ type: String }), IsString(), MaxLength(max));
const OptionalText = (max = 500): Decorator =>
  apply(ApiPropertyOptional({ type: String }), IsOptional(), IsString(), MaxLength(max));
const OptionalUrl = (): Decorator =>
  apply(ApiPropertyOptional({ type: String }), IsOptional(), IsUrl(URL_OPTIONS), MaxLength(500));
const DateField = (): Decorator =>
  apply(ApiProperty({ type: String, format: 'date' }), IsDateString());
const OptionalDate = (): Decorator =>
  apply(ApiPropertyOptional({ type: String, format: 'date' }), IsOptional(), IsDateString());
const Slug = (): Decorator =>
  apply(
    ApiProperty({ type: String }),
    IsString(),
    MaxLength(80),
    Matches(SLUG, { message: 'slug must be kebab-case' }),
  );
const Tags = (): Decorator =>
  apply(
    ApiPropertyOptional({ type: [String] }),
    IsOptional(),
    IsArray(),
    ArrayMaxSize(30),
    IsString({ each: true }),
    MaxLength(40, { each: true }),
  );
const OptionalLocalized = (max = MAX_SHORT): Decorator => apply(IsOptional(), IsLocalized(max));
const Published = (): Decorator =>
  apply(ApiPropertyOptional({ type: Boolean }), IsOptional(), IsBoolean());

// ---- profile ----------------------------------------------------------------------------------

export const AVAILABILITY = ['open', 'limited', 'closed'] as const;
export const SOCIAL_KINDS = ['github', 'linkedin', 'x', 'website', 'other'] as const;

export class AvailabilityDto {
  @ApiProperty({ enum: AVAILABILITY, type: String })
  @IsEnum(AVAILABILITY)
  status!: (typeof AVAILABILITY)[number];

  @OptionalLocalized()
  note?: Record<string, string>;
}

export class SocialLinkDto {
  @ApiProperty({ enum: SOCIAL_KINDS, type: String })
  @IsEnum(SOCIAL_KINDS)
  kind!: (typeof SOCIAL_KINDS)[number];

  @ApiProperty({ type: String })
  @IsUrl(URL_OPTIONS)
  @MaxLength(500)
  url!: string;
}

export class ProfileDto {
  @Text()
  fullName!: string;

  @IsLocalized()
  headline!: Record<string, string>;

  @IsLocalized(MAX_LONG)
  bio!: Record<string, string>;

  @OptionalLocalized()
  location?: Record<string, string>;

  @ApiProperty({ type: String })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @OptionalText()
  photoUrl?: string;

  @ApiProperty({ type: AvailabilityDto })
  @ValidateNested()
  @Type(() => AvailabilityDto)
  availability!: AvailabilityDto;

  @ApiProperty({ type: [SocialLinkDto] })
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socials!: SocialLinkDto[];
}

// ---- ordered content --------------------------------------------------------------------------

export class ExperienceDto {
  @Text()
  company!: string;

  @IsLocalized()
  role!: Record<string, string>;

  @OptionalLocalized()
  location?: Record<string, string>;

  @DateField()
  startDate!: string;

  @OptionalDate()
  endDate?: string;

  @apply(ApiPropertyOptional({ type: Boolean }), IsOptional(), IsBoolean())
  current?: boolean;

  @IsLocalized(MAX_LONG)
  summary!: Record<string, string>;

  /** Markdown bullet list. */
  @OptionalLocalized(MAX_LONG)
  highlights?: Record<string, string>;

  @Tags()
  technologies?: string[];

  @Published()
  published?: boolean;
}

export class SkillItemDto {
  @Text(80)
  name!: string;

  @ApiProperty({ type: Number, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  level!: number;
}

export class SkillDto {
  @IsLocalized(120)
  category!: Record<string, string>;

  @ApiProperty({ type: [SkillItemDto] })
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => SkillItemDto)
  items!: SkillItemDto[];

  @Published()
  published?: boolean;
}

export class ProjectImageDto {
  @Text(500)
  url!: string;

  @OptionalLocalized()
  alt?: Record<string, string>;
}

export class ProjectDto {
  @Slug()
  slug!: string;

  @IsLocalized()
  title!: Record<string, string>;

  @IsLocalized()
  summary!: Record<string, string>;

  /** Markdown. */
  @OptionalLocalized(MAX_MARKDOWN)
  description?: Record<string, string>;

  @Tags()
  technologies?: string[];

  @OptionalUrl()
  repoUrl?: string;

  @OptionalUrl()
  demoUrl?: string;

  @apply(
    ApiPropertyOptional({ type: [ProjectImageDto] }),
    IsOptional(),
    IsArray(),
    ArrayMaxSize(12),
    ValidateNested({ each: true }),
    Type(() => ProjectImageDto),
  )
  images?: ProjectImageDto[];

  @apply(ApiPropertyOptional({ type: Boolean }), IsOptional(), IsBoolean())
  featured?: boolean;

  @Published()
  published?: boolean;
}

export class EducationDto {
  @Text()
  institution!: string;

  @IsLocalized()
  degree!: Record<string, string>;

  @OptionalLocalized()
  field?: Record<string, string>;

  @DateField()
  startDate!: string;

  @OptionalDate()
  endDate?: string;

  @OptionalLocalized(MAX_LONG)
  description?: Record<string, string>;

  @Published()
  published?: boolean;
}

export class CertificateDto {
  @IsLocalized()
  name!: Record<string, string>;

  @Text()
  issuer!: string;

  @DateField()
  issuedAt!: string;

  @OptionalUrl()
  credentialUrl?: string;

  @Published()
  published?: boolean;
}

export class TestimonialDto {
  @Text()
  authorName!: string;

  @OptionalLocalized()
  authorRole?: Record<string, string>;

  @OptionalText(200)
  authorCompany?: string;

  @IsLocalized(MAX_LONG)
  quote!: Record<string, string>;

  @Published()
  published?: boolean;
}

export class BlogPostDto {
  @Slug()
  slug!: string;

  @IsLocalized()
  title!: Record<string, string>;

  @IsLocalized(MAX_LONG)
  excerpt!: Record<string, string>;

  /** Markdown, sanitized when rendered. */
  @IsLocalized(MAX_MARKDOWN)
  body!: Record<string, string>;

  @Tags()
  tags?: string[];

  @OptionalText()
  coverUrl?: string;

  @Published()
  published?: boolean;
}

export class ReorderDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  ids!: string[];
}
