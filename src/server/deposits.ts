import "server-only";
import type { DepositMoney } from "@/modules/engagement";
import type { Services } from "./container";

/** Moves a deposit out of Protect (to the shop, or owed back to the buyer) and closes its order. */
export async function settleDepositMoney(app: Services, d: DepositMoney, how: "release" | "refund") {
  if (how === "release") await app.escrow.release({ orderId: d.depositOrderId, sellerId: d.sellerId, amount: d.amount });
  else await app.escrow.refund({ orderId: d.depositOrderId, sellerId: d.sellerId, amount: d.amount });
  await app.escrow.settle({ orderId: d.depositOrderId });
  await app.closeDeposit(d.depositOrderId);
}
