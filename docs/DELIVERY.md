# Delivery: who carries parcels from China, and what shoppers choose between

At checkout, shoppers see every company that can carry their order from China to their country, each with a price for those parcels' weights, working days, whether it comes to the door or a pickup point, and who delivers it locally. They pick one; the shop is told to ship with it, and the order page links to that carrier's own tracking.

Research done November 2026. The carrier list and per-country data live in [src/modules/delivery/domain/catalogue.ts](../src/modules/delivery/domain/catalogue.ts).

## How it works

- **Who ships.** Each shop ships its own parcel from China (the existing flow), with the company the shopper chose. Shipping money goes to the platform's logistics account, as before.
- **Weight.** Carriers charge by weight. A listing's "Weight" (a field in the listing editor) is used, otherwise a typical weight for its category, plus 10% and 50 g for packaging. Each place an order ships from is one parcel, unless the shopper combines them into one box.
- **Price.** The cheapest company is free above the country's free-shipping threshold; a dearer one costs the difference. Below it, each company costs its own price.
- **Bulk.** From 21 kg air cargo is offered, and from 100 kg sea freight, which is far cheaper per kilo. Wholesale orders of a tonne or more go this way.

## The companies, and why these

Parcels from China to shoppers travel by one of four kinds of service. Every option shown belongs to one of them.

