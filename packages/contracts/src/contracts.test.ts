import { describe, expect, it } from 'vitest';
import {
  createPartyInputSchema,
  displayNameSchema,
  formatInviteCode,
  nameKey,
  generateInviteCode,
  INVITE_CODE_ALPHABET,
  inviteCodeSchema,
  isWritable,
  normalizeInviteCode,
  postcardInputSchema,
} from './index.ts';

describe('invite codes', () => {
  it('generates 8 symbols from the Crockford alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(8);
      for (const char of code) expect(INVITE_CODE_ALPHABET).toContain(char);
    }
  });

  it('does not repeat across a large sample', () => {
    const codes = new Set(Array.from({ length: 5000 }, generateInviteCode));
    expect(codes.size).toBe(5000);
  });

  it('normalises what people actually type', () => {
    expect(normalizeInviteCode('abcd-efgh')).toBe('ABCDEFGH');
    expect(normalizeInviteCode(' ab cd ef gh ')).toBe('ABCDEFGH');
    expect(normalizeInviteCode('OOIL-1234')).toBe('00111234');
  });

  it('rejects codes of the wrong length or with impossible symbols', () => {
    expect(normalizeInviteCode('ABC')).toBeNull();
    expect(normalizeInviteCode('ABCDEFGHJ')).toBeNull();
    expect(normalizeInviteCode('ABCD-EFGU')).toBeNull();
    expect(normalizeInviteCode('ABCD-EF!H')).toBeNull();
  });

  it('formats for display', () => {
    expect(formatInviteCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });

  it('schema yields the canonical form', () => {
    expect(inviteCodeSchema.parse('wxyz-0123')).toBe('WXYZ0123');
    expect(inviteCodeSchema.safeParse('nope').success).toBe(false);
  });
});

describe('display names', () => {
  it('trims and collapses whitespace', () => {
    expect(displayNameSchema.parse('  Asha   Rao ')).toBe('Asha Rao');
  });

  it('accepts Devanagari, including ZWJ/ZWNJ shaping marks', () => {
    expect(displayNameSchema.parse('हर्ष')).toBe('हर्ष');
    expect(displayNameSchema.parse('क्\u200Dष')).toBe('क्\u200Dष');
  });

  it('normalises to NFC so look-alike encodings compare equal', () => {
    const decomposed = 'Ame\u0301lie';
    expect(decomposed).not.toBe('Am\u00E9lie');
    expect(displayNameSchema.parse(decomposed)).toBe('Am\u00E9lie');
  });

  it('rejects empty, overlong, and spoofing input', () => {
    expect(displayNameSchema.safeParse('   ').success).toBe(false);
    expect(displayNameSchema.safeParse('x'.repeat(33)).success).toBe(false);
    expect(displayNameSchema.safeParse('Host\u202Etsoh').success).toBe(false);
    expect(displayNameSchema.safeParse('a\u0000b').success).toBe(false);
    expect(displayNameSchema.safeParse('a\u200Bb').success).toBe(false);
  });
});

describe('name spoofing defences', () => {
  it.each([
    ['left-to-right mark', 'Asha\u200E'],
    ['word joiner', 'As\u2060ha'],
    ['soft hyphen', 'As\u00ADha'],
    ['tag character', 'Asha\u{E0041}'],
    ['Arabic letter mark', 'Asha\u061C'],
    ['Hangul filler (renders blank)', '\u3164'],
    ['Braille blank', '\u2800\u2800'],
    ['ZWJ outside an Indic word', 'As\u200Dha'],
    ['combining-mark stack', 'Asha\u0336\u0336\u0336\u0336'],
    ['punctuation only', '...'],
  ])('rejects %s', (_, name) => {
    expect(displayNameSchema.safeParse(name).success).toBe(false);
  });

  it('keeps shaping joiners where Devanagari needs them', () => {
    expect(displayNameSchema.safeParse('क्\u200Dष').success).toBe(true);
    expect(displayNameSchema.safeParse('क्\u200Cष').success).toBe(true);
  });

  it('compares names by a compatibility-normalised key', () => {
    expect(nameKey('Ａｓｈａ')).toBe(nameKey('asha'));
    expect(nameKey('ASHA')).toBe('asha');
    expect(nameKey('क्\u200Dष')).toBe(nameKey('क्ष'));
    expect(nameKey('Asha')).not.toBe(nameKey('Usha'));
  });
});

describe('createPartyInputSchema', () => {
  it('rejects unknown emblems', () => {
    const result = createPartyInputSchema.safeParse({
      partyName: 'Rao Diwali',
      displayName: 'Asha',
      emblem: 'unicorn',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a well-formed request', () => {
    expect(
      createPartyInputSchema.parse({
        partyName: 'Rao Diwali',
        displayName: 'Asha',
        emblem: 'diya',
      }),
    ).toEqual({ partyName: 'Rao Diwali', displayName: 'Asha', emblem: 'diya' });
  });
});

describe('postcards', () => {
  const card = (over: Record<string, unknown> = {}) =>
    postcardInputSchema.safeParse({ message: 'Shubh Deepavali!', stamp: 'diya', ...over });

  it('tidy messages, and a blank "To" means everyone', () => {
    const parsed = card({
      message: '  Happy Diwali,\r\n\r\n\r\n\r\n   from   all of us  ',
      to: '   ',
    });
    expect(parsed.success && parsed.data).toEqual({
      message: 'Happy Diwali,\n\nfrom all of us',
      to: null,
      stamp: 'diya',
    });
    expect(card({ to: ' Nani  and Nanu ' }).data?.to).toBe('Nani and Nanu');
  });

  it('accept any script and emoji, including joined emoji sequences', () => {
    for (const message of [
      'दीपावली की शुभकामनाएँ 🪔',
      'ਬੰਦੀ ਛੋੜ ਦਿਵਸ ਦੀਆਂ ਵਧਾਈਆਂ',
      'শুভ দীপাবলি',
      '🪔🪔🪔',
      'From all of us 👨\u200D👩\u200D👧\u200D👦',
      'Thank you 🙏🏽',
    ]) {
      expect(card({ message }).success, message).toBe(true);
    }
  });

  it('refuse text that can disguise itself or say nothing', () => {
    for (const message of [
      '',
      '   ',
      'Hello \u202Edlrow',
      'Hidden\u200Bspace',
      'Bell\u0007',
      'Z\u0301\u0302\u0303\u0304\u0305algo',
      '\u2800\u2800',
      'x'.repeat(281),
      Array.from({ length: 9 }, (_, i) => `line ${i}`).join('\n'),
    ]) {
      expect(card({ message }).success, JSON.stringify(message)).toBe(false);
    }
    expect(isWritable('ok')).toBe(true);
    expect(card({ stamp: 'om' }).success).toBe(false);
    expect(card({ to: 'x'.repeat(41) }).success).toBe(false);
  });
});
