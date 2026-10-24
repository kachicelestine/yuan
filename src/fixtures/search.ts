// Fixture data for the design phase.
import { photo } from "@/lib/images";
import type { SnapSample } from "@/lib/types";

/** What people search most this week, in order. */
export const trendingSearches = [
  "balcony solar",
  "power station",
  "heavyweight hoodie",
  "jade bangle",
  "mini projector",
  "robot vacuum",
  "silk by the metre",
  "e-bike",
];

/** Words shoppers use that our listings phrase differently. */
export const synonyms: Record<string, string[]> = {
  battery: ["lifepo4", "power station", "wall battery"],
  ebike: ["e-moto", "e-scooter", "e-bike"],
  "e-bike": ["e-moto", "e-scooter"],
  car: ["ev", "sedan", "suv"],
  ev: ["electric"],
  solar: ["panel", "pv"],
  charger: ["power bank", "ev charger"],
  dress: ["qipao", "hanfu"],
  jewellery: ["jade", "silver"],
  jewelry: ["jade", "silver"],
  fabric: ["silk", "charmeuse"],
  watch: ["smartwatch"],
  bag: ["tote", "sling", "shoulder"],
};

/** Sample photos for Snap to search, with the matches a vision model would return. */
export const snapSamples: SnapSample[] = [
  { id: "powerbank", label: "Power bank", image: photo("1566554738544-d962991c3fee", { ar: "3:4" }), guess: "Power bank", matches: [["power-bank-20k", 96], ["power-station-2kwh", 81], ["earbuds-anc", 72], ["smartwatch-amoled", 68]] },
  { id: "trainers", label: "Trainers", image: photo("1560769629-975ec94e6a86", { ar: "3:4" }), guess: "Knit trainers", matches: [["trainers-cloud-knit", 97], ["hoodie-heavyweight", 73], ["bag-sling-tech", 69], ["jacket-oversized-utility", 64]] },
  { id: "jade", label: "Bracelet", image: photo("1767043004223-b2ccbefd98e9", { ar: "3:4" }), guess: "Jade bangle", matches: [["jade-bangle-lantian", 98], ["jade-bead-bracelet", 91], ["miao-silver-headpiece", 70], ["vase-cloisonne-enamel", 62]] },
  { id: "roof", label: "Solar roof", image: photo("1655300256335-beef51a914fe", { ar: "3:4" }), guess: "Solar panels", matches: [["solar-panel-450w-bifacial", 95], ["balcony-solar-800w", 92], ["hybrid-inverter-6kw", 77], ["wall-battery-5kwh", 71]] },
];

/** What an unknown photo (camera or upload) returns until the vision service exists. */
export const snapFallback: SnapSample["matches"] = [["power-bank-20k", 84], ["hoodie-heavyweight", 76], ["jade-bangle-lantian", 71], ["balcony-solar-800w", 66]];

