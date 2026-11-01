import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/legal/legal-page";
import { brand } from "@/config/brand";
import { AUTO_CONFIRM_DAYS, SHIP_WITHIN_DAYS } from "@/modules/ordering";

export const metadata: Metadata = { title: "Help" };

export default function HelpPage() {
  return (
    <LegalPage title="Help">
      <h2>How do I pay?</h2>
      <p>
        At checkout you pay in a dollar stablecoin: USDC on Base or Solana, or USDT on Tron. You&apos;ll need a wallet app with enough to cover the total. Send the exact amount on the network shown. Local prices are for reference; the dollar amount is what you pay.
      </p>

      <h2>Where&apos;s my order?</h2>
      <p>
        Open it from <Link href="/me">Me</Link>. Shops ship within {SHIP_WITHIN_DAYS} days of payment, and once they do you&apos;ll see the carrier and tracking number.
      </p>

      <h2>Something&apos;s wrong with my order</h2>
      <p>
        Open the order and tap <b>Report a problem</b>. {brand.name} Protect keeps holding your money while we look into it. See <Link href="/returns">Returns and refunds</Link>.
      </p>

      <h2>When is the shop paid?</h2>
      <p>When you tap &quot;I got it&quot;, or {AUTO_CONFIRM_DAYS} days after the parcel ships if you don&apos;t report a problem. Only confirm once you have it.</p>

      <h2>How do I change my country or currency?</h2>
      <p>
        Tap <b>Ship to</b> on <Link href="/me">Me</Link> or at checkout. Prices, taxes and delivery times update straight away, and your choice follows your account.
      </p>

      <h2>I didn&apos;t get my sign-in code</h2>
      <p>Check your spam folder, and wait a minute before asking for another. Codes work once, for 10 minutes.</p>

      <h2>How do I open a shop?</h2>
      <p>
        Go to <Link href="/sell">Sell</Link> and apply with your business details and documents. Most applications are decided within two working days.
      </p>

      <h2>How do I report something?</h2>
      <p>Use Report on the video, comment, question or review. Our moderators see it straight away.</p>

      <h2>How do I delete my account?</h2>
      <p>
        Go to <Link href="/me/profile">your profile</Link>, where you can also download your data.
      </p>

      <h2>Talk to a person</h2>
      <p>
        <ContactLine />
      </p>
    </LegalPage>
  );
}
