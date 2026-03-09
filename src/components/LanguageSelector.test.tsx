import { render, screen, fireEvent } from '@testing-library/react';
import LanguageSelector from './LanguageSelector';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BASE_LANGUAGES } from '../i18n/languages';

const mockChangeLanguage = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const strings: Record<string, string> = {
        'language.label': 'Language',
      };
      return strings[key] ?? key;
    },
    i18n: {
      language: 'en',
      changeLanguage: mockChangeLanguage,
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Languages: () => <svg data-testid="languages-icon" />,
}));

describe('LanguageSelector (pseudolocale disabled)', () => {
  it(`renders all ${BASE_LANGUAGES.length} base languages in the dropdown`, () => {
    render(<LanguageSelector />);
    const select = screen.getByRole('combobox', { name: 'Language' });
    const options = Array.from(select.querySelectorAll('option'));

    expect(options).toHaveLength(BASE_LANGUAGES.length);
    for (const lang of BASE_LANGUAGES) {
      const option = options.find(o => o.value === lang.code);
      expect(option, `Option for language code "${lang.code}" should exist`).toBeTruthy();
      expect(option?.textContent).toBe(lang.label);
    }
  });

  it('does not show en-XA option when pseudolocale is disabled', () => {
    render(<LanguageSelector />);
    const select = screen.getByRole('combobox', { name: 'Language' });
    const options = Array.from(select.querySelectorAll('option'));
    expect(options.find(o => o.value === 'en-XA')).toBeUndefined();
  });

  it.each(BASE_LANGUAGES)(
    'selecting "$label" calls changeLanguage with "$code"',
    ({ code }) => {
      mockChangeLanguage.mockClear();
      render(<LanguageSelector />);
      const select = screen.getByRole('combobox', { name: 'Language' });
      fireEvent.change(select, { target: { value: code } });
      expect(mockChangeLanguage).toHaveBeenCalledWith(code);
    }
  );
});

describe('LanguageSelector (pseudolocale enabled)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_PSEUDOLOCALE', 'true');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('includes en-XA option when pseudolocale is enabled', async () => {
    const { default: LanguageSelectorWithPseudo } = await import('./LanguageSelector');
    render(<LanguageSelectorWithPseudo />);
    const select = screen.getByRole('combobox', { name: 'Language' });
    const options = Array.from(select.querySelectorAll('option'));

    expect(options).toHaveLength(BASE_LANGUAGES.length + 1);
    const pseudoOption = options.find(o => o.value === 'en-XA');
    expect(pseudoOption, 'en-XA option should exist').toBeTruthy();
  });

  it('selecting en-XA calls changeLanguage with "en-XA"', async () => {
    mockChangeLanguage.mockClear();
    const { default: LanguageSelectorWithPseudo } = await import('./LanguageSelector');
    render(<LanguageSelectorWithPseudo />);
    const select = screen.getByRole('combobox', { name: 'Language' });
    fireEvent.change(select, { target: { value: 'en-XA' } });
    expect(mockChangeLanguage).toHaveBeenCalledWith('en-XA');
  });
});
