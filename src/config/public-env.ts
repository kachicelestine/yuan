import { z } from "zod";

// Values compiled into the browser bundle. Each one is read as a literal
// `process.env.NEXT_PUBLIC_…` so Next.js can inline it; never put secrets here.
const schema = z.object({
  brandName: z.string().trim().min(1, "NEXT_PUBLIC_BRAND_NAME is required"),
  brandSeal: z.string().trim().min(1, "NEXT_PUBLIC_BRAND_SEAL is required").max(2, "NEXT_PUBLIC_BRAND_SEAL should be one character"),
  brandTagline: z.string().trim().min(1, "NEXT_PUBLIC_BRAND_TAGLINE is required"),
  siteUrl: z.url("NEXT_PUBLIC_SITE_URL must be a full URL, like https://lychee.example"),
});

const parsed = schema.safeParse({
  brandName: process.env.NEXT_PUBLIC_BRAND_NAME,
  brandSeal: process.env.NEXT_PUBLIC_BRAND_SEAL,
  brandTagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  throw new Error(`Invalid public environment. Copy .env.example to .env and fill it in.\n${z.prettifyError(parsed.error)}`);
}

export const publicEnv = parsed.data;
