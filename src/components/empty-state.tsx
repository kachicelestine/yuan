import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";

type Action = { href: string; label: string };

/**
 * The shared empty and error screen: a glowing glass badge, a plain-language line, and one
 * clear way forward. Pass `children` for suggestions under the actions.
 */
export function EmptyState({ icon, title, body, primary, secondary, tint = "from-accent/40 to-agent/30", children }: { icon: IconName; title: string; body: string; primary?: Action; secondary?: Action; tint?: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-5 py-12 text-center">
      <span className="relative mb-2 grid size-24 place-items-center">
        <span aria-hidden="true" className={`absolute inset-0 rounded-full bg-gradient-to-br blur-2xl motion-safe:animate-breathe ${tint}`} />
        <span className="glass relative grid size-20 place-items-center rounded-[28px]">
          <Icon name={icon} className="size-9" />
        </span>
      </span>
      <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-balance">{title}</h1>
      <p className="max-w-[34ch] text-[15px] leading-relaxed text-ink-2">{body}</p>
      {(primary || secondary) && (
        <div className="mt-3 flex w-full max-w-xs flex-col gap-2">
          {primary && (
            <Link href={primary.href} className="grid h-12 place-items-center rounded-full bg-accent text-[15px] font-bold">
              {primary.label}
            </Link>
          )}
          {secondary && (
            <Link href={secondary.href} className="glass-inset grid h-12 place-items-center rounded-full text-[15px] font-semibold">
              {secondary.label}
            </Link>
          )}
        </div>
      )}
      {children && <div className="mt-6 w-full">{children}</div>}
    </div>
  );
}
