/**
 * Which network a request came from, for rate limiting.
 *
 * Forwarded-for headers are only trustworthy when our own edge sets them.
 * We read exactly one header: `CLIENT_IP_HEADER` if configured, otherwise
 * Vercel's `x-vercel-forwarded-for` when running on Vercel. Anywhere else
 * every request shares one bucket. That is strict, but it can't be spoofed.
 *
 * IPv6 clients are grouped by /64, the prefix a single household or device
 * is normally assigned, so rotating addresses inside it doesn't buy new buckets.
 */

export function trustedIpHeader(env: {
  CLIENT_IP_HEADER?: string | undefined;
  VERCEL?: string | undefined;
}): string | null {
  if (env.CLIENT_IP_HEADER) return env.CLIENT_IP_HEADER.toLowerCase();
  if (env.VERCEL) return 'x-vercel-forwarded-for';
  return null;
}

export function clientNetwork(headers: Headers, header: string | null): string {
  const raw = header ? headers.get(header) : null;
  const first = raw?.split(',')[0]?.trim();
  return first ? networkKey(first) : 'unknown';
}

export function networkKey(address: string): string {
  const ip = address.replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  if (!ip.includes(':')) return ip;

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped?.[1]) return mapped[1];

  const [head = '', tail] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const fill = tail === undefined ? 0 : Math.max(0, 8 - headParts.length - tailParts.length);
  const groups = [...headParts, ...Array<string>(fill).fill('0'), ...tailParts];
  const prefix = groups
    .slice(0, 4)
    .map((group) => group.toLowerCase().replace(/^0+(?=[0-9a-f])/, '') || '0');
  while (prefix.length < 4) prefix.push('0');
  return `${prefix.join(':')}::/64`;
}
