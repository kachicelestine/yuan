import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/legal/legal-page";
import { brand } from "@/config/brand";
import { AUTO_CONFIRM_DAYS, SHIP_WITHIN_DAYS } from "@/modules/ordering";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms">
      <p>
        These terms are an agreement between you and {brand.legalName}, which runs {brand.name}. By creating an account or buying, you agree to them. If you don&apos;t agree, please don&apos;t use {brand.name}.
      </p>

      <h2>What {brand.name} is</h2>
      <p>
        {brand.name} is a marketplace. Independent shops list and sell their own goods, and creators post about them. The shop, not {brand.name}, is the seller of each item and is responsible for what it lists, including its safety, its description and its right to sell it.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18, or the age of majority where you live, to buy or sell.</li>
        <li>You sign in with a code sent to your email or by signing with your wallet. Keep both to yourself: what happens on your account is your responsibility.</li>
        <li>One person, one account. We can suspend accounts that break these terms, and we&apos;ll say why.</li>
      </ul>

      <h2>Prices and paying</h2>
      <ul>
        <li>Prices are set in US dollars. Amounts in your currency are estimates for reference; what you pay is the dollar amount shown at checkout.</li>
        <li>We take payment in dollar stablecoins on the networks shown at checkout. Blockchain payments can&apos;t be reversed by us: send the exact amount, on the network shown, before the payment window closes. Funds sent to the wrong network or address may be lost.</li>
        <li>Checkout shows shipping, and an estimate of duties and taxes for your country. If you choose to pay duties on delivery, the courier collects them. Your country&apos;s authorities have the final say on what&apos;s owed.</li>
      </ul>

      <h2>{brand.name} Protect</h2>
      <p>
        When you pay, we hold the money. A shop is paid when you confirm your parcel arrived, or {AUTO_CONFIRM_DAYS} days after it ships if you don&apos;t report a problem. Shops must ship within {SHIP_WITHIN_DAYS} days of payment. If something goes wrong, open a case on the order before then. See <Link href="/returns">Returns and refunds</Link>.
      </p>

      <h2>Where we deliver</h2>
      <p>
        You must give your real delivery country and address. We don&apos;t ship to destinations under sanctions or where the goods are prohibited, and you are responsible for following the import rules where you live.
      </p>

      <h2>Selling on {brand.name}</h2>
      <ul>
        <li>Shops must pass our review, describe goods honestly, ship on time and keep their listings accurate.</li>
        <li>We keep a commission on each sale, shown in your shop before you list anything, and shops pay for any ads and vouchers they choose to run.</li>
        <li>Ad credit is prepaid and can only be spent on ads here. It can&apos;t be withdrawn or moved to your earnings, and we refund it only where the law requires.</li>
        <li>Shops are responsible for their own taxes and for the rules on what they sell.</li>
        <li>Not allowed: illegal goods, counterfeits, weapons, drugs, recalled products, and anything that needs a licence you don&apos;t hold.</li>
      </ul>

      <h2>Posts, reviews and messages</h2>
      <p>
        You keep ownership of what you post, and you let us show and promote it on {brand.name}. Don&apos;t post anything illegal, hateful, sexual, misleading or that isn&apos;t yours to share. We review posts and can remove them. Report anything that shouldn&apos;t be here from the post itself.
      </p>

      <h2>Coins, coupons and promotions</h2>
      <p>Coins and coupons have no cash value, can&apos;t be sold or transferred, and can change or end. Blind boxes are sold from sealed cases with the odds shown, and what&apos;s inside is by chance.</p>

      <h2>Our liability</h2>
      <p>
        We work hard to keep {brand.name} running, but it is provided as it is. As far as the law allows, we aren&apos;t liable for indirect losses, and our total liability for an order is limited to what you paid for it. Nothing here limits rights you have under consumer law that can&apos;t be waived.
      </p>

      <h2>Changes and ending</h2>
      <p>We may update these terms and will show the new date here. You can close your account at any time from your profile.{brand.jurisdiction ? ` These terms are governed by the laws of ${brand.jurisdiction}.` : ""}</p>

      <h2>Contact</h2>
      <p>
        <ContactLine />
      </p>
    </LegalPage>
  );
}
