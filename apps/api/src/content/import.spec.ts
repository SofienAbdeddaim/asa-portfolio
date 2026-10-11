import { describe, expect, it } from 'vitest';
import { validateContentFile } from './import.js';
import { DEMO_CONTENT, DEMO_PROFILE } from './seed-data.js';

describe('validateContentFile', () => {
  it('accepts the demo content and keeps the entries in file order', async () => {
    const result = await validateContentFile({ profile: DEMO_PROFILE, ...DEMO_CONTENT });
    expect(result.profile?.['fullName']).toBe('Alex Placeholder');
    expect(result.resources['experiences']?.map((entry) => entry['company'])).toEqual([
      'Example Corp',
      'Sample Ltd',
      'Demo Studio',
    ]);
  });

  it('only returns the kinds present in the file', async () => {
    const result = await validateContentFile({ skills: DEMO_CONTENT['skills'] });
    expect(result.profile).toBeUndefined();
    expect(Object.keys(result.resources)).toEqual(['skills']);
  });

  it('rejects unknown keys, non-arrays and entries the back-office would refuse', async () => {
    await expect(validateContentFile([])).rejects.toThrow('must be a JSON object');
    await expect(validateContentFile({ users: [] })).rejects.toThrow('Unknown keys');
    await expect(validateContentFile({ skills: {} })).rejects.toThrow('skills must be an array');
    await expect(
      validateContentFile({
        skills: [{ category: { en: 'X' }, items: [{ name: 'A', level: 9 }] }],
      }),
    ).rejects.toThrow(/^skills\[0\]: /);
    await expect(
      validateContentFile({ profile: { ...DEMO_PROFILE, password: 'nope' } }),
    ).rejects.toThrow(/^profile: .*password/);
  });
});
