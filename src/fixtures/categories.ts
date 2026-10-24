// Fixture data for the design phase. Every name, price and count here is illustrative.
import { photo, square } from "@/lib/images";
import type { Category } from "@/lib/types";

const hero = (id: string, fx = 0.5, fy = 0.5) => photo(id, { ar: "16:9", fx, fy });

export const categories: Category[] = [
  {
    id: "energy",
    label: "Renewable energy",
    image: square("1724041875334-0a6397111c7e"),
    hero: hero("1641959166364-6c9b9898e804"),
    blurb: "Panels, batteries, inverters and wind, from the factories that supply the world's installers.",
    subcategories: ["Solar panels", "Power stations", "Batteries", "Inverters", "Wind", "EV chargers"],
  },
  {
    id: "mobility",
    label: "EVs and mobility",
    image: square("1780690165069-32978b08e556"),
    hero: hero("1760435107985-40b6872c8c97", 0.6),
    blurb: "E-bikes, scooters and export-spec electric cars, shipped to your door or your port.",
    subcategories: ["E-bikes", "Scooters", "E-motos", "Electric cars"],
  },
  {
    id: "electronics",
    label: "Electronics",
    image: square("1606220588913-b3aacb4d2f46", 0.55),
    hero: hero("1559227657-1835d2db47b6"),
    blurb: "Straight from Shenzhen: drones, audio, power banks, wearables and projectors.",
    subcategories: ["Drones", "Earbuds", "Power banks", "Smartwatches", "Projectors", "Keyboards", "3D printers"],
  },
  {
    id: "smarthome",
    label: "Smart home",
    image: square("1653990480360-31a12ce9723e"),
    hero: hero("1762859731349-c9ff2808b672"),
    blurb: "Robot vacuums and connected gadgets with no subscriptions.",
    subcategories: ["Robot vacuums", "Mops"],
  },
  {
    id: "fashion",
    label: "Fashion",
    image: square("1679032753853-27a8444b2dbe", 0.5, 0.4),
    hero: hero("1745240261519-0b988d54d098", 0.5, 0.35),
    blurb: "Heavyweight streetwear, made-to-measure qipao and hanfu, and trainers from Jinjiang.",
    subcategories: ["Hoodies", "Jackets", "Qipao", "Hanfu", "Trainers"],
  },
  {
    id: "bags",
    label: "Bags",
    image: square("1598532163257-ae3c6b2524b6"),
    hero: hero("1768806470363-7c6193a29645"),
    blurb: "Leather and nylon from Baigou, where a third of China's bags are made. Your logo from 50 pieces.",
    subcategories: ["Totes", "Shoulder bags", "Slings", "Top-handle"],
  },
  {
    id: "jewelry",
    label: "Jade and silver",
    image: square("1767043004223-b2ccbefd98e9"),
    hero: hero("1767040276964-d2a39a86b1d4"),
    blurb: "Certified natural jade and hand-hammered Miao silver from the workshops that cut it.",
    subcategories: ["Bangles", "Bead bracelets", "Silver"],
  },
  {
    id: "textiles",
    label: "Silk and fabric",
    image: square("1518893063132-36e46dbe2428"),
    hero: hero("1619043518800-7f14be467dca"),
    blurb: "Mulberry silk by the metre or the roll, woven and dyed in Hangzhou.",
    subcategories: ["Charmeuse", "Swatches"],
  },
  {
    id: "beauty",
    label: "Beauty",
    image: square("1773372238338-f26460145162"),
    hero: hero("1592150282082-37698debe277", 0.5, 0.3),
    blurb: "Clean, fragrance-free C-beauty from the Guangzhou labs behind global brands.",
    subcategories: ["Lips", "Serums", "Creams", "Sets"],
  },
  {
    id: "home",
    label: "Home and craft",
    image: square("1723779234372-023dd09385ef"),
    hero: hero("1723779232054-6f6be572c0e8"),
    blurb: "Hand-painted porcelain, cloisonné, brass lighting and lanterns.",
    subcategories: ["Porcelain", "Cloisonné", "Lamps", "Lanterns"],
  },
  {
    id: "tea",
    label: "Tea",
    image: square("1766232574096-4c4380105cc7"),
    hero: hero("1531970227416-f0cddeb1f748"),
    blurb: "First-flush Longjing and the teaware to brew it, from the hills above Hangzhou.",
    subcategories: ["Longjing", "Teapots", "Tea sets"],
  },
  {
    id: "toys",
    label: "Art toys",
    image: square("1758348620526-f24ce6f67826", 0.45),
    hero: hero("1750767303953-f0dca8a917ae"),
    blurb: "Blind boxes and designer figures, with a new series every month.",
    subcategories: ["Blind boxes", "Plush"],
  },
];

