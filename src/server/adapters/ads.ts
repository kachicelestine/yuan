import { createHmac, timingSafeEqual } from "node:crypto";
import type { AdBilling, AdProducts, TokenSigner } from "@/modules/ads";
import type { ProductRepository } from "@/modules/catalog";
import type { Escrow } from "@/modules/payments";
import type { Cents } from "@/shared/kernel";

/** Shops pay for clicks from their earnings balance in the ledger. */
export class EscrowAdBilling implements AdBilling {
  constructor(private readonly escrow: () => Escrow) {}

  async available(sellerIds: readonly string[]) {
    const entries = await Promise.all(sellerIds.map(async (id) => [id, await this.escrow().available(id)] as const));
    return new Map<string, Cents>(entries);
  }

  charge(sellerId: string, amount: Cents, reference: string) {
    return this.escrow().chargeAds({ sellerId, amount, reference });
  }
}

/** Only a shop's own live listings can be advertised. */
export class CatalogAdProducts implements AdProducts {
  constructor(private readonly products: ProductRepository) {}

  async live(sellerId: string, slugs: readonly string[]) {
    if (!slugs.length) return [];
    return (await this.products.findBySlugs(slugs)).filter((p) => p.sellerId === sellerId && p.status === "active").map((p) => p.slug);
  }
}

/** HMAC-SHA256 under a key derived from the app secret, for ad click tokens. */
export class HmacSigner implements TokenSigner {
  private readonly key: Buffer;

  constructor(secret: string, purpose: string) {
    this.key = createHmac("sha256", secret).update(`purpose:${purpose}`).digest();
  }

  sign(data: string) {
    return createHmac("sha256", this.key).update(data).digest("base64url");
  }

  verify(data: string, signature: string) {
    const want = Buffer.from(this.sign(data));
    const got = Buffer.from(signature);
    return want.length === got.length && timingSafeEqual(want, got);
  }
}
