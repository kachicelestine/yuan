import { describe, expect, it } from "vitest";
import { cleanAddress } from "./address";

describe("delivery addresses", () => {
  const ok = { name: " Ada  Obi ", phone: "+234 803 123 4567", line1: "12 Admiralty Way", city: "Lagos" };

  it("tidies spaces and fills the optional parts", () => {
    const r = cleanAddress(ok);
    expect(r.ok && r.value).toEqual({ name: "Ada Obi", phone: "+234 803 123 4567", line1: "12 Admiralty Way", line2: "", city: "Lagos", region: "", postcode: "" });
  });

  it("needs a name, a callable phone, a street and a city", () => {
    expect(cleanAddress({ ...ok, name: "A" }).ok).toBe(false);
    expect(cleanAddress({ ...ok, phone: "call me" }).ok).toBe(false);
    expect(cleanAddress({ ...ok, phone: "+1 2" }).ok).toBe(false);
    expect(cleanAddress({ ...ok, line1: "" }).ok).toBe(false);
    expect(cleanAddress({ ...ok, city: " " }).ok).toBe(false);
  });
});
