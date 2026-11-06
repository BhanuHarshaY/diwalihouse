/**
 * Randomness is injected, never ambient. The table server passes a
 * cryptographic source; tests pass a seeded one, so any hand can be
 * replayed exactly from its seed and action log.
 */
export interface Rng {
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

/** CSPRNG via WebCrypto (available in browsers, Node 22 and Workers). */
export const cryptoRng: Rng = {
  int(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 2 ** 32) {
      throw new RangeError('maxExclusive must be an integer in (0, 2^32]');
    }
    // Rejection sampling removes modulo bias.
    const limit = Math.floor(2 ** 32 / maxExclusive) * maxExclusive;
    const buffer = new Uint32Array(1);
    for (;;) {
      crypto.getRandomValues(buffer);
      const value = buffer[0]!;
      if (value < limit) return value % maxExclusive;
    }
  },
};

/** Deterministic sfc32 generator for tests and replays. Never use for real deals. */
export function seededRng(seed: number): Rng {
  let a = 0x9e3779b9 ^ seed;
  let b = 0x243f6a88 ^ (seed * 31);
  let c = 0xb7e15162 ^ (seed * 17);
  let d = 0xdeadbeef ^ seed;
  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return { int: (maxExclusive) => Math.floor(next() * maxExclusive) };
}

/** Fisher–Yates, in place. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
