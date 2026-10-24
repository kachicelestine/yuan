import type { Metadata } from "next";
import { CreatorHub } from "@/components/creator/creator-hub";

export const metadata: Metadata = { title: "Creator hub" };

export default function CreatorPage() {
  return <CreatorHub />;
}
