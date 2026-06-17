import { describe, it, expect } from 'vitest';
import en from './locales/en.json';
import ga from './locales/ga.json';

describe('i18n translations', () => {
  it('should not have identical objects for profile.maintenance in en and ga', () => {
    expect(en.profile.maintenance.heading).not.toBe(ga.profile.maintenance.heading);
  });
});
