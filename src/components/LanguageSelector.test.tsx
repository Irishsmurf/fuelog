import { render, screen, fireEvent } from '@testing-library/react';
import LanguageSelector from './LanguageSelector';
import { describe, it, expect, vi } from 'vitest';

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

const EXPECTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ga', label: 'Gaeilge' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
];

describe('LanguageSelector', () => {
  it('renders all languages in the dropdown', () => {
    render(<LanguageSelector />);
    const select = screen.getByRole('combobox', { name: 'Language' });
    const options = Array.from(select.querySelectorAll('option'));

    expect(options).toHaveLength(EXPECTED_LANGUAGES.length);
    for (const lang of EXPECTED_LANGUAGES) {
      const option = options.find(o => o.value === lang.code);
      expect(option, `Option for language code "${lang.code}" should exist`).toBeTruthy();
      expect(option?.textContent).toBe(lang.label);
    }
  });

  it.each(EXPECTED_LANGUAGES)(
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
