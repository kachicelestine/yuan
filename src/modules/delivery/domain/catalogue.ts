import type { Zone } from "./zones";

// Who can carry a parcel from a shop in China to a shopper's door, country by country.
// Researched November 2026 from carriers' own sites and published coverage, with prices
// estimated from published rate structures and forwarder price lists (see docs/DELIVERY.md
// for the sources, and how to swap in contract rates). Rates are US cents, all-in for a
// tracked parcel: fuel and handling included, duties and taxes not.

export type CarrierKind = "express" | "post" | "line" | "freight" | "local";

export type Carrier = Readonly<{
  id: string;
  name: string;
  kind: CarrierKind;
  website: string;
  /** Tracking page, with {n} for the number. Without one, links go to a tracker that covers every carrier. */
  track?: string;
  /** Names shops might type for it when they ship. */
  aliases?: readonly string[];
}>;

/** Price of one parcel: the first 500 g (or the service's minimum), then each further 500 g or part of it, in cents. */
export type Rate = readonly [first: number, step: number];

export type Service = Readonly<{
  id: string;
  carrier: string;
  name: string;
  /** One line on what it is, for the shopper choosing. */
  blurb: string;
  /** Where the parcel ends up: the shopper's door, or a post office or pickup point near them. */
  handover: "door" | "pickup";
  maxGrams: number;
  /** Freight: the least weight it takes, and what the first price covers. Parcels: 500 g. */
  minGrams?: number;
  /** Countries it reaches; "all" means every country in a zone it has a rate for. */
  covers: "all" | readonly string[];
  rates: Partial<Record<Zone, Rate>>;
  /** Working days door to door, before customs holds and the extra days inland cities add. */
  days: Partial<Record<Zone, readonly [number, number]>>;
  /** Who brings it to the door in the shopper's country. */
  delivers: "self" | "post" | "partners";
}>;

/** A delivery company working inside one country: takes over at a receiving hub, if the platform has one there. */
export type LocalCourier = Readonly<{
  id: string;
  name: string;
  website: string;
  track?: string;
  handover: "door" | "pickup";
  /** Estimated fee for one parcel from the hub to a shopper in the same country, in cents. */
  fee: number;
  days: readonly [number, number];
  note?: string;
}>;

export type CountryDelivery = Readonly<{
  /** The national postal operator, which delivers EMS and China Post parcels. */
  post: string;
  /** Who the cross-border lines hand parcels to here (named in the option shown to shoppers). */
  partners?: readonly string[];
  /** Who delivers for a carrier here when it isn't the carrier itself (e.g. a licensee). */
  agents?: Readonly<Record<string, string>>;
  couriers?: readonly LocalCourier[];
}>;

// ── Carriers that collect from shops in China ────────────────────────────────

export const CARRIERS: readonly Carrier[] = [
  { id: "dhl", name: "DHL Express", kind: "express", website: "https://www.dhl.com", track: "https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id={n}", aliases: ["DHL"] },
  { id: "fedex", name: "FedEx", kind: "express", website: "https://www.fedex.com", track: "https://www.fedex.com/fedextrack/?trknbr={n}" },
  { id: "ups", name: "UPS", kind: "express", website: "https://www.ups.com", track: "https://www.ups.com/track?tracknum={n}" },
  { id: "aramex", name: "Aramex", kind: "express", website: "https://www.aramex.com", track: "https://www.aramex.com/track/results?ShipmentNumber={n}" },
  { id: "sf", name: "SF International", kind: "express", website: "https://www.sf-international.com", aliases: ["SF Express", "SF"] },
  { id: "ems", name: "EMS (China Post)", kind: "post", website: "https://www.ems.com.cn", aliases: ["EMS"] },
  { id: "chinapost", name: "China Post", kind: "post", website: "https://www.chinapost.com.cn", aliases: ["ePacket", "China Post ePacket"] },
  { id: "yunexpress", name: "YunExpress", kind: "line", website: "https://www.yunexpress.com", track: "https://www.yuntrack.com/parcelTracking?id={n}", aliases: ["Yun Express"] },
  { id: "4px", name: "4PX", kind: "line", website: "https://www.4px.com", track: "https://track.4px.com/#/result/0/{n}" },
  { id: "cainiao", name: "Cainiao", kind: "line", website: "https://global.cainiao.com", track: "https://global.cainiao.com/newDetail.htm?mailNoList={n}" },
  { id: "jt", name: "J&T Express", kind: "line", website: "https://www.jtexpress.com", aliases: ["J&T", "JT Express"] },
  { id: "speedaf", name: "Speedaf", kind: "line", website: "https://www.speedaf.com", aliases: ["Speedaf Express"] },
  { id: "air-freight", name: "Air freight", kind: "freight", website: "" },
  { id: "sea-freight", name: "Sea freight", kind: "freight", website: "" },
];

