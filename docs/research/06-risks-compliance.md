# 06 · Risks and compliance

This is an engineering map of the rules that shape the product. It is not legal advice. Each launch country needs local counsel before real money moves. Items marked *(not re-verified)* come from prior knowledge rather than this research pass.

## Payments in crypto

| Jurisdiction | Rule | What it means for us |
|---|---|---|
| **Nigeria** | Investments and Securities Act 2025 (signed 29 March 2025) classifies virtual and digital assets as securities and gives the SEC power to register and regulate virtual-asset platforms and custodians ([Mondaq](https://www.mondaq.com/nigeria/securities/1619460/isa-2025-what-investors-need-to-know-about-nigerias-new-capital-market-law), [BusinessDay](https://businessday.ng/news/legal-business/article/the-evolution-of-digital-asset-governance-in-nigeria-a-strategic-guide-for-virtual-asset-service-providers-vasps/)) | Holding buyers' stablecoins in escrow looks like **custody**. Either register, or have a licensed custodian/processor hold funds and settle to us |
| **Kenya** | A Virtual Asset Service Providers Bill (2024/2025) covers licensing; enactment status not confirmed in this pass ([Treasury bill text](https://treasury.go.ke/wp-content/uploads/2025/01/VIRTUAL-ASSET-SERVICE-PROVIDERS-BILL-2024.pdf)) | Check status before launch |
| **EU** | MiCA: licensed crypto-asset service providers only; USDT delisted by major EU exchanges in 2025 ([Fintelegram](https://fintelegram.com/comparative-analysis-genius-act-us-vs-mica-regulation-eu-and-their-impact-on-global-stablecoins/)) | Offer USDC (MiCA-compliant issuer) to EU buyers; hide USDT for EU addresses |
| **US** | GENIUS Act (2025) plus proposed Treasury rule: from 18 January 2027, providers generally may not offer foreign-issued stablecoins unless the issuer meets US requirements (proposal; [Unchained](https://unchainedcrypto.com/treasurys-new-stablecoin-rule-could-force-us-exchanges-to-delist-tether)). Escrow of customer funds can trigger state money-transmitter licensing *(not re-verified)* | USDC for US buyers; use a licensed processor for US escrow |
| **Mainland China** | Crypto transactions banned (ARCHITECTURE "Risks") | Paying China-based sellers in stablecoins needs a regulated off-ramp or a Hong Kong entity |

**Engineering response:**
1. Make rails country-aware (`availableRails(country)`).
2. Put custody behind the `PaymentNetwork` and ledger ports, so a licensed provider (Stripe/Bridge, Coinbase, or an Africa-licensed VASP) can hold funds.
3. Add the Travel Rule data fields when payouts go above thresholds *(not re-verified)*.

## Customs and duties

- **United States:**
  - **De minimis gone:** duty-free de minimis ($800) was suspended for China and Hong Kong on 2 May 2025, then for all countries from 29 August 2025, and indefinitely by a CBP rule of 24 June 2026.
  - **New postal entry:** a postal informal entry process now applies to mail up to $2,500.
  - **Statutory end:** the statutory exemption ends 1 July 2027 under OBBBA ([KPMG](https://kpmg.com/us/en/taxnewsflash/news/2026/06/cbp-suspends-de-minimis-exemption.html), [Thomson Reuters](https://www.thomsonreuters.com/en-us/help/onesource-global-trade/regulatory-insights/2026/july-1st/cbp-suspends-de-minimis-mail-postal-entry.html)).
  - **For us:** every US order pays duty, so show it, collect it (DDP), and file entries through a broker.
- **European Union:**
  - **€150 exemption ended:** from 1 July 2026 the duty exemption for B2C parcels up to €150 was replaced by a temporary **€3 customs duty per item** (counted per tariff line or item; sources differ).
  - **More fees and data to come:** about €2 per parcel in handling fees and new product-identifier data are expected from about 1 November 2026. Standard tariffs are expected around 2028 with the EU Customs Data Hub ([DHL](https://www.dhl.com/discover/en-cz/logistics-advice/import-export-advice/eu-2026-duty-de-minimis-removal), [Bigblue](https://www.bigblue.co/blog/end-of-de-minimis-eu-3-euro-customs-duty-small-parcels), secondary).
  - **VAT:** VAT on imports is collected at checkout via IOSS *(not re-verified)*.
- **Africa (Nigeria, Ghana, Kenya):** duties, VAT and **import prohibition lists** differ by country. Our `markets` context holds rates; add prohibited and restricted categories per country before enabling a market *(not re-verified)*.
- **Design rule:**
  - Landed cost is computed server-side per country and per item.
  - It's stored on the order (we do this).
  - Every product carries an HS code, country of origin and an identifier. The EU will require these, and brokers need them now.

## Marketplace laws

- **EU Digital Services Act:**
  - **Trader traceability (Art. 30):** collect and verify each trader's identity, contact, payment account, trade register and a self-certification before they can sell to EU consumers; suspend traders who don't correct false data. **Platforms that are micro or small enterprises are exempt** while they stay so, plus 12 months after ([Mondaq](https://mondaq.co.uk/compliance/1367256/online-marketplaces-and-the-digital-services-act-understanding-trader-traceability), [CCPC](https://www.ccpc.ie/enforcement-and-regulation/digital/the-digital-services-act)).
  - **Other duties:** notice-and-action for illegal content, and explaining recommender-system parameters *(not re-verified)*.
- **US INFORM Consumers Act:**
  - **Who's covered:** "high-volume" sellers, meaning 200+ sales of new products **and** $5,000+ revenue in any 12 months of the last 24.
  - **Collect and verify:** marketplaces must collect a bank account, tax ID and contact details within 10 days, verify them within 10 days, and recertify annually.
  - **Disclose:** sellers with $20,000+ a year must show their name and address to buyers, and buyers need a way to report sellers. FTC-enforced ([FTC](https://www.ftc.gov/node/81484), [Retail Dive](https://www.retaildive.com/news/inform-consumers-act-marketplace-sellers-organized-retail-crime/654022/)).
- **EU General Product Safety Regulation** (applies from 13 December 2024): marketplaces must register on Safety Gate with a single point of contact, answer authorities within two working days, and process product-safety notices within three working days ([Osborne Clarke](https://osborneclarke.com/node/24081), [Fieldfisher](https://www.fieldfisher.com/en/insights/new-obligations-under-the-eu-general-product-safety-regulation)).
- **Design response:**
  - **Sellers:** one seller-verification module (KYC/KYB) satisfying DSA and INFORM: collect, verify, recertify, suspend. Seller identity is shown on listings where required.
  - **Reports:** a single "report" pipeline for illegal content, unsafe products and suspicious sellers, with tracked deadlines.
  - **Transparency:** a "why am I seeing this" explanation in the feed.

## Data protection

- **Nigeria:**
  - The NDPA 2023, operationalised by the GAID (effective 19 September 2025), replaced the NDPR.
  - Data controllers and processors "of major importance" must register with the NDPC and file compliance audit returns.
  - Cross-border transfers need an adequate level of protection, or approved mechanisms such as standard contractual clauses or binding corporate rules ([DLA Piper](https://privacymatters.dlapiper.com/2025/06/nigeria-ndpc-issues-gaid-key-compliance-insights/), [IAPP](https://iapp.org/news/a/from-principles-to-practice-operationalizing-nigerias-data-protection-act-through-the-gaid)).
- **EU GDPR, Kenya DPA 2019, Ghana DPA 2012, South Africa POPIA:** similar principles; registration with the regulator in Kenya and Ghana *(not re-verified)*.
- **Design response:**
  - Data minimisation (we already avoid passwords and store hashed codes).
  - A personal-data inventory per context.
  - Account export and delete.
  - Processor agreements with every vendor in [05](05-infrastructure-free-to-faang.md).
  - Standard contractual clauses for transfers.
  - At stage 3, region-homed user data in cells.

## Accessibility

- **European Accessibility Act:** applies from 28 June 2025 to e-commerce services sold to EU consumers. The standard is EN 301 549 (≈ WCAG 2.1 AA). There's an exemption for microenterprises providing services (<10 staff and ≤€2M turnover) ([Complianz](https://complianz.io/definition/what-is-the-european-accessibility-act/), [e-include](https://e-include.eu/web-accessibility/european-accessibility-act/), secondary).
- **Our position:** the app already uses accessible primitives (labels, live regions, reduced motion). Target **WCAG 2.2 AA** in the design checklist, which also covers 2.1.

## Content safety

- **Child safety:** user-uploaded video, live and chat must have hash-matching for known child sexual abuse material (e.g. PhotoDNA, Thorn Safer), an urgent escalation path, and legally required reporting. In the US, providers must report apparent CSAM to NCMEC *(not re-verified in this pass)*.
- **Live streams:** frame sampling through moderation models, a report button with priority review, the ability to end a stream instantly, and delayed replays (moderated before publishing).
- **Counterfeits and IP:** a rights-holder portal, repeat-infringer policy, and listing-time checks ([04](04-commerce-core.md#trust-and-safety)).
- **Dark patterns:** already a guardrail in ROADMAP (fixed share targets, no resetting countdowns). Keep it as a review checklist item.

## Operational risk

| Risk | Mitigation |
|---|---|
| Single server at stage 0 | Backups to R2 with tested restores; move to stage 1 before scaling marketing |
| Free tier terms change (Oracle cut A1 by half in 2026; Hetzner raised prices twice) | Plain Docker, plain Postgres, S3-compatible storage: any host works; keep a migration runbook |
| Vendor lock-in (OpenNext/Workers bugs, proprietary runtimes) | Stay on the "Node server" contract Next.js guarantees |
| Video and live costs exploding | Self-transcode to R2; managed live only for monetised shows; per-show cost alerts |
| Abuse (scraping, sign-up fraud, payment probing) | Cloudflare rules + Turnstile; per-IP and per-account limits; seller KYC before payouts |
| Regulatory shock (duties, crypto) | Rails and logistics behind ports; per-country config; local-warehouse listings as a hedge |
