/** What a courier needs to deliver to a country, beyond a street and a city. */
export type AddressRules = { postcode: { label: string; required: boolean }; region: { label: string; required: boolean } };

/** Countries whose couriers refuse or delay a parcel without a postal code. */
const POSTCODE_REQUIRED = new Set(
  "AR AT AU BD BE BG BR CA CH CL CN CO CZ DE DK EE EG ES FI FR GB GR HR HU ID IE IL IN IS IT JP KR KW LK LT LU LV MA MX MY NL NO NZ OM PE PH PK PL PT RO SA SE SG SI SK TH TR TW UA US VN ZA".split(" "),
);

const POSTCODE_LABELS: Record<string, string> = { US: "ZIP code", IN: "PIN code", BR: "CEP", CA: "Postal code", JP: "Postal code", KR: "Postal code", CN: "Postal code" };

/** Countries where the address isn't complete without a state or province, and what it's called. */
const REGIONS_REQUIRED: Record<string, string> = {
  AR: "Province",
  AU: "State",
  BR: "State",
  CA: "Province",
  CN: "Province",
  ID: "Province",
  IN: "State",
  JP: "Prefecture",
  MX: "State",
  MY: "State",
  NG: "State",
  TH: "Province",
  US: "State",
};

export function addressRules(country: string): AddressRules {
  return {
    postcode: { label: POSTCODE_LABELS[country] ?? "Postcode", required: POSTCODE_REQUIRED.has(country) },
    region: { label: REGIONS_REQUIRED[country] ?? "State or region", required: country in REGIONS_REQUIRED },
  };
}