// ── Services, with their rate cards from China ───────────────────────────────

const ALL_ZONES = <T>(value: T): Record<Zone, T> => ({ asia: value, "south-asia-oceania": value, "middle-east": value, europe: value, "north-america": value, "latin-america": value, africa: value });

export const SERVICES: readonly Service[] = [
  {
    id: "dhl-express-worldwide",
    carrier: "dhl",
    name: "Express Worldwide",
    blurb: "Air express door to door, customs cleared by DHL",
    handover: "door",
    maxGrams: 70_000,
    covers: "all",
    rates: { asia: [1300, 250], "south-asia-oceania": [1700, 400], "middle-east": [1800, 400], europe: [1700, 350], "north-america": [1600, 350], "latin-america": [2400, 600], africa: [2200, 550] },
    days: { asia: [2, 4], "south-asia-oceania": [3, 5], "middle-east": [3, 5], europe: [3, 5], "north-america": [3, 5], "latin-america": [4, 7], africa: [4, 7] },
    delivers: "self",
  },
  {
    id: "fedex-international-priority",
    carrier: "fedex",
    name: "International Priority",
    blurb: "Air express door to door",
    handover: "door",
    maxGrams: 68_000,
    covers: "all",
    rates: { asia: [1300, 250], "south-asia-oceania": [1700, 400], "middle-east": [1850, 400], europe: [1700, 350], "north-america": [1550, 350], "latin-america": [2300, 550], africa: [2400, 600] },
    days: { asia: [2, 4], "south-asia-oceania": [3, 5], "middle-east": [3, 6], europe: [3, 5], "north-america": [2, 5], "latin-america": [4, 7], africa: [4, 8] },
    delivers: "self",
  },
  {
    id: "ups-worldwide-saver",
    carrier: "ups",
    name: "Worldwide Saver",
    blurb: "Air express door to door, end of day",
    handover: "door",
    maxGrams: 70_000,
    covers: "all",
    rates: { asia: [1350, 250], "south-asia-oceania": [1750, 400], "middle-east": [1900, 450], europe: [1650, 350], "north-america": [1600, 350], "latin-america": [2400, 600], africa: [2500, 650] },
    days: { asia: [2, 4], "south-asia-oceania": [3, 5], "middle-east": [3, 6], europe: [3, 5], "north-america": [3, 5], "latin-america": [4, 7], africa: [4, 8] },
    delivers: "self",
  },
  {
    id: "aramex-priority",
    carrier: "aramex",
    name: "Priority Express",
    blurb: "Air express, strongest across the Gulf, Africa and South Asia",
    handover: "door",
    maxGrams: 30_000,
    covers: ["AE", "SA", "QA", "KW", "BH", "OM", "JO", "LB", "EG", "MA", "TN", "KE", "UG", "TZ", "ET", "NG", "ZA", "IN", "PK", "BD", "LK", "AU", "NZ", "SG", "MY"],
    rates: { asia: [1200, 250], "south-asia-oceania": [1400, 350], "middle-east": [1300, 300], africa: [1800, 450] },
    days: { asia: [3, 6], "south-asia-oceania": [4, 7], "middle-east": [3, 6], africa: [4, 8] },
    delivers: "self",
  },
  {
    id: "sf-international-express",
    carrier: "sf",
    name: "International Express",
    blurb: "Air express, fastest across East Asia",
    handover: "door",
    maxGrams: 30_000,
    covers: ["JP", "KR", "TW", "HK", "MO", "SG", "MY", "TH", "VN", "PH", "ID", "KH", "US", "CA", "GB", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "AU", "NZ", "AE"],
    rates: { asia: [1000, 200], "south-asia-oceania": [1600, 350], "middle-east": [1800, 400], europe: [1600, 350], "north-america": [1500, 350] },
    days: { asia: [2, 4], "south-asia-oceania": [3, 6], "middle-east": [4, 7], europe: [3, 7], "north-america": [3, 6] },
    delivers: "self",
  },
  {
    id: "ems",
    carrier: "ems",
    name: "EMS",
    blurb: "Postal express, delivered by your national post",
    handover: "door",
    maxGrams: 30_000,
    covers: "all",
    rates: { asia: [1200, 250], "south-asia-oceania": [1500, 350], "middle-east": [1700, 400], europe: [1600, 400], "north-america": [1800, 450], "latin-america": [2100, 500], africa: [1900, 450] },
    days: { asia: [4, 8], "south-asia-oceania": [6, 12], "middle-east": [6, 12], europe: [6, 12], "north-america": [6, 12], "latin-america": [8, 18], africa: [7, 15] },
    delivers: "post",
  },
  {
    id: "chinapost-small-packet",
    carrier: "chinapost",
    name: "Tracked small packet",
    blurb: "The cheapest tracked way for light parcels, delivered by your national post",
    handover: "door",
    maxGrams: 2_000,
    covers: "all",
    rates: { asia: [500, 300], "south-asia-oceania": [650, 450], "middle-east": [700, 500], europe: [700, 500], "north-america": [900, 600], "latin-america": [900, 650], africa: [900, 650] },
    days: { asia: [7, 15], "south-asia-oceania": [10, 22], "middle-east": [12, 22], europe: [10, 20], "north-america": [10, 20], "latin-america": [20, 40], africa: [15, 35] },
    delivers: "post",
  },
  {
    id: "yunexpress-direct",
    carrier: "yunexpress",
    name: "Global Direct",
    blurb: "E-commerce line: flown in bulk, cleared, then handed to a local courier",
    handover: "door",
    maxGrams: 30_000,
    covers: ["US", "CA", "GB", "IE", "DE", "FR", "IT", "ES", "PT", "NL", "BE", "LU", "AT", "CH", "PL", "CZ", "SK", "HU", "RO", "GR", "SE", "DK", "FI", "NO", "JP", "KR", "SG", "MY", "TH", "PH", "VN", "ID", "AU", "NZ", "AE", "SA", "IL", "QA", "KW", "MX", "BR", "CL", "CO", "PE", "AR", "ZA"],
    rates: { asia: [600, 300], "south-asia-oceania": [850, 500], "middle-east": [900, 550], europe: [750, 450], "north-america": [700, 450], "latin-america": [1100, 700], africa: [1200, 700] },
    days: { asia: [5, 10], "south-asia-oceania": [7, 14], "middle-east": [7, 14], europe: [5, 10], "north-america": [6, 12], "latin-america": [12, 25], africa: [12, 25] },
    delivers: "partners",
  },
  {
    id: "4px-global",
    carrier: "4px",
    name: "Global Express",
    blurb: "E-commerce line handed to a local courier on arrival",
    handover: "door",
    maxGrams: 30_000,
    covers: ["US", "CA", "GB", "IE", "DE", "FR", "IT", "ES", "PT", "NL", "BE", "AT", "CH", "PL", "CZ", "SE", "DK", "FI", "NO", "JP", "KR", "SG", "MY", "TH", "PH", "AU", "NZ", "AE", "SA", "IL", "MX", "BR", "CL", "AR", "ZA"],
    rates: { asia: [600, 300], "south-asia-oceania": [850, 500], "middle-east": [950, 550], europe: [700, 450], "north-america": [750, 450], "latin-america": [1150, 700], africa: [1250, 700] },
    days: { asia: [5, 10], "south-asia-oceania": [8, 15], "middle-east": [8, 16], europe: [6, 12], "north-america": [7, 14], "latin-america": [15, 30], africa: [15, 30] },
    delivers: "partners",
  },
  {
    id: "cainiao-standard",
    carrier: "cainiao",
    name: "Global Standard",
    blurb: "Alibaba's consolidated line, handed to a local courier on arrival",
    handover: "door",
    maxGrams: 20_000,
    covers: ["US", "CA", "GB", "IE", "DE", "FR", "ES", "IT", "NL", "BE", "PL", "PT", "JP", "KR", "AU", "NZ", "AE", "SA", "QA", "KW", "BH", "OM", "IL", "BR", "MX", "CL"],
    rates: { asia: [500, 300], "south-asia-oceania": [750, 450], "middle-east": [800, 500], europe: [650, 400], "north-america": [650, 400], "latin-america": [950, 600] },
    days: { asia: [5, 10], "south-asia-oceania": [8, 16], "middle-east": [7, 13], europe: [7, 15], "north-america": [8, 15], "latin-america": [15, 30] },
    delivers: "partners",
  },
  {
    id: "jt-international",
    carrier: "jt",
    name: "International",
    blurb: "J&T flies it over, then its own riders deliver",
    handover: "door",
    maxGrams: 30_000,
    covers: ["PH", "ID", "MY", "TH", "VN", "SG", "KH", "MX", "BR", "AE", "SA", "EG"],
    rates: { asia: [500, 250], "middle-east": [800, 450], "latin-america": [1000, 600], africa: [1000, 500] },
    days: { asia: [4, 9], "middle-east": [7, 12], "latin-america": [10, 20], africa: [8, 15] },
    delivers: "self",
  },
  {
    id: "speedaf-africa",
    carrier: "speedaf",
    name: "China–Africa Express",
    blurb: "Air line built for China to Africa, delivered by Speedaf's own network",
    handover: "door",
    maxGrams: 30_000,
    covers: ["NG", "GH", "KE", "UG", "MA"],
    rates: { africa: [1200, 450] },
    days: { africa: [7, 14] },
    delivers: "self",
  },
];

