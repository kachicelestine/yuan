import type { Metadata } from "next";
import { BusinessScreen } from "@/components/business/business-screen";

export const metadata: Metadata = { title: "Business" };

export default function BusinessPage() {
  return <BusinessScreen />;
}
