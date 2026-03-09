// Prefixed with _ so Vercel does not treat this file as a route handler.
type Level = 'info' | 'warn' | 'error';

export function log(
  level: Level,
  handler: string,
  message: string,
  ctx?: Record<string, unknown>,
): void {
  const entry = { level, handler, message, ts: new Date().toISOString(), ...ctx };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}
