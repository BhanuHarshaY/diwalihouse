import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { connectTestSql } from '@/test/db';
import { consumeRateLimit, isRateLimited } from './rate-limit';
import { hashToken, isWellFormedToken, newSessionToken, pepperedKey } from './tokens';

const sql = connectTestSql();

describe('consumeRateLimit', () => {
  it('allows up to the limit within a window, then refuses', async () => {
    const rule = { key: `test:${randomUUID()}`, limit: 3, windowSeconds: 60 };
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await consumeRateLimit(sql, rule));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false, false]);
    expect(results[4]?.retryAfterSeconds).toBeGreaterThan(0);
    expect(results[4]?.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('can be checked without spending a hit', async () => {
    const rule = { key: `test:${randomUUID()}`, limit: 2, windowSeconds: 60 };
    expect(await isRateLimited(sql, rule)).toBe(false);
    expect(await isRateLimited(sql, rule)).toBe(false);
    await consumeRateLimit(sql, rule);
    expect(await isRateLimited(sql, rule)).toBe(false);
    await consumeRateLimit(sql, rule);
    expect(await isRateLimited(sql, rule)).toBe(true);
  });

  it('keeps separate keys separate', async () => {
    const a = { key: `test:${randomUUID()}`, limit: 1, windowSeconds: 60 };
    const b = { key: `test:${randomUUID()}`, limit: 1, windowSeconds: 60 };
    expect((await consumeRateLimit(sql, a)).allowed).toBe(true);
    expect((await consumeRateLimit(sql, b)).allowed).toBe(true);
    expect((await consumeRateLimit(sql, a)).allowed).toBe(false);
  });
});

describe('session tokens', () => {
  it('are 256-bit base64url strings stored only as SHA-256 hashes', () => {
    const { token, hash } = newSessionToken();
    expect(isWellFormedToken(token)).toBe(true);
    expect(hash).toHaveLength(32);
    expect(hashToken(token).equals(hash)).toBe(true);
    expect(newSessionToken().token).not.toBe(token);
  });

  it('peppers client keys so raw IPs are not recoverable without the secret', () => {
    const key = pepperedKey('secret-one', '203.0.113.9');
    expect(key).not.toContain('203');
    expect(pepperedKey('secret-two', '203.0.113.9')).not.toBe(key);
    expect(pepperedKey('secret-one', '203.0.113.9')).toBe(key);
  });
});
