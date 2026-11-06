/**
 * Generates a realtime ticket key pair for local development and writes it
 * where each side reads it:
 *   private key → apps/web/.env.local        (REALTIME_PRIVATE_KEY)
 *   public key  → apps/realtime/.dev.vars    (REALTIME_PUBLIC_KEY)
 * Existing values are replaced; nothing else in those files is touched.
 * For production, set the same variables as secrets (see README).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateTicketKeys } from './ticket.ts';

function upsert(path: string, name: string, value: string) {
  const line = `${name}='${value}'`;
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  const next = pattern.test(current)
    ? current.replace(pattern, line)
    : `${current.trimEnd()}\n${line}\n`;
  writeFileSync(path, next.startsWith('\n') ? next.slice(1) : next);
  console.log(`  wrote ${name} to ${path}`);
}

const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
const { privateJwk, publicJwk } = await generateTicketKeys();
upsert(root('apps/web/.env.local'), 'REALTIME_PRIVATE_KEY', JSON.stringify(privateJwk));
upsert(root('apps/realtime/.dev.vars'), 'REALTIME_PUBLIC_KEY', JSON.stringify(publicJwk));