/**
 * Wholesale: consolidated cargo booked by a freight forwarder, door to door with duties
 * left to the buyer. Priced per kilo above a minimum charge; sea freight from about a
 * hundred kilos, when it beats the air by far.
 */
export const FREIGHT: readonly Service[] = [
  {
    id: "air-freight",
    carrier: "air-freight",
    name: "Consolidated air cargo",
    blurb: "For bulk orders: flown with other cargo, cleared, then trucked to you",
    handover: "door",
    minGrams: 21_000,
    maxGrams: 3_000_000,
    covers: "all",
    // 21 kg minimum, then per 500 g: $3.50–$8 a kilo by zone.
    rates: { asia: [7_350, 175], "south-asia-oceania": [10_500, 250], "middle-east": [11_550, 275], europe: [12_600, 300], "north-america": [12_600, 300], "latin-america": [16_800, 400], africa: [16_800, 400] },
    days: { asia: [4, 8], "south-asia-oceania": [6, 10], "middle-east": [6, 10], europe: [6, 10], "north-america": [6, 10], "latin-america": [8, 14], africa: [7, 12] },
    delivers: "partners",
  },
  {
    id: "sea-freight",
    carrier: "sea-freight",
    name: "Shared container (LCL)",
    blurb: "For heavy bulk orders: shares a container, the cheapest by far, but slow",
    handover: "door",
    minGrams: 100_000,
    maxGrams: 20_000_000,
    covers: "all",
    // 100 kg minimum, then per 500 g: $0.60–$1.30 a kilo by zone.
    rates: { asia: [6_000, 30], "south-asia-oceania": [9_000, 45], "middle-east": [9_000, 45], europe: [10_000, 50], "north-america": [11_000, 55], "latin-america": [13_000, 65], africa: [12_000, 60] },
    days: { asia: [10, 20], "south-asia-oceania": [25, 40], "middle-east": [25, 35], europe: [35, 45], "north-america": [25, 40], "latin-america": [35, 50], africa: [35, 50] },
    delivers: "partners",
  },
];

