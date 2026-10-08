import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const VERSION = 'v1';
/** The full GCM tag. Left to its default, a decipher accepts a truncated one, which is forgeable. */
const TAG_BYTES = 16;

/** AES-256-GCM. Output format: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(plain: string, keyBase64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyBase64, 'base64'), iv, {
    authTagLength: TAG_BYTES,
  });
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    data.toString('base64url'),
  ].join('.');
}

export function decrypt(payload: string, keyBase64: string): string {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== VERSION || !iv || !tag || !data) throw new Error('Malformed ciphertext');
  const tagBytes = Buffer.from(tag, 'base64url');
  if (tagBytes.length !== TAG_BYTES) throw new Error('Malformed ciphertext');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(keyBase64, 'base64'),
    Buffer.from(iv, 'base64url'),
    { authTagLength: TAG_BYTES },
  );
  decipher.setAuthTag(tagBytes);
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export const sha256Hex = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/**
 * Keyed hash for values that are short enough to guess offline (recovery codes): with the key kept
 * out of the database, a leaked copy of the database alone cannot be brute-forced.
 */
export function hmacHex(value: string, keyBase64: string): string {
  return createHmac('sha256', Buffer.from(keyBase64, 'base64'))
    .update(`recovery-code:${value}`)
    .digest('hex');
}

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Recovery codes look like `a1b2c-3d4e5` (40 bits of entropy each). */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const hex = randomBytes(5).toString('hex');
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });
}

export const normalizeRecoveryCode = (code: string): string => code.trim().toLowerCase();