| Kind | Companies | Door to door in | Reaches | Notes |
| --- | --- | --- | --- | --- |
| International express | DHL Express, FedEx, UPS, Aramex, SF International | 2–8 working days | DHL, FedEx, UPS: every country. Aramex: Gulf, Africa, South Asia, Oceania. SF: East Asia, North America, Western Europe, Oceania | Clear customs themselves. Fastest and dearest. |
| Postal | EMS, China Post tracked small packet | 4–40 days | Every UPU member | Handed to the shopper's national post (NIPOST, Royal Mail, USPS…). Small packets go up to 2 kg. |
| Cross-border e-commerce lines | YunExpress, 4PX, Cainiao, J&T | 5–30 days | Their published markets (about 30–45 countries each for direct lines) | Flown in bulk, cleared, then handed to a local courier (Royal Mail/Evri/DPD in the UK, USPS in the US…). Cheapest tracked option for 0.5–5 kg. |
| China–Africa specialists | Speedaf | 7–14 days | Nigeria, Ghana, Kenya, Uganda, Morocco | Own local networks in those countries. |
| Freight (bulk) | Consolidated air cargo, shared-container sea freight (LCL) | Air 4–14 days, sea 10–50 | Everywhere | Booked through a freight forwarder and delivered by a local agent. Air from 21 kg (about $3.50–8/kg), sea from 100 kg (about $0.60–1.30/kg). Research: air to Lagos $5–11/kg in 5–10 days; DDP sea $140–290 per m³ in 27–44 days ([Welltrans](https://welltrans-logistics.com/?p=2494), [Sino-Shipping](https://www.sino-shipping.com/freight-china-nigeria/)). |

A fifth kind, **local couriers** (GIG Logistics, Kwik, ABC Cargo in Nigeria; G4S, Fargo, Pickup Mtaani in Kenya; The Courier Guy, Pudo, Pargo in South Africa…), only work inside their country. They can carry the last leg only if the platform has a **hub** there that receives consolidated air cargo. Set `DELIVERY_HUBS` (e.g. `NG:Lagos,KE:Nairobi`) once a receiving agent exists, and those couriers appear as choices ("Air cargo to our Lagos hub, then GIG Logistics to your door"), along with collecting at the hub. Without a hub they're not offered, because nobody would be there to hand the parcel over.

### Coverage evidence

- YunExpress and 4PX claim 200+ destinations through partners; their *direct lines* (what's offered here) cover the US, Canada, most of Europe, Japan, Korea, Southeast Asia, Australia, New Zealand, the Gulf, Mexico, Brazil, Chile and South Africa. Neither showed reliable direct service to Nigeria, Ghana or Kenya. ([ordertracker: YunExpress](https://www.ordertracker.com/carriers/yunexpress), [ordertracker: 4PX](https://www.ordertracker.com/carriers/4px), [NextSmartShip on 4PX](https://www.nextsmartship.com/blog/4px-shipping/))
- Cainiao's consolidated service covers the Gulf's top five markets in 7–13 days, and its main lines Europe, North America, Japan, Korea, Oceania and Latin America. ([Cainiao](https://www.cainiao.com/en/news-details/4694.html))
- Speedaf runs local express networks in Ghana, Uganda, Kenya, Nigeria and Morocco, and partnered with NIPOST for line-haul in 2022. Egypt and Côte d'Ivoire were not confirmed. ([Speedaf funding release](https://www.ajot.com/news/speedaf-express-announces-completion-of-round-a-financing-to-build-a-leading-china-africa-express-brand), [Speedaf Nigeria](https://speedaf.com/ng-en/article-list))
- FedEx in Nigeria is delivered by **Red Star Express**, its licensee, and the option says so. ([directory listing](https://www.finelib.com/business/transportation/courier-services))
- J&T delivers itself in Southeast Asia, Mexico, Brazil, the UAE, Saudi Arabia and Egypt. ([J&T](https://www.jtexpress.com/en/aboutUs))

## Prices

Official China-origin rate cards for DHL, FedEx, UPS, EMS and the lines aren't published openly; forwarders resell account rates. So each service has a **rate card per zone**: a price for the first 500 g and for each further 500 g, in US cents, set inside the ranges these sources report:

| Route, about 0.5–2 kg | Reported | Sources |
| --- | --- | --- |
| Express to the US | $10–13/kg at forwarder rates; 2026 general rate increase 5.9% | [Vantage Forwarding](https://vantageforwarding.com/dhl-shipping-rates-per-kg-2026-complete-pricing-guide/), [Goodhope Freight](https://goodhopefreight.com/dhl/usa-list.html), [Shippo](https://goshippo.com/blog/ups-vs-fedex-vs-dhl-vs-usps-international-shipping-rates-comparison) |
| Express to Nigeria | $10–18/kg, 3–7 days; air cargo to Lagos $5–11/kg | [Goodhope Freight](https://goodhopefreight.com/nigeria/2026-freight.html), [Sino-Shipping](https://www.sino-shipping.com/freight-china-nigeria/), [Welltrans](https://welltrans-logistics.com/?p=2494) |
| YunExpress | $6–12 per 0.5 kg to the US, $8–15 to Western Europe; $13–15/kg | [Alibaba buying guide](https://smartbuy.alibaba.com/buyingguides/yunexpress), [PluginHive](https://www.pluginhive.com/yun-express/) |
| China Post small packet / ePacket | about ¥85/kg + ¥23 per item to the US (≈ $9 for 500 g) | [Shopify](https://www.shopify.com/blog/epacket-delivery-explained-everything-you-need-to-know-about-epacket-shipping), [China Postal Tracking rates](https://www.chinapostaltracking.com/service/rate/), [Vantage on China Post](https://vantageforwarding.com/china-post-shipping/) |

**Confidence: medium.** These are honest estimates, labelled as such at checkout, and they are what shoppers pay. Before taking real money:

1. Get contract rates from a Shenzhen/Guangzhou forwarder (or each carrier) and put them in `SERVICES` in the catalogue: one pair of numbers per zone.
2. Or set `EASYSHIP_API_KEY` (an Easyship token with `public.rate:read`): DHL, FedEx, UPS, Aramex and SF prices then come live from [Easyship's Rates API](https://developers.easyship.com/reference/rates_request), quoted from Hong Kong in US dollars, with the rate cards as a fallback if it's slow (4 s) or down. Easyship confirms Hong Kong as an origin; mainland China origins weren't confirmed. ([Easyship developers](https://www.easyship.com/developers/shipping-rates-api))

## Country notes

| Country | Delivered locally by | Worth knowing |
| --- | --- | --- |
| Nigeria | DHL, Red Star (FedEx), UPS, Aramex, NIPOST (EMS, small packet), Speedaf | Local couriers for a hub: GIG Logistics (all 36 states), ABC Cargo (terminal pickup), Kwik (Lagos same day), Sendbox, NIPOST, Red Star. |
| Ghana | DHL, FedEx, UPS, Ghana Post, Speedaf | Ghana licensed 140 private couriers in 2025 ([Graphic Online](https://www.graphic.com.gh/business/business-news/list-only-140-couriers-are-legal-is-your-delivery-service-on-ghanas-2025-licensed-list.html)). |
| Kenya | DHL, FedEx, UPS, Aramex, Posta Kenya, Speedaf | Hub couriers: G4S, Fargo, Pickup Mtaani (agent pickup), Posta. Sendy closed in 2023 and isn't listed. |
| South Africa | DHL, FedEx, UPS, Aramex, SAPO; lines via The Courier Guy and Aramex SA | Pudo lockers and Pargo pickup points are the usual e-commerce handovers ([Zawya](https://www.zawya.com/en/economy/africa/5-last-mile-shifts-set-to-reshape-south-african-e-commerce-in-2026-h2hbgykb)). |
| Egypt | DHL, FedEx, UPS, Aramex, J&T, Egypt Post | Bosta and Mylerz lead e-commerce last mile. |
| Côte d'Ivoire | DHL, FedEx, UPS, La Poste CI | Yango Delivery and Gozem do same-day in Abidjan ([Kolonell](https://kolonell.com/en/blog/last-mile-delivery-abidjan-2026)). |
| United Kingdom | Royal Mail, Evri, DPD, Yodel (lines); InPost lockers | Evri took over DHL eCommerce UK in 2025. |
| Germany | DHL Paket (≈ half the market), Hermes, GLS, DPD | Packstation lockers. |
| France | La Poste/Colissimo (≈ 48% by volume), Chronopost, Mondial Relay, Relais Colis | Pickup points are very common. |
| United States | USPS for postal and most lines; UPS, FedEx | Duty-free de minimis ended for China in May 2025 and for everyone in August 2025; postal parcels go through CBP's postal entry process ([CRS](https://www.congress.gov/crs-product/IF12891)). |
| Canada | Canada Post, Purolator, Intelcom, Canpar | |
| Brazil | Correios, J&T Brasil, Loggi, Jadlog | Remessa Conforme: certified sites get zero federal duty up to US$50, state ICMS 17–20% always applies ([DHL Brazil](https://www.dhl.com/discover/en-br/regulatory-affairs/remessa-conforme-brazil)). |
| Mexico | Estafeta, J&T México, Correos de México, 99minutos | Courier parcels from China pay 33.5% from the first dollar ([Alvarez & Marsal](https://www.alvarezandmarsal.com/node/91421), [Mexico Business News](https://mexicobusiness.news/ecommerce/news/mexico-hike-import-tax-low-value-packages-335)). |
| India | DHL (Blue Dart), FedEx, UPS, Aramex, India Post | Domestic couriers (Delhivery, DTDC, Xpressbees) don't import; e-commerce lines aren't offered. |
| Philippines / Indonesia | J&T, Ninja Van, LBC, Flash; JNE, SiCepat, Pos Indonesia | J&T delivers its own international line. |
| Australia | Australia Post, Aramex Australia, CouriersPlease | |
| UAE | Aramex, Emirates Post, J&T | |

Every other country gets DHL, FedEx, UPS, EMS and China Post (delivered by its national post, named for about 100 countries), plus any line that reaches it.

## Settings

| Name | What it does |
| --- | --- |
| `DELIVERY_HUBS` | Countries with a receiving hub, as `NG:Lagos,KE:Nairobi`. Adds local couriers and hub collection there. |
| `EASYSHIP_API_KEY` | Live express prices from Easyship instead of rate-card estimates. |

## Before relying on it

- Replace the rate cards with contract rates, or connect Easyship.
- Confirm each line's current country list with the line (they change quarterly).
- For a hub country, have a receiving agent and tell shops where to drop parcels for the air cargo.
- Duties and taxes are separate (the existing duty/VAT step); express carriers may add clearance fees at the door.
