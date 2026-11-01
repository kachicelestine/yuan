import { describe, expect, it } from "vitest";
import { cleanAddress } from "./address";

describe("delivery addresses", () => {
  const ok = { name: " Ada  Obi ", phone: "+234 803 123 4567", line1: "12 Admiralty Way", city: "Lagos" };

  it("tidies spaces and fills the optional parts", () => {
    const r = cleanAddress(ok, "GH");
    expect(r.ok && r.value).toEqual({ name: "Ada Obi", phone: "+234 803 123 4567", line1: "12 Admiralty Way", line2: "", city: "Lagos", region: "", postcode: "" });
  });

  it("needs a name, a callable phone, a street and a city", () => {
    expect(cleanAddress({ ...ok, name: "A" }, "GH").ok).toBe(false);
    expect(cleanAddress({ ...ok, phone: "call me" }, "GH").ok).toBe(false);
    expect(cleanAddress({ ...ok, phone: "+1 2" }, "GH").ok).toBe(false);
    expect(cleanAddress({ ...ok, line1: "" }, "GH").ok).toBe(false);
    expect(cleanAddress({ ...ok, city: " " }, "GH").ok).toBe(false);
  });

  it("asks for what each country's couriers need", () => {
    expect(cleanAddress(ok, "US").ok).toBe(false);
    expect(cleanAddress({ ...ok, region: "CA" }, "US").ok).toBe(false);
    expect(cleanAddress({ ...ok, region: "CA", postcode: "94105" }, "US").ok).toBe(true);
    expect(cleanAddress(ok, "NG").ok).toBe(false);
    expect(cleanAddress({ ...ok, region: "Lagos" }, "NG").ok).toBe(true);
  });
});
