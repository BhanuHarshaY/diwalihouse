import { createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * Session bearer tokens: 32 random bytes, base64url. Only the SHA-256 hash is
 * stored, so a database leak does not hand out working sessions. Plain
 * SHA-256 (not a slow KDF) is right here: the input is uniformly random, not
 * a password.
 */
export interface SessionToken {
  token: string;
  hash: Buffer;
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function newSessionToken(): SessionToken {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/** Cheap shape check so garbage cookies never reach the database. */
export function isWellFormedToken(token: string | undefined): token is string {
  return token !== undefined && TOKEN_PATTERN.test(token);
}

/** Keyed hash of a client identifier (an IP) so raw addresses are never stored. */
export function pepperedKey(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url').slice(0, 32);
}
