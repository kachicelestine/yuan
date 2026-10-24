import type { SellerId, SellerRepository } from "@/modules/catalog";
import type { ShopOpener } from "@/modules/merchants";
import { photo } from "@/lib/images";

/** A plain workshop photo until the seller sets their own cover. */
const DEFAULT_COVER = photo("1641959166364-6c9b9898e804", { ar: "16:9" });

/** Opens an approved applicant's shop in the catalog (merchants never write catalog tables). */
export class CatalogShops implements ShopOpener {
  constructor(private readonly sellers: SellerRepository) {}

  async exists(handle: string) {
    return (await this.sellers.findById(handle as SellerId)) !== null;
  }

  async open(shop: Parameters<ShopOpener["open"]>[0]) {
    await this.sellers.save({
      id: shop.handle as SellerId,
      name: shop.name,
      kind: shop.kind,
      city: shop.city,
      avatar: "/shop.svg",
      // Identity and business documents were checked by a reviewer.
      verified: true,
      audited: null,
      yearsInBusiness: shop.yearsInBusiness,
      storefront: {
        cover: DEFAULT_COVER,
        bio: shop.bio,
        followers: 0,
        rating: 0,
        responseHours: 24,
        onTimeRate: 1,
        certificates: [],
        capacity: null,
        staff: null,
        floorArea: null,
        exportsTo: [shop.country],
      },
    });
  }
}
