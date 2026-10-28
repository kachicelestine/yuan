import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ApplyForm } from "@/components/sell/apply-form";
import { brand } from "@/config/brand";
import { serverEnv } from "@/config/server-env";
import { SellerDashboard } from "@/components/sell/seller-dashboard";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { ShopInvites, type ShopInvite } from "@/components/sell/shop-invites";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";
import { currentShop, suspendedShop } from "@/server/shop";

export const metadata: Metadata = { title: "Sell" };

export default function SellPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <SellBody />
    </Suspense>
  );
}

async function SellBody() {
  // Everything here is the signed-in person's own, read fresh.
  await connection();
  const account = await currentAccount();
  if (!account) redirect("/signin?next=/sell");
  const app = await services();
  // Invitations to help run a shop, addressed to the email they signed in with.
  const invites: ShopInvite[] = (
    await Promise.all(
      (await app.team.invitesFor(account.email)).map(async (i) => {
        const page = await app.catalog.getSeller(i.sellerId);
        return page ? [{ id: i.id, sellerId: i.sellerId, shopName: page.seller.name }] : [];
      }),
    )
  ).flat();
  const shop = await currentShop();
  const suspended = shop ? null : await suspendedShop();
  if (suspended) {
    return (
      <SellFrame title="Your shop is suspended" subtitle="Its page and listings are hidden, and its tools are locked.">
        <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">
          <b className="block font-semibold text-ink">Reason from our team</b>
          {suspended.reason}
        </p>
        <p className="mt-3 px-1 text-sm text-ink-2">Orders already paid are still protected and refunds still go through. Reply to the email we sent, or write to support, to ask for a review.</p>
      </SellFrame>
    );
  }
  if (!shop) {
    return (
      <SellFrame title={`Sell on ${brand.name}`} subtitle="Tell us about your business. We check every seller by hand, so buyers can trust the badge.">
        <ShopInvites invites={invites} />
        <ApplyForm application={await app.onboarding.mine(account.id)} />
      </SellFrame>
    );
  }
  const [page, listings, orders, questions, available, payouts, wallet, program, requests] = await Promise.all([
    app.catalog.getSeller(shop.sellerId),
    app.selling.listings(shop.sellerId),
    app.sellerOrders.list(shop.sellerId),
    app.content.unansweredQuestions(shop.sellerId),
    app.escrow.available(shop.sellerId),
    app.escrow.payouts(shop.sellerId),
    app.onboarding.payoutWallet(shop.sellerId),
    app.affiliates.shopProgram(shop.sellerId),
    app.sourcing.inbox(shop.sellerId),
  ]);
  // What Protect still holds for parcels not yet confirmed, as it will reach the shop.
  const held = orders.filter((o) => o.shipment && ["awaiting_shipment", "shipped", "disputed"].includes(o.shipment.status)).reduce((n, o) => n + o.shipment!.amount, 0);
  const money = {
    available: available / 100,
    // Less what creators will earn on the referred orders among them.
    inProtect: Math.max(0, Math.round((held * (1 - serverEnv.PLATFORM_COMMISSION) - program.pending) * 100) / 100),
    commission: serverEnv.PLATFORM_COMMISSION,
    payouts,
    wallet,
    program,
    explorer: serverEnv.PAYMENTS_BASE_CHAIN === "base" ? "https://basescan.org" : "https://sepolia.basescan.org",
  };
  if (!page) redirect("/me");
  // A plain object: Object.groupBy's has no prototype, which can't be sent to a Client Component.
  const boxes = Object.fromEntries(Object.entries(Object.groupBy(await app.blindBoxes.forOrders(orders.filter((o) => o.status !== "awaiting_payment").map((o) => o.id)), (b) => b.orderId)));
  return (
    <SellFrame title="Your shop">
      <ShopInvites invites={invites.filter((i) => i.sellerId !== shop.sellerId)} />
      <SellerDashboard seller={page.seller} storefront={page.storefront} listings={listings} orders={orders} questions={questions} money={money} newRequests={requests.filter((r) => r.status === "open" && !r.mine).length} boxes={boxes as Record<string, NonNullable<(typeof boxes)[string]>>} />
    </SellFrame>
  );
}
