import type { Metadata } from "next";
import { CollectionsScreen } from "@/components/collections/collections";

export const metadata: Metadata = { title: "Collections" };

export default function CollectionsPage() {
  return <CollectionsScreen />;
}
