/**
 * Returns the URL only if it uses an allowed protocol (https or http).
 * Blocks javascript:, data:, and other potentially dangerous schemes.
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return url;
    }
  } catch {
    // Invalid URL
  }
  return '#';
}
