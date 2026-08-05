import Link from 'next/link';

export default function Logo({ href = '/', className = 'h-7' }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`flex-shrink-0 flex items-center no-underline ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/pace-logo-horizontal-48-light.svg" alt="PACE" className={`${className} w-auto`} />
    </Link>
  );
}
