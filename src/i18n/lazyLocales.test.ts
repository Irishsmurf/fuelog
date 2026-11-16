import { describe, it, expect, beforeEach, vi } from 'vitest';
import fr from './locales/fr.json';
import en from './locales/en.json';

describe('i18n lazy locales', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('loads a non-English locale on demand when it is the detected language', async () => {
    localStorage.setItem('fuelog_language', 'fr');
    const { default: i18n, i18nReady } = await import('./index');
    await i18nReady;
    expect(i18n.language).toBe('fr');
    expect(i18n.hasResourceBundle('fr', 'translation')).toBe(true);
    expect(i18n.t('about.title')).toBe(fr.about.title);
  });

  it('loads a locale before switching to it', async () => {
    localStorage.setItem('fuelog_language', 'en');
    const { default: i18n, i18nReady } = await import('./index');
    await i18nReady;
    expect(i18n.hasResourceBundle('de', 'translation')).toBe(false);
    await i18n.changeLanguage('de');
    expect(i18n.hasResourceBundle('de', 'translation')).toBe(true);
    expect(i18n.t('about.title')).not.toBe(en.about.title);
  });
});
