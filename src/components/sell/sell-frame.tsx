import Link from "next/link";
import { Icon } from "@/components/icon";

/** Page chrome for seller screens: a back link and a title, nothing else competing. */
export function SellFrame({ title, back = "/me", subtitle, children }: { title: string; back?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[860px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href={back} aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-[-0.03em]">{title}</h1>
          {subtitle && <p className="text-xs text-ink-2">{subtitle}</p>}
        </div>
      </header>
      {children}
    </div>
  );
}

export function SellSkeleton() {
  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-3 px-3.5 pt-safe lg:px-6 lg:pt-6">
      <div className="skeleton mt-2 h-11 w-48 rounded-2xl" />
      <div className="skeleton h-20 rounded-[24px]" />
      <div className="skeleton h-11 rounded-full" />
      <div className="skeleton h-64 rounded-[24px]" />
    </div>
  );
}
