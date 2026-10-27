import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminFrame } from "@/components/admin/admin-frame";
import { CouponForm } from "@/components/coupons/coupon-form";
import { ManagedCoupons } from "@/components/coupons/managed-coupons";
import { SellSkeleton } from "@/components/sell/sell-frame";
import { endCouponAction, issueCouponAction } from "@/server/actions/admin";
import { adminContext } from "@/server/admin/page";

export const metadata: Metadata = { title: "Admin · Coupons", robots: { index: false } };

export default function CouponsAdminPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Coupons />
    </Suspense>
  );
}

async function Coupons() {
  const { app } = await adminContext();
  const list = await app.coupons.all();
  return (
    <AdminFrame title="Coupons" subtitle="Platform coupons anyone can claim, and every shop's vouchers.">
      <CouponForm scope="platform" action={issueCouponAction} />
      <ManagedCoupons list={list} end={endCouponAction} showShop />
    </AdminFrame>
  );
}
