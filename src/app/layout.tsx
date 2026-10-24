import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { StoreProvider } from "@/components/providers";
import { AppShellExtras } from "@/components/shell/app-shell-extras";
import { CommandPalette } from "@/components/shell/command-palette";
import { FlyToBag } from "@/components/shell/fly-to-bag";
import { brand } from "@/config/brand";
import { getMarkets } from "@/server/markets";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: `${brand.name} · Shop China, straight from the source`,
    template: `%s · ${brand.name}`,
  },
  description: "Shoppable videos, live rooms and factory-direct prices on everything made in China, from solar panels to silk.",
  applicationName: brand.name,
  // Installed to an iPhone home screen, it opens full screen with a dark status bar.
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#050506",
  viewportFit: "cover",
  colorScheme: "dark",
  // The on-screen keyboard shrinks the layout, so sheets with a composer stay above it.
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Cached for a day (see src/server/markets.ts), so this stays in the static shell.
  const markets = await getMarkets();
  return (
    <html lang="en" data-glass="regular" className={`${inter.variable} ${interTight.variable} antialiased`}>
      <body className="min-h-dvh">
        <StoreProvider markets={markets}>
          {children}
          <FlyToBag />
          <AppShellExtras />
          <CommandPalette />
        </StoreProvider>
      </body>
    </html>
  );
}

