import { Suspense } from "react";
import { ChromeProvider } from "@/components/shell/chrome";
import { SideNav } from "@/components/shell/side-nav";
import { TabBar } from "@/components/shell/tab-bar";
import { TopBar } from "@/components/shell/top-bar";

// Shared frame for the browsing tabs. Phones get the floating tab bar;
// desktops get TikTok-web style chrome: top search bar plus a side rail.
export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <ChromeProvider>
      <div className="lg:grid lg:h-dvh lg:grid-cols-[256px_minmax(0,1fr)] lg:grid-rows-[72px_minmax(0,1fr)]">
        <TopBar />
        {/* Both read the path. On a known page that's in the static shell anyway; on a page first
            seen at runtime (a new shop's chat) it streams in instead of failing the prerender. */}
        <Suspense>
          <SideNav />
        </Suspense>
        <main className="relative min-w-0 lg:overflow-y-auto">{children}</main>
        <Suspense>
          <TabBar />
        </Suspense>
      </div>
    </ChromeProvider>
  );
}

