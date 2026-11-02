import { available, unitPrice, type OptionValue, type ProductRepository } from "@/modules/catalog";
import { shippingGrams } from "@/modules/delivery";
import type { CatalogLine, CatalogLineError, OrderCatalog } from "@/modules/ordering";
import { domainError, err, money, ok, type Result } from "@/shared/kernel";

/** Lets checkout price lines from the catalog (ordering never reads catalog tables itself). */
export class CatalogPricing implements OrderCatalog {
  constructor(private readonly products: ProductRepository) {}

  async priceLine(slug: string, option: string | null, qty: number): Promise<Result<CatalogLine, CatalogLineError>> {
    const p = await this.products.findBySlug(slug);
    if (!p) return err(domainError("unknown_product", `"${slug}" isn't for sale any more.`));

    // The bag stores picked values as "M · Ink", one label per option in order.
    const picked = option ? option.split(" · ") : [];
    if (picked.length && picked.length !== p.options.length) return err(domainError("unknown_option", `"${option}" isn't an option for ${p.title}.`));
    let delta = money.ZERO;
    const values: OptionValue[] = [];
    for (const [i, o] of p.options.entries()) {
      const value = picked.length ? o.values.find((v) => v.label === picked[i]) : o.values[o.defaultIndex];
      if (!value) return err(domainError("unknown_option", `"${picked[i]}" isn't a ${o.name.toLowerCase()} for ${p.title}.`));
      delta = money.add(delta, value.delta);
      values.push(value);
    }
    // Stock is checked here for a clear message; checkout takes it in the order's transaction.
    const left = available(p, values);
    if (left !== null && qty > left) {
      const soldOutValue = values.find((v) => v.soldOut);
      return err(domainError("out_of_stock", soldOutValue ? `${p.title} in ${soldOutValue.label} is sold out.` : left === 0 ? `${p.title} is sold out.` : `Only ${left} left of ${p.title}.`));
    }

    return ok({
      productId: p.id,
      slug: p.slug,
      title: p.title,
      image: p.images[0],
      sellerId: p.sellerId,
      unitPrice: p.price === null ? null : unitPrice(p, qty, delta),
      minOrder: p.minOrder,
      dutyRate: p.dutyRate,
      shipsFrom: p.shipsFrom,
      grams: shippingGrams({ category: p.categoryId, specs: p.specs }),
      category: p.categoryId,
    });
  }
}
