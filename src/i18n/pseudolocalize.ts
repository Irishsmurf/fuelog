/**
 * Pseudolocalization (en-XA) utilities.
 *
 * Transforms English strings into visually distinct accented characters so
 * layout issues, hard-coded strings, and missing translations are easy to spot
 * during development/staging. Interpolation placeholders ({{…}}) are preserved
 * unchanged so the app still functions correctly.
 *
 * Only loaded when VITE_ENABLE_PSEUDOLOCALE=true — never in production.
 */

const CHAR_MAP: Record<string, string> = {
  a: 'à', A: 'À',
  b: 'ƀ', B: 'Ɓ',
  c: 'ć', C: 'Ć',
  d: 'ď', D: 'Ď',
  e: 'ë', E: 'Ë',
  f: 'ƒ', F: 'Ƒ',
  g: 'ĝ', G: 'Ĝ',
  h: 'ĥ', H: 'Ĥ',
  i: 'ï', I: 'Ï',
  j: 'ĵ', J: 'Ĵ',
  k: 'ķ', K: 'Ķ',
  l: 'ļ', L: 'Ļ',
  m: 'ɱ', M: 'Ɱ',
  n: 'ñ', N: 'Ñ',
  o: 'ö', O: 'Ö',
  p: 'þ', P: 'Þ',
  q: 'q', Q: 'Q',
  r: 'ŗ', R: 'Ŗ',
  s: 'š', S: 'Š',
  t: 'ţ', T: 'Ţ',
  u: 'ü', U: 'Ü',
  v: 'v', V: 'V',
  w: 'ŵ', W: 'Ŵ',
  x: 'x', X: 'X',
  y: 'ŷ', Y: 'Ŷ',
  z: 'ž', Z: 'Ž',
};

// Matches i18next interpolation tokens like {{foo}} or {{foo, format}}
const PLACEHOLDER_RE = /(\{\{[^}]+\}\})/g;

export function pseudolocalizeString(input: string): string {
  // Split on placeholders so we only transform the text segments
  const parts = input.split(PLACEHOLDER_RE);
  const transformed = parts.map((part) => {
    if (PLACEHOLDER_RE.test(part)) {
      PLACEHOLDER_RE.lastIndex = 0; // reset stateful regex
      return part; // leave {{…}} tokens intact
    }
    return part
      .split('')
      .map((ch) => CHAR_MAP[ch] ?? ch)
      .join('');
  });
  // Wrap in [[ ]] so untranslated strings stand out
  return `[[ ${transformed.join('')} ]]`;
}

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

/** Recursively pseudolocalize every string value in a translation resource. */
export function pseudolocalizeResources(obj: JsonObject): JsonObject {
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = pseudolocalizeString(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = pseudolocalizeResources(value as JsonObject);
    } else {
      result[key] = value;
    }
  }
  return result;
}
