import Link from "next/link";
import { Icon } from "@/components/icon";
import { brand } from "@/config/brand";

export const LEGAL_UPDATED = "1 November 2026";

const LINKS = [
  ["/terms", "Terms"],
  ["/privacy", "Privacy"],
  ["/returns", "Returns"],
  ["/help", "Help"],
] as const;

/** The quiet row of policy links under sign-in, Me and checkout. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Policies and help" className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-3 ${className}`}>
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className="underline decoration-white/20 underline-offset-2">
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** How to reach a person: the support address when one is set, otherwise the in-app route. */
export function ContactLine() {
  return brand.supportEmail ? (
    <>
      Email <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.
    </>
  ) : (
    <>Open your order to message the shop or report a problem.</>
  );
}

/** A policy page: readable width, plain headings, nothing else on screen. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-[680px] px-4 pt-safe pb-32">
      <header className="flex h-[60px] items-center gap-3">
        <Link href="/me" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <h1 className="font-display text-[26px] font-extrabold tracking-[-0.025em]">{title}</h1>
      </header>
      <p className="mt-1 text-xs text-ink-3">Last updated {LEGAL_UPDATED}</p>
      <div className="mt-5 flex flex-col gap-3 text-[15px] leading-relaxed text-ink-2 [&_a]:text-ink [&_a]:underline [&_a]:decoration-white/30 [&_a]:underline-offset-2 [&_b]:font-semibold [&_b]:text-ink [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-[18px] [&_h2]:font-bold [&_h2]:text-ink [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">{children}</div>
      <LegalLinks className="mt-10" />
    </article>
  );
}
