import Link from 'next/link';

/**
 * The type-only wordmark. A drawn logotype is an open asset requirement
 * (design/asset-manifest.md, BRAND-01); this lockup is the interim mark.
 */
export function Wordmark({
  href = '/',
  className,
}: {
  href?: string;
  className?: string | undefined;
}) {
  return (
    <Link
      href={href}
      className={['inline-flex items-baseline gap-2 whitespace-nowrap no-underline', className]
        .filter(Boolean)
        .join(' ')}
      aria-label="Diwali House, home"
    >
      <span className="font-masthead text-[1.375rem] leading-none text-ivory-100">
        Diwali House
      </span>
      <span
        lang="hi"
        className="hidden font-story text-[0.9375rem] leading-none text-marigold-400 min-[26rem]:inline"
        aria-hidden
      >
        दिवाली हाउस
      </span>
    </Link>
  );
}
