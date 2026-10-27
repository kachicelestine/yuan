import { domainError, err, ok, type Result } from "@/shared/kernel";
import type { ProductRepository, SellerRepository } from "../domain/repositories";
import type { SellerId } from "../domain/seller";
import { isLocked } from "../domain/product";

type AdminError = ReturnType<typeof domainError<"not_found" | "invalid_note" | "not_allowed">>;

const note = (n: string) => n.trim().length >= 5 && n.length <= 500;

/** What admins can do to the catalog: take listings down, suspend shops, and undo both. */
export function makeCatalogAdmin({ products, sellers }: { products: ProductRepository; sellers: SellerRepository }) {
  return {
    /** Takes a listing down; the seller sees why and can't put it back up. */
    async removeListing(productId: string, reason: string): Promise<Result<{ slug: string; sellerId: string }, AdminError>> {
      if (!note(reason)) return err(domainError("invalid_note", "Say why in a sentence: the seller sees it."));
      const p = await products.findById(productId);
      if (!p) return err(domainError("not_found", "No such listing."));
      if (p.status === "suspended") return err(domainError("not_allowed", "The shop is suspended; restore the shop first."));
      await products.save({ ...p, status: "removed", moderationNote: reason.trim() });
      return ok({ slug: p.slug, sellerId: p.sellerId });
    },

    /** Puts a removed listing back up. */
    async restoreListing(productId: string): Promise<Result<{ slug: string; sellerId: string }, AdminError>> {
      const p = await products.findById(productId);
      if (!p) return err(domainError("not_found", "No such listing."));
      if (p.status !== "removed") return err(domainError("not_allowed", "Only a removed listing can be restored."));
      await products.save({ ...p, status: "active", moderationNote: null });
      return ok({ slug: p.slug, sellerId: p.sellerId });
    },

    /** Hides a shop: its page, its live listings, and its seller tools. */
    async suspendShop(sellerId: string, reason: string, at: Date): Promise<Result<{ listings: number }, AdminError>> {
      if (!note(reason)) return err(domainError("invalid_note", "Say why in a sentence: the shop sees it."));
      const s = await sellers.findById(sellerId as SellerId);
      if (!s) return err(domainError("not_found", "No such shop."));
      await sellers.setSuspension(sellerId, at, reason.trim());
      return ok({ listings: await products.setStatusForSeller(sellerId, "active", "suspended") });
    },

    async restoreShop(sellerId: string): Promise<Result<{ listings: number }, AdminError>> {
      const s = await sellers.findById(sellerId as SellerId);
      if (!s) return err(domainError("not_found", "No such shop."));
      await sellers.setSuspension(sellerId, null, null);
      return ok({ listings: await products.setStatusForSeller(sellerId, "suspended", "active") });
    },

    /** Turns a shop's verified badge on or off. */
    async setVerified(sellerId: string, verified: boolean): Promise<Result<true, AdminError>> {
      const s = await sellers.findById(sellerId as SellerId);
      if (!s) return err(domainError("not_found", "No such shop."));
      await sellers.save({ ...s, verified });
      return ok(true);
    },

    isLocked,
  };
}

export type CatalogAdmin = ReturnType<typeof makeCatalogAdmin>;
