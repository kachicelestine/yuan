import type { Metadata } from "next";
import { KitBuilder } from "@/components/energy/kit-builder";

export const metadata: Metadata = { title: "Solar kit builder", description: "Size a solar kit from your electricity bill, with payback and CO₂ saved." };

export default function EnergyPage() {
  return <KitBuilder />;
}
