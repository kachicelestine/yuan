// Fixture data for the design phase.

/** Search ideas for the empty search screen (a curated list, not measured). */
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

