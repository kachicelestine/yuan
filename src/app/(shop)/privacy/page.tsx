import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/legal/legal-page";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This explains what {brand.legalName} collects when you use {brand.name}, why, and the choices you have. We never sell your data.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account:</b> your email or wallet address, and the profile you choose to fill in.</li>
        <li><b>Orders:</b> what you buy, your delivery name, phone and address, and your payment&apos;s transaction on the blockchain. Blockchains are public, so that transaction is visible to anyone.</li>
        <li><b>What you do here:</b> your posts, comments, reviews, messages to shops, saved items, follows and what you watch, which tunes your feed.</li>
        <li><b>Shops:</b> business details, a payout wallet, and identity and business documents. These are kept privately and only our review team can open them.</li>
        <li><b>Device:</b> your IP address and country, used to protect sign-in and to start you in the right currency, and your bag and settings, stored in your browser. If you turn on alerts, your browser&apos;s push address, which we forget when you turn them off or sign out.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To run the marketplace: sign you in, take orders, hold and release payments, deliver parcels and settle problems (our contract with you).</li>
        <li>To keep {brand.name} safe: stop fraud and abuse, review shops and moderate posts (our legitimate interests, and legal duties).</li>
        <li>To meet tax, accounting and sanctions rules (legal duties).</li>
        <li>To make the feed and search useful to you, using what you do here (our legitimate interests).</li>
      </ul>

      <h2>Who sees it</h2>
      <ul>
        <li><b>Shops</b> see the delivery details for orders you place with them, once paid, and the messages you send them.</li>
        <li><b>Other people</b> see what you post publicly and your profile.</li>
        <li><b>Service providers</b> process data for us: hosting and database (Vercel, Neon), file storage (Cloudflare), email (Resend), and AI features (Anthropic) when you use Ask, photo search or translation. Couriers get what they need to deliver.</li>
        <li><b>Authorities</b> when the law requires it.</li>
      </ul>

      <h2>Cookies</h2>
      <p>We use one cookie to keep you signed in, and a referral cookie when you arrive through a creator&apos;s link so they&apos;re credited. We store your bag and settings in your browser. We don&apos;t use advertising trackers.</p>

      <h2>International transfers</h2>
      <p>{brand.name} works across borders, so your data may be processed outside your country, including in the country of the shop you buy from. We rely on our providers&apos; standard safeguards for these transfers.</p>

      <h2>How long we keep it</h2>
      <p>We keep your account until you close it. Order, payment and tax records stay for as long as the law requires, usually up to 7 years. Rejected shop documents are removed once they&apos;re no longer needed for review.</p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Download your data, or delete your account, from <Link href="/me/profile">your profile</Link>.</li>
        <li>Depending on where you live, you may also ask us to correct or restrict your data, object to how we use it, or complain to your data protection authority.</li>
      </ul>

      <h2>Children</h2>
      <p>{brand.name} isn&apos;t for anyone under 16, and we don&apos;t knowingly collect their data.</p>

      <h2>Contact</h2>
      <p>
        Questions or requests? <ContactLine />
      </p>
    </LegalPage>
  );
}
