import { describe, it, expect } from 'vitest';
import { BASE_LANGUAGES, PSEUDOLOCALE } from './languages';

describe('BASE_LANGUAGES', () => {
  it('should be an array with 10 items', () => {
    expect(Array.isArray(BASE_LANGUAGES)).toBe(true);
    expect(BASE_LANGUAGES).toHaveLength(10);
  });

  it('should have correct structure for each language', () => {
    BASE_LANGUAGES.forEach((lang) => {
      expect(lang).toHaveProperty('code');
      expect(lang).toHaveProperty('label');
      expect(typeof lang.code).toBe('string');
      expect(typeof lang.label).toBe('string');
    });
  });

  it('should include English (en)', () => {
    const en = BASE_LANGUAGES.find((lang) => lang.code === 'en');
    expect(en).toBeDefined();
    expect(en?.label).toBe('English');
  });

  it('should have unique codes', () => {
    const codes = BASE_LANGUAGES.map((lang) => lang.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });
});

describe('PSEUDOLOCALE', () => {
  it('should have correct structure', () => {
    expect(PSEUDOLOCALE).toHaveProperty('code');
    expect(PSEUDOLOCALE).toHaveProperty('label');
    expect(typeof PSEUDOLOCALE.code).toBe('string');
    expect(typeof PSEUDOLOCALE.label).toBe('string');
  });

  it('should have a specific code', () => {
    expect(PSEUDOLOCALE.code).toBe('en-XA');
  });
});