/** Consolidated air cargo from our receiving point in China to a hub in the shopper's country. */
export const HUB_FREIGHT: Record<Zone, { rate: Rate; days: readonly [number, number] }> = {
  ...ALL_ZONES({ rate: [800, 350] as Rate, days: [7, 14] as const }),
  asia: { rate: [500, 200], days: [4, 8] },
  europe: { rate: [700, 300], days: [6, 12] },
  "north-america": { rate: [700, 300], days: [6, 12] },
};

// ── Countries: who delivers there ────────────────────────────────────────────

/** National postal operators, which deliver EMS and China Post parcels. */
export const POSTS: Readonly<Record<string, string>> = {
  US: "USPS", CA: "Canada Post", MX: "Correos de México", BR: "Correios", AR: "Correo Argentino", CL: "Correos de Chile", CO: "4-72", PE: "Serpost", UY: "Correo Uruguayo", EC: "Correos del Ecuador",
  GB: "Royal Mail", IE: "An Post", FR: "La Poste", DE: "Deutsche Post", IT: "Poste Italiane", ES: "Correos", PT: "CTT", NL: "PostNL", BE: "bpost", LU: "POST Luxembourg", AT: "Österreichische Post", CH: "Swiss Post",
  PL: "Poczta Polska", CZ: "Česká pošta", SK: "Slovenská pošta", HU: "Magyar Posta", RO: "Poșta Română", BG: "Bulgarian Posts", GR: "ELTA", SE: "PostNord", DK: "PostNord", NO: "Posten Bring", FI: "Posti",
  EE: "Omniva", LV: "Latvijas Pasts", LT: "Lietuvos paštas", HR: "Hrvatska pošta", SI: "Pošta Slovenije", RS: "Pošta Srbije", UA: "Ukrposhta", TR: "PTT", RU: "Russian Post", CY: "Cyprus Post", MT: "MaltaPost", IS: "Iceland Post",
  IL: "Israel Post", AE: "Emirates Post", SA: "SPL (Saudi Post)", QA: "Qatar Post", OM: "Oman Post", BH: "Bahrain Post", JO: "Jordan Post", LB: "LibanPost", KW: "Kuwait Post",
  EG: "Egypt Post", MA: "Barid Al-Maghrib", DZ: "Algérie Poste", TN: "La Poste Tunisienne", NG: "NIPOST", GH: "Ghana Post", KE: "Posta Kenya", UG: "Posta Uganda", TZ: "Tanzania Posts Corporation", RW: "Iposita",
  ET: "Ethiopian Postal Service", ZA: "SA Post Office", ZM: "Zampost", ZW: "Zimpost", CI: "La Poste de Côte d'Ivoire", SN: "La Poste du Sénégal", CM: "Campost", BW: "BotswanaPost", NA: "NamPost", MU: "Mauritius Post",
  IN: "India Post", PK: "Pakistan Post", BD: "Bangladesh Post", LK: "Sri Lanka Post", NP: "Nepal Post", JP: "Japan Post", KR: "Korea Post", TW: "Chunghwa Post", HK: "Hongkong Post", MO: "Macau Post",
  SG: "SingPost", MY: "Pos Malaysia", TH: "Thailand Post", VN: "Vietnam Post", PH: "PHLPost", ID: "Pos Indonesia", KH: "Cambodia Post", AU: "Australia Post", NZ: "NZ Post", FJ: "Post Fiji", KZ: "Kazpost", UZ: "Uzbekiston Pochtasi",
};

