import { publicEnv } from "./public-env";

// The brand comes from the environment (NEXT_PUBLIC_BRAND_*), so a rename is a .env change.
export const brand = {
  name: publicEnv.brandName,
  seal: publicEnv.brandSeal,
  tagline: publicEnv.brandTagline,
  url: publicEnv.siteUrl,
} as const;
