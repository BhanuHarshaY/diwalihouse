type Level = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured, single-line JSON logs (Vercel and most collectors parse these).
 * Never pass tokens, cookies, raw IPs, or invite codes in `fields`.
 */
export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function errorFields(error: unknown): Record<string, unknown> {
  if (error instanceof Error) return { error: error.name, message: error.message };
  return { error: String(error) };
}
