// Values compiled into the browser bundle. Each one is read as a literal
// `process.env.NEXT_PUBLIC_…` so Next.js can inline it; never put secrets here.
// Checked by hand rather than with zod: this file reaches every page, and zod would
// add about 30 KB of JavaScript to each of them.

function required(name: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`Invalid public environment: ${name} is required. Copy .env.example to .env and fill it in.`);
  return trimmed;
}

const brandSeal = required("NEXT_PUBLIC_BRAND_SEAL", process.env.NEXT_PUBLIC_BRAND_SEAL);
if (brandSeal.length > 2) throw new Error("Invalid public environment: NEXT_PUBLIC_BRAND_SEAL should be one character.");

const siteUrl = required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL);
if (!URL.canParse(siteUrl)) throw new Error("Invalid public environment: NEXT_PUBLIC_SITE_URL must be a full URL, like https://lychee.example.");

export const publicEnv = {
  brandName: required("NEXT_PUBLIC_BRAND_NAME", process.env.NEXT_PUBLIC_BRAND_NAME),
  brandSeal,
  brandTagline: required("NEXT_PUBLIC_BRAND_TAGLINE", process.env.NEXT_PUBLIC_BRAND_TAGLINE),
  siteUrl,
  // Who runs the site and how to reach them, for the policy and help pages. Optional.
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME?.trim() || null,
  jurisdiction: process.env.NEXT_PUBLIC_LEGAL_JURISDICTION?.trim() || null,
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null,
} as const;
