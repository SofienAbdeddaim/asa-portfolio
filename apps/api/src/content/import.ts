import { ValidationPipe, type Type } from '@nestjs/common';
import { ProfileDto } from './dto.js';
import { RESOURCES } from './resources.js';

/**
 * A content file for `content:import`: the profile and any content kinds, keyed like the public
 * snapshot (`experiences`, `skills`…). Kinds left out of the file are not touched by an import.
 */
export interface ContentFile {
  profile?: Record<string, unknown>;
  [path: string]: unknown;
}

export interface ValidatedContent {
  profile?: Record<string, unknown>;
  /** Entries in the order they will be created, which becomes their manual order. */
  resources: Record<string, Record<string, unknown>[]>;
}

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function check(dto: Type<unknown>, value: unknown, where: string) {
  try {
    return (await pipe.transform(value, { type: 'body', metatype: dto })) as Record<
      string,
      unknown
    >;
  } catch (error) {
    const response = (error as { getResponse?: () => { message?: unknown } }).getResponse?.();
    const details = Array.isArray(response?.message) ? response.message.join('; ') : String(error);
    throw new Error(`${where}: ${details}`, { cause: error });
  }
}

/**
 * Validates a whole content file against the same DTOs as the back-office, so nothing is written
 * unless every entry would also have been accepted there.
 */
export async function validateContentFile(file: unknown): Promise<ValidatedContent> {
  if (file === null || typeof file !== 'object' || Array.isArray(file)) {
    throw new Error('The content file must be a JSON object');
  }
  const known = new Set(['profile', ...RESOURCES.map((definition) => definition.path)]);
  const unknown = Object.keys(file).filter((key) => !known.has(key));
  if (unknown.length) throw new Error(`Unknown keys in the content file: ${unknown.join(', ')}`);

  const data = file as ContentFile;
  const result: ValidatedContent = { resources: {} };
  if (data.profile !== undefined) result.profile = await check(ProfileDto, data.profile, 'profile');
  for (const definition of RESOURCES) {
    const entries = data[definition.path];
    if (entries === undefined) continue;
    if (!Array.isArray(entries)) throw new Error(`${definition.path} must be an array`);
    const checked: Record<string, unknown>[] = [];
    for (const [index, entry] of entries.entries()) {
      checked.push(await check(definition.dto, entry, `${definition.path}[${index}]`));
    }
    result.resources[definition.path] = checked;
  }
  return result;
}