const c = (id: string, name: string, website: string, fee: number, days: readonly [number, number], more: Partial<LocalCourier> = {}): LocalCourier => ({ id, name, website, fee, days, handover: "door", ...more });

/** Countries researched in depth: the markets with the most shoppers. */
export const COUNTRIES: Readonly<Record<string, Omit<CountryDelivery, "post">>> = {
  NG: {
    agents: { fedex: "Red Star Express, FedEx's licensee in Nigeria" },
    couriers: [
      c("gig", "GIG Logistics", "https://giglogistics.com", 300, [1, 3], { note: "All 36 states; door delivery or collection at a GIG centre" }),
      c("abc-cargo", "ABC Cargo Express", "https://abctransport.com", 250, [1, 4], { handover: "pickup", note: "Collect at an ABC Transport terminal" }),
      c("kwik", "Kwik Delivery", "https://kwik.delivery", 250, [0, 1], { note: "Same day, Lagos only" }),
      c("sendbox", "Sendbox", "https://sendbox.co", 300, [1, 3], { note: "Books the best local courier for your address" }),
      c("nipost", "NIPOST", "https://www.nipost.gov.ng", 200, [2, 7], { handover: "pickup", note: "Collect at your post office" }),
      c("redstar", "Red Star Express", "https://www.redstarplc.com", 350, [1, 3]),
    ],
  },
  GH: {
    couriers: [
      c("ghana-post", "Ghana Post", "https://www.ghanapost.com.gh", 200, [1, 5], { note: "Door delivery by GhanaPostGPS address, or collect at a post office" }),
      c("speedaf-gh", "Speedaf Ghana", "https://www.speedaf.com", 250, [1, 3]),
      c("dhl-gh", "DHL Ghana", "https://www.dhl.com/gh-en", 600, [1, 2]),
    ],
  },
  KE: {
    couriers: [
      c("g4s", "G4S Courier", "https://www.g4s.com/en-ke", 350, [1, 2], { note: "Nationwide, with counters in most towns" }),
      c("fargo", "Fargo Courier", "https://www.fargocourier.co.ke", 300, [1, 2]),
      c("pickup-mtaani", "Pickup Mtaani", "https://pickupmtaani.com", 150, [1, 3], { handover: "pickup", note: "Collect at an agent near you" }),
      c("posta", "Posta Kenya", "https://www.posta.co.ke", 150, [2, 5], { handover: "pickup" }),
      c("speedaf-ke", "Speedaf Kenya", "https://www.speedaf.com", 250, [1, 3]),
    ],
  },
  ZA: {
    partners: ["The Courier Guy", "Aramex South Africa"],
    couriers: [
      c("courier-guy", "The Courier Guy", "https://www.thecourierguy.co.za", 650, [1, 3]),
      c("aramex-za", "Aramex South Africa", "https://www.aramex.co.za", 550, [2, 4], { note: "Formerly Fastway" }),
      c("pudo", "Pudo lockers", "https://www.pudo.co.za", 400, [1, 3], { handover: "pickup", note: "Collect from a locker, any time" }),
      c("pargo", "Pargo", "https://pargo.co.za", 400, [2, 4], { handover: "pickup", note: "Collect at a partner shop" }),
      c("postnet", "PostNet", "https://www.postnet.co.za", 600, [1, 3], { handover: "pickup" }),
      c("ram", "RAM", "https://www.ram.co.za", 450, [1, 3]),
    ],
  },
  EG: {
    couriers: [
      c("bosta", "Bosta", "https://bosta.co", 200, [1, 3]),
      c("mylerz", "Mylerz", "https://www.mylerz.com", 200, [1, 3]),
      c("aramex-eg", "Aramex Egypt", "https://www.aramex.com", 300, [1, 3]),
      c("jt-eg", "J&T Express Egypt", "https://www.jtexpress.com", 200, [1, 4]),
      c("egypt-post", "Egypt Post", "https://egyptpost.org", 150, [2, 6], { handover: "pickup" }),
    ],
  },
  CI: {
    couriers: [
      c("yango", "Yango Delivery", "https://yango.com", 200, [0, 1], { note: "Same day in Abidjan" }),
      c("gozem", "Gozem", "https://www.gozem.co", 200, [0, 1], { note: "Abidjan" }),
      c("poste-ci", "La Poste de Côte d'Ivoire", "https://www.laposte.ci", 150, [2, 6], { handover: "pickup" }),
    ],
  },
  GB: {
    partners: ["Royal Mail", "Evri", "DPD", "Yodel"],
    couriers: [
      c("royal-mail", "Royal Mail", "https://www.royalmail.com", 450, [1, 3], { track: "https://www.royalmail.com/track-your-item#/tracking-results/{n}" }),
      c("evri", "Evri", "https://www.evri.com", 400, [2, 4]),
      c("dpd-uk", "DPD", "https://www.dpd.co.uk", 650, [1, 2]),
      c("inpost-uk", "InPost lockers", "https://inpost.co.uk", 350, [1, 3], { handover: "pickup" }),
      c("yodel", "Yodel", "https://www.yodel.co.uk", 400, [2, 4]),
    ],
  },
  DE: {
    partners: ["DHL Paket", "Hermes", "GLS", "DPD"],
    couriers: [
      c("dhl-paket", "DHL Paket", "https://www.dhl.de", 550, [1, 2], { track: "https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={n}", note: "Door, Packstation or post office" }),
      c("hermes", "Hermes", "https://www.myhermes.de", 450, [2, 3]),
      c("gls-de", "GLS", "https://gls-group.com/DE", 500, [1, 3]),
      c("dpd-de", "DPD", "https://www.dpd.com/de", 550, [1, 2]),
    ],
  },
  FR: {
    partners: ["La Poste (Colissimo)", "Chronopost", "Mondial Relay", "DPD France", "GLS"],
    couriers: [
      c("colissimo", "Colissimo", "https://www.colissimo.fr", 600, [2, 3], { track: "https://www.laposte.fr/outils/suivre-vos-envois?code={n}" }),
      c("mondial-relay", "Mondial Relay", "https://www.mondialrelay.fr", 400, [3, 5], { handover: "pickup", note: "Collect at a Point Relais" }),
      c("chronopost", "Chronopost", "https://www.chronopost.fr", 900, [1, 2]),
      c("relais-colis", "Relais Colis", "https://www.relaiscolis.com", 400, [3, 5], { handover: "pickup" }),
    ],
  },
  US: {
    partners: ["USPS", "UPS", "FedEx Ground"],
    couriers: [
      c("usps", "USPS", "https://www.usps.com", 650, [2, 5], { track: "https://tools.usps.com/go/TrackConfirmAction?tLabels={n}" }),
      c("ups-ground", "UPS Ground", "https://www.ups.com", 1000, [1, 5], { track: "https://www.ups.com/track?tracknum={n}" }),
      c("fedex-ground", "FedEx Ground", "https://www.fedex.com", 1000, [1, 5], { track: "https://www.fedex.com/fedextrack/?trknbr={n}" }),
    ],
  },
  CA: {
    partners: ["Canada Post", "Purolator", "Intelcom"],
    couriers: [
      c("canada-post", "Canada Post", "https://www.canadapost-postescanada.ca", 1100, [2, 7], { track: "https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor={n}" }),
      c("purolator", "Purolator", "https://www.purolator.com", 1300, [1, 4]),
      c("canpar", "Canpar", "https://www.canpar.com", 1100, [1, 5]),
    ],
  },
  BR: {
    partners: ["Correios", "J&T Express Brasil", "Loggi", "Jadlog"],
    couriers: [
      c("correios", "Correios", "https://www.correios.com.br", 500, [3, 10]),
      c("loggi", "Loggi", "https://www.loggi.com", 500, [2, 7]),
      c("jadlog", "Jadlog", "https://www.jadlog.com.br", 550, [2, 8]),
      c("jt-br", "J&T Express Brasil", "https://www.jtexpress.com.br", 450, [2, 8]),
    ],
  },
  MX: {
    partners: ["Estafeta", "J&T Express México", "Correos de México"],
    couriers: [
      c("estafeta", "Estafeta", "https://www.estafeta.com", 600, [1, 4]),
      c("paquetexpress", "Paquetexpress", "https://www.paquetexpress.com.mx", 550, [1, 5]),
      c("jt-mx", "J&T Express México", "https://www.jtexpress.mx", 400, [2, 6]),
      c("99minutos", "99minutos", "https://www.99minutos.com", 400, [0, 2], { note: "Same or next day in big cities" }),
    ],
  },
  IN: {
    couriers: [
      c("delhivery", "Delhivery", "https://www.delhivery.com", 150, [2, 5]),
      c("bluedart", "Blue Dart", "https://www.bluedart.com", 300, [1, 3]),
      c("dtdc", "DTDC", "https://www.dtdc.in", 150, [2, 6]),
      c("xpressbees", "Xpressbees", "https://www.xpressbees.com", 150, [2, 5]),
      c("india-post", "India Post", "https://www.indiapost.gov.in", 100, [3, 8], { note: "Reaches every pin code" }),
    ],
  },
  PH: {
    partners: ["J&T Express", "Ninja Van", "LBC", "PHLPost"],
    couriers: [
      c("jt-ph", "J&T Express", "https://www.jtexpress.ph", 150, [1, 4]),
      c("ninjavan-ph", "Ninja Van", "https://www.ninjavan.co/en-ph", 150, [1, 4]),
      c("lbc", "LBC Express", "https://www.lbcexpress.com", 250, [1, 4], { note: "Door or LBC branch pickup" }),
      c("flash-ph", "Flash Express", "https://www.flashexpress.ph", 150, [1, 4]),
    ],
  },
  ID: {
    partners: ["J&T Express", "JNE", "SiCepat", "Pos Indonesia"],
    couriers: [
      c("jne", "JNE", "https://www.jne.co.id", 150, [1, 4]),
      c("jt-id", "J&T Express", "https://www.jet.co.id", 150, [1, 4]),
      c("sicepat", "SiCepat", "https://www.sicepat.com", 150, [1, 3]),
      c("ninja-xpress", "Ninja Xpress", "https://www.ninjaxpress.co", 150, [1, 4]),
      c("anteraja", "AnterAja", "https://anteraja.id", 150, [1, 4]),
    ],
  },
  AU: {
    partners: ["Australia Post", "Aramex Australia", "CouriersPlease"],
    couriers: [
      c("auspost", "Australia Post", "https://auspost.com.au", 1000, [2, 6], { track: "https://auspost.com.au/mypost/track/details/{n}" }),
      c("aramex-au", "Aramex Australia", "https://www.aramex.com.au", 900, [2, 5]),
      c("couriersplease", "CouriersPlease", "https://www.couriersplease.com.au", 900, [2, 5]),
      c("sendle", "Sendle", "https://www.sendle.com", 900, [2, 6]),
    ],
  },
  AE: {
    partners: ["Aramex", "Emirates Post", "J&T Express UAE"],
    couriers: [
      c("aramex-ae", "Aramex", "https://www.aramex.com", 500, [1, 2]),
      c("emirates-post", "Emirates Post", "https://www.emiratespost.ae", 400, [1, 4]),
      c("jt-ae", "J&T Express UAE", "https://www.jtexpress.ae", 400, [1, 3]),
    ],
  },
  SA: { partners: ["SMSA Express", "Aramex", "SPL"] },
};
