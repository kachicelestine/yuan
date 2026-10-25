import type { CommissionRepository } from "@/modules/affiliates";
import type { ProductRepository } from "@/modules/catalog";
import type { ReviewRepository } from "@/modules/content/domain/repositories";
import type { ActivitySource, ChopRepository, ListRepository, PollRepository } from "@/modules/engagement";
import type { AccountRepository } from "@/modules/identity/domain/repositories";
import type { LotRepository } from "@/modules/live";
import type { OrderRepository } from "@/modules/ordering";

/** Rewards see what someone has done, read from each context that knows (none reads another's tables). */
export class AppActivity implements ActivitySource {
  constructor(
    private readonly r: {
      orders: OrderRepository;
      products: ProductRepository;
      reviews: ReviewRepository;
      lists: ListRepository;
      polls: PollRepository;
      chops: ChopRepository;
      lots: LotRepository;
      commissions: CommissionRepository;
      accounts: AccountRepository;
    },
  ) {}

  async of(accountId: string) {
    const r = this.r;
    const [orders, reviews, saved, polls, chops, auctionsWon, commissions, account] = await Promise.all([
      r.orders.listByBuyer(accountId, 500),
      r.reviews.countByAuthor(accountId),
      r.lists.get(accountId, "saved"),
      r.polls.byAuthor(accountId, 50),
      r.chops.forOwner(accountId, 50),
      r.lots.wonBy(accountId),
      r.commissions.forCreator(accountId, 500),
      r.accounts.findById(accountId),
    ]);
    const paid = orders.filter((o) => o.status === "paid" || o.status === "completed");
    const slugs = [...new Set(paid.flatMap((o) => o.lines.map((l) => l.slug)))];
    const categories = slugs.length ? [...new Set((await r.products.findBySlugs(slugs)).map((p) => p.categoryId))] : [];
    return {
      joinedAt: account?.createdAt ?? null,
      orders: paid.length,
      countries: new Set(paid.map((o) => o.country)).size,
      categories,
      reviews,
      saved: saved.length,
      polls: polls.length,
      chops: chops.filter((c) => c.status === "done" || c.status === "used").length,
      auctionsWon,
      referredOrders: new Set(commissions.filter((c) => c.status !== "void").map((c) => c.orderId)).size,
      commissionsEarned: commissions.filter((c) => c.status === "earned").length,
    };
  }
}
