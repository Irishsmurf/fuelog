import { describe, it, expect } from 'vitest';
import { pseudolocalizeString, pseudolocalizeResources } from './pseudolocalize';

describe('pseudolocalizeString', () => {
  it('wraps output in [[ ]] brackets', () => {
    const result = pseudolocalizeString('Hello');
    expect(result).toMatch(/^\[\[ .+ \]\]$/);
  });

  it('transforms ASCII letters to accented equivalents', () => {
    const result = pseudolocalizeString('abc');
    expect(result).toBe('[[ àƀć ]]');
  });

  it('preserves uppercase mapping', () => {
    const result = pseudolocalizeString('ABC');
    expect(result).toBe('[[ ÀƁĆ ]]');
  });

  it('preserves {{interpolation}} placeholders unchanged', () => {
    const result = pseudolocalizeString('Hello {{name}}, you have {{count}} items');
    expect(result).toContain('{{name}}');
    expect(result).toContain('{{count}}');
  });

  it('transforms text around placeholders', () => {
    const result = pseudolocalizeString('Cost: {{amount}}');
    // 'Cost: ' should be transformed, {{amount}} preserved
    expect(result).toContain('{{amount}}');
    expect(result).not.toContain('Cost:');
  });

  it('preserves non-ASCII characters unchanged', () => {
    const result = pseudolocalizeString('Café 日本語');
    expect(result).toContain('é');
    expect(result).toContain('日本語');
  });

  it('handles empty string', () => {
    const result = pseudolocalizeString('');
    expect(result).toBe('[[  ]]');
  });
});

describe('pseudolocalizeResources', () => {
  it('transforms all string values in a flat object', () => {
    const input = { greeting: 'Hello', farewell: 'Bye' };
    const result = pseudolocalizeResources(input);
    expect(result.greeting).toBe('[[ Ĥëļļö ]]');
    expect(result.farewell).toBe('[[ Ɓŷë ]]');
  });

  it('recursively transforms nested objects', () => {
    const input = { nav: { home: 'Home', about: 'About' } };
    const result = pseudolocalizeResources(input);
    expect((result.nav as Record<string, string>).home).toBe('[[ Ĥöɱë ]]');
    expect((result.nav as Record<string, string>).about).toBe('[[ Àƀöüţ ]]');
  });

  it('leaves non-string values unchanged', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = { count: 42, flag: true, nothing: null } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = pseudolocalizeResources(input) as any;
    expect(result.count).toBe(42);
    expect(result.flag).toBe(true);
    expect(result.nothing).toBeNull();
  });

  it('preserves placeholders in nested translations', () => {
    const input = { msg: { rate: 'Rate: {{value}}' } };
    const result = pseudolocalizeResources(input);
    expect((result.msg as Record<string, string>).rate).toContain('{{value}}');
  });
});
