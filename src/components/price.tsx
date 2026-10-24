"use client";

import { useCallback } from "react";
import { useStore } from "@/components/providers";
import { formatMoney, niceAmount } from "@/lib/format";

/**
 * Formats USD amounts in the shopper's currency, set by their ship-to market. `nice` rounds
 * to a printable local amount, for coupons and other fixed offers.
 */
export function useMoney() {
  const { market } = useStore();
  return useCallback(
    (usd: number, opts?: { nice?: boolean }) => {
      const local = usd * market.rate;
      return formatMoney(opts?.nice ? niceAmount(local) : local, market.currency);
    },
    [market],
  );
}

/** A price for server components, which can't read the shopper's market themselves. */
export function Price({ usd, className }: { usd: number; className?: string }) {
  const money = useMoney();
  return <span className={className}>{money(usd)}</span>;
}

