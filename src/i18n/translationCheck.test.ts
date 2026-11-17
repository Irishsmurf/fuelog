import { describe, it, expect } from 'vitest';
import en from './locales/en.json';
import ga from './locales/ga.json';

describe('i18n translations', () => {
  it('should not have identical profile strings in en and ga', () => {
    expect(en.profile.vehicleFleet).not.toBe(ga.profile.vehicleFleet);
  });
});
