import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

/** Where a parcel goes, in the order's country. Seen by the buyer, and by a shop once paid. */
export type ShippingAddress = Readonly<{
  name: string;
  phone: string;
  /** Street and number. */
  line1: string;
  /** Apartment, floor, landmark. */
  line2: string;
  city: string;
  region: string;
  postcode: string;
}>;

export type AddressInput = { name: string; phone: string; line1: string; line2?: string; city: string; region?: string; postcode?: string };

export type AddressError = DomainError<"invalid_address">;

const tidy = (s: string | undefined) => (s ?? "").trim().replace(/\s+/g, " ");
const bad = (message: string) => err(domainError("invalid_address", message));

export function cleanAddress(input: AddressInput): Result<ShippingAddress, AddressError> {
  const a = { name: tidy(input.name), phone: tidy(input.phone), line1: tidy(input.line1), line2: tidy(input.line2), city: tidy(input.city), region: tidy(input.region), postcode: tidy(input.postcode) };
  if (a.name.length < 2 || a.name.length > 80) return bad("Add the full name for the delivery.");
  if (!/^\+?[\d\s()-]{6,24}$/.test(a.phone) || a.phone.replace(/\D/g, "").length < 6) return bad("Add a phone number the courier can call.");
  if (a.line1.length < 3 || a.line1.length > 120) return bad("Add the street and number.");
  if (a.line2.length > 120) return bad("Keep the apartment or landmark under 120 characters.");
  if (a.city.length < 2 || a.city.length > 60) return bad("Add the city.");
  if (a.region.length > 60 || a.postcode.length > 20) return bad("The region or postcode is too long.");
  return ok(a);
}
