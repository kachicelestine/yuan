import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/legal/legal-page";
import { brand } from "@/config/brand";
import { AUTO_CONFIRM_DAYS, SHIP_WITHIN_DAYS } from "@/modules/ordering";

export const metadata: Metadata = { title: "Returns and refunds" };

export default function ReturnsPage() {
  return (
    <LegalPage title="Returns and refunds">
      <p>
        {brand.name} Protect holds your money until you&apos;re happy. Shops aren&apos;t paid until you confirm your parcel arrived, or until {AUTO_CONFIRM_DAYS} days after it ships if you don&apos;t report a problem.
      </p>

      <h2>When you can get your money back</h2>
      <ul>
        <li>It never arrived, or the shop didn&apos;t ship within {SHIP_WITHIN_DAYS} days of payment.</li>
        <li>It arrived damaged.</li>
        <li>It isn&apos;t as described.</li>
        <li>You got the wrong item or size.</li>
      </ul>

      <h2>How to report a problem</h2>
      <ul>
        <li>Open the order and tap <b>Report a problem</b> on the parcel, before you confirm it and within {AUTO_CONFIRM_DAYS} days of it shipping.</li>
        <li>Tell us what happened. Photos help: add them in a message to the shop.</li>
        <li>Opening a case keeps the payment held. Most cases are settled within 3 days.</li>
      </ul>

      <h2>How refunds are paid</h2>
      <p>You&apos;re paid back in the same stablecoin, to the wallet you paid from, for the amount of the parcel. The order page shows when it&apos;s done.</p>

      <h2>Changed your mind?</h2>
      <p>
        Message the shop before it ships and it may be able to cancel. After that, returns are up to the shop unless your local consumer law gives you the right to cancel, in which case that right applies. Sending goods back may be at your cost.
      </p>

      <h2>What can&apos;t be returned</h2>
      <ul>
        <li>Blind boxes once opened, unless the item is damaged or not what the odds described.</li>
        <li>Made-to-order goods, unless they&apos;re faulty or not as agreed.</li>
        <li>Deposits follow the terms shown on the pre-order.</li>
      </ul>

      <p>
        Your legal rights as a consumer aren&apos;t affected. Need a hand? See <Link href="/help">Help</Link>, or <ContactLine />
      </p>
    </LegalPage>
  );
}
