/**
 * Invitation codes.
 *
 * A code is the shareable, human-typeable credential that lets someone join a
 * party as a guest. It is deliberately separate from the party's permanent
 * internal id: hosts can rotate a leaked code without changing the party.
 *
 * Format: 8 symbols of Crockford base32 (40 bits), displayed as `XXXX-XXXX`.
 * Crockford's alphabet omits I, L, O and U so codes survive being read aloud
 * or copied from a QR caption; input normalisation folds the look-alikes back.
 */

export const INVITE_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const INVITE_CODE_LENGTH = 8;

const CANONICAL_PATTERN = /^[0-9A-HJKMNP-TV-Z]{8}$/;

/** Generates a uniformly random code using the platform CSPRNG. */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const byte of bytes) {
    // 256 is a multiple of 32, so masking the low 5 bits stays uniform.
    code += INVITE_CODE_ALPHABET[byte & 31];
  }
  return code;
}

/**
 * Turns whatever a person typed (`abcd-efgh`, `ABCD EFGH`, `abcdefgh`) into
 * the canonical 8-symbol form, or `null` if it cannot be a valid code.
 */
export function normalizeInviteCode(input: string): string | null {
  const folded = input
    .toUpperCase()
    .replace(/[\s\-_.]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  return CANONICAL_PATTERN.test(folded) ? folded : null;
}

export function isCanonicalInviteCode(value: string): boolean {
  return CANONICAL_PATTERN.test(value);
}

/** `ABCDEFGH` → `ABCD-EFGH`. Expects a canonical code. */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
