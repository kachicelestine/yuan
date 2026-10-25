import type { Metadata } from "next";
import { WelcomeFlow } from "@/components/welcome/welcome-flow";
import { getProducts } from "@/server/catalog";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage() {
  // Photos of what's actually for sale, for the moving wall on the first screen.
  const photos = (await getProducts({ limit: 24 })).flatMap((p) => p.images.slice(0, 1));
  return <WelcomeFlow photos={photos} />;
}
