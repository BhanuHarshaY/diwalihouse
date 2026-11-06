import { describe, expect, it } from 'vitest';
import { clientNetwork, networkKey, trustedIpHeader } from './client-ip';

describe('networkKey', () => {
  it('keeps IPv4 addresses whole', () => {
    expect(networkKey('203.0.113.9')).toBe('203.0.113.9');
  });

  it('groups IPv6 by /64 however the address is written', () => {
    const key = '2001:db8:abcd:12::/64';
    expect(networkKey('2001:db8:abcd:12::1')).toBe(key);
    expect(networkKey('2001:0db8:abcd:0012:ffff:1:2:3')).toBe(key);
    expect(networkKey('[2001:db8:abcd:12:aaaa::9]')).toBe(key);
    expect(networkKey('2001:db8:abcd:12::1%eth0')).toBe(key);
    expect(networkKey('2001:db8:abcd:13::1')).not.toBe(key);
  });

  it('expands short forms', () => {
    expect(networkKey('::1')).toBe('0:0:0:0::/64');
    expect(networkKey('2001:db8::')).toBe('2001:db8:0:0::/64');
  });

  it('unwraps IPv4-mapped IPv6', () => {
    expect(networkKey('::ffff:198.51.100.7')).toBe('198.51.100.7');
  });
});

describe('trusted client header', () => {
  it('uses only the configured header, or Vercel’s own when on Vercel', () => {
    expect(trustedIpHeader({ CLIENT_IP_HEADER: 'CF-Connecting-IP' })).toBe('cf-connecting-ip');
    expect(trustedIpHeader({ VERCEL: '1' })).toBe('x-vercel-forwarded-for');
    expect(trustedIpHeader({})).toBeNull();
  });

  it('ignores a spoofed x-forwarded-for when no header is trusted', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4' });
    expect(clientNetwork(headers, null)).toBe('unknown');
    expect(clientNetwork(headers, 'x-vercel-forwarded-for')).toBe('unknown');
  });

  it('reads the first hop of the trusted header', () => {
    const headers = new Headers({ 'x-vercel-forwarded-for': '203.0.113.9, 10.0.0.1' });
    expect(clientNetwork(headers, 'x-vercel-forwarded-for')).toBe('203.0.113.9');
  });
});
