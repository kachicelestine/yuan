import type { Metadata } from "next";
import { WelcomeFlow } from "@/components/welcome/welcome-flow";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage() {
  return <WelcomeFlow />;
}
