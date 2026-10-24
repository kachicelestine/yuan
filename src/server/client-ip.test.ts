import { describe, expect, it } from "vitest";
import { clientIpFrom } from "./client-ip";

const h = (values: Record<string, string>) => new Headers(values);

describe("clientIpFrom", () => {
  it("believes only the configured proxy's header", () => {
    const headers = h({ "cf-connecting-ip": "102.89.1.7", "x-forwarded-for": "6.6.6.6, 10.0.0.1" });
    expect(clientIpFrom(headers, "cloudflare")).toBe("102.89.1.7");
    expect(clientIpFrom(headers, "proxy")).toBe("6.6.6.6");
    expect(clientIpFrom(headers, "none")).toBe("unknown");
  });

  it("handles IPv6 and rejects anything that isn't an address", () => {
    expect(clientIpFrom(h({ "cf-connecting-ip": "2c0f:f4c0::1" }), "cloudflare")).toBe("2c0f:f4c0::1");
    expect(clientIpFrom(h({ "cf-connecting-ip": "1.2.3.4; drop table" }), "cloudflare")).toBe("unknown");
    expect(clientIpFrom(h({}), "cloudflare")).toBe("unknown");
  });
});
