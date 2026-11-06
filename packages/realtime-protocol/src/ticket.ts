/**
 * Realtime tickets: short-lived, party-scoped credentials signed by the web
 * app (which holds the private key) and verified by the realtime Worker
 * (which holds only the public key). Ed25519 via WebCrypto, so the same code
 * runs in Node, browsers and Workers.
 *
 * Format: `v1.<base64url(claims JSON)>.<base64url(signature)>`, the
 * signature covering `v1.<claims>`. Revocation notices use `r1.` instead.
 */

export interface TicketClaims {
  v: 1;
  party: string;
  member: string;
  role: 'host' | 'guest';
  name: string;
  emblem: string;
  /** Expiry, epoch milliseconds. */
  exp: number;
  /** Unique id; lets rooms refuse replays within the ticket's lifetime. */
  jti: string;
}

export const TICKET_TTL_MS = 60_000;
const ALGORITHM = { name: 'Ed25519' } as const;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Runtimes disagree on the JWK `alg` for Ed25519 (Node writes "Ed25519",
 * Workers expects "EdDSA"). The algorithm is fixed by the import call, so
 * the field carries no information here; drop it.
 */
function importKey(jwk: JsonWebKey, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  const { alg: _alg, ...rest } = jwk;
  return crypto.subtle.importKey('jwk', rest, ALGORITHM, false, [usage]);
}

export async function generateTicketKeys(): Promise<{
  privateJwk: JsonWebKey;
  publicJwk: JsonWebKey;
}> {
  const pair = (await crypto.subtle.generateKey(ALGORITHM, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  return {
    privateJwk: (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey,
    publicJwk: (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey,
  };
}

/**
 * Each kind of signed token has its own prefix, and the prefix is covered by
 * the signature, so a ticket can never be presented as a revocation notice
 * or the other way round.
 */
type Prefix = 'v1' | 'r1';

async function sign(privateJwk: JsonWebKey, prefix: Prefix, claims: object): Promise<string> {
  const key = await importKey(privateJwk, 'sign');
  const body = `${prefix}.${toBase64Url(encoder.encode(JSON.stringify(claims)))}`;
  const signature = new Uint8Array(await crypto.subtle.sign(ALGORITHM, key, encoder.encode(body)));
  return `${body}.${toBase64Url(signature)}`;
}

export type TicketFailure = 'malformed' | 'bad-signature' | 'expired' | 'wrong-party';

type Verified<C> = { ok: true; claims: C } | { ok: false; reason: TicketFailure };

/** Signature, shape, lifetime and party checks shared by every token kind. */
async function verify<C extends { v: 1; party: string; member: string; exp: number }>(
  publicJwk: JsonWebKey,
  prefix: Prefix,
  token: string,
  { now, party }: { now: number; party: string },
): Promise<Verified<C>> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== prefix) return { ok: false, reason: 'malformed' };
  const payload = fromBase64Url(parts[1]!);
  const signature = fromBase64Url(parts[2]!);
  if (!payload || !signature) return { ok: false, reason: 'malformed' };

  const key = await importKey(publicJwk, 'verify');
  const valid = await crypto.subtle.verify(
    ALGORITHM,
    key,
    signature,
    encoder.encode(`${prefix}.${parts[1]}`),
  );
  if (!valid) return { ok: false, reason: 'bad-signature' };

  let claims: C;
  try {
    claims = JSON.parse(decoder.decode(payload)) as C;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (claims.v !== 1 || typeof claims.exp !== 'number' || typeof claims.member !== 'string') {
    return { ok: false, reason: 'malformed' };
  }
  if (claims.exp - now > 2 * TICKET_TTL_MS) return { ok: false, reason: 'malformed' };
  if (claims.exp <= now) return { ok: false, reason: 'expired' };
  if (claims.party !== party) return { ok: false, reason: 'wrong-party' };
  return { ok: true, claims };
}

export function signTicket(privateJwk: JsonWebKey, claims: TicketClaims): Promise<string> {
  return sign(privateJwk, 'v1', claims);
}

/**
 * Returns the claims of a valid ticket for `party`, or why it was refused.
 * Expiry is checked against `now`; tickets claiming to live longer than
 * twice the issuing TTL are refused as malformed.
 */
export function verifyTicket(
  publicJwk: JsonWebKey,
  token: string,
  options: { now: number; party: string },
): Promise<Verified<TicketClaims>> {
  return verify<TicketClaims>(publicJwk, 'v1', token, options);
}

/**
 * A revocation notice: the web app's word that `member` is no longer in
 * `party` (they were removed, or left). The Worker closes their sockets in
 * every room of that party and refuses them from then on.
 */
export interface RevocationClaims {
  v: 1;
  party: string;
  member: string;
  exp: number;
  jti: string;
}

export function signRevocation(privateJwk: JsonWebKey, claims: RevocationClaims): Promise<string> {
  return sign(privateJwk, 'r1', claims);
}

export function verifyRevocation(
  publicJwk: JsonWebKey,
  token: string,
  options: { now: number; party: string },
): Promise<Verified<RevocationClaims>> {
  return verify<RevocationClaims>(publicJwk, 'r1', token, options);
}
