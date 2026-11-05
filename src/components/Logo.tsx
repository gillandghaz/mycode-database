import Link from "next/link";

// Brand mark: a rounded square with "</>" — drawn in SVG, no image file needed.
export default function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ display: "block" }}>
      <rect width="32" height="32" rx="8" fill="#f2b544" />
      <path d="M12 11l-5 5 5 5M20 11l5 5-5 5M17.5 9l-3 14" fill="none" stroke="#1b1304" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BrandWord() {
  return (
    <span className="brand__word">
      mycode<i>-</i>database
    </span>
  );
}

// The brand link used in the top bar of every signed-in page (/app and
// /dashboard) so the logo and the name always have the same size.
export function TopbarBrand() {
  return (
    <Link href="/app" className="brand">
      <Logo size={24} />
      <BrandWord />
    </Link>
  );
}
