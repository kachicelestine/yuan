import { unitPrice, type ProductRepository } from "@/modules/catalog";
import type { CatalogLine, CatalogLineError, OrderCatalog } from "@/modules/ordering";
import { domainError, err, money, ok, type Result } from "@/shared/kernel";

/** Lets checkout price lines from the catalog (ordering never reads catalog tables itself). */
export class CatalogPricing implements OrderCatalog {
  constructor(private readonly products: ProductRepository) {}

  async priceLine(slug: string, option: string | null, qty: number): Promise<Result<CatalogLine, CatalogLineError>> {
    const p = await this.products.findBySlug(slug);
    if (!p) return err(domainError("unknown_product", `"${slug}" isn't for sale any more.`));
    if (p.price === null) return err(domainError("quote_only", `${p.title} is sold by quote; message the seller.`));

    // The bag stores picked values as "M · Ink", one label per option in order.
    const picked = option ? option.split(" · ") : [];
    if (picked.length && picked.length !== p.options.length) return err(domainError("unknown_option", `"${option}" isn't an option for ${p.title}.`));
    let delta = money.ZERO;
    for (const [i, o] of p.options.entries()) {
      const value = picked.length ? o.values.find((v) => v.label === picked[i]) : o.values[o.defaultIndex];
      if (!value) return err(domainError("unknown_option", `"${picked[i]}" isn't a ${o.name.toLowerCase()} for ${p.title}.`));
      delta = money.add(delta, value.delta);
    }

    return ok({
      productId: p.id,
      slug: p.slug,
      title: p.title,
      image: p.images[0],
      sellerId: p.sellerId,
      unitPrice: unitPrice(p, qty, delta),
      minOrder: p.minOrder,
      dutyRate: p.dutyRate,
      shipsFrom: p.shipsFrom,
    });
  }
}
