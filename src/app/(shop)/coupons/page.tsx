import type { Metadata } from "next";
import { CouponWallet } from "@/components/rewards/coupon-wallet";

export const metadata: Metadata = { title: "Coupons" };

export default function CouponsPage() {
  return <CouponWallet />;
}
