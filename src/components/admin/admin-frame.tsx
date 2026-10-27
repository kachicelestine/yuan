import Form from "next/form";
import { SellFrame } from "@/components/sell/sell-frame";
import { AdminNav } from "./admin-nav";

/** Every admin page: a title, the section row, then the page. */
export function AdminFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <SellFrame title={title} subtitle={subtitle} back={title === "Admin" ? "/me" : "/admin"}>
      <AdminNav />
      {children}
    </SellFrame>
  );
}

/** A search box (and optional filter chips) that live in the URL, so results can be linked. */
export function AdminSearch({ action, q, placeholder, filters, filter }: { action: string; q: string; placeholder: string; filters?: readonly string[]; filter?: string }) {
  return (
    <Form action={action} className="mb-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="glass-inset h-11 min-w-0 flex-1 rounded-full px-4 text-sm outline-none placeholder:text-ink-3" />
        <button type="submit" className="h-11 shrink-0 rounded-full bg-white/15 px-4 text-sm font-semibold">
          Search
        </button>
      </div>
      {filters && (
        <div role="radiogroup" aria-label="Filter" className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <label key={f} className="cursor-pointer">
              <input type="radio" name="status" value={f} defaultChecked={f === filter} className="peer sr-only" />
              <span className="glass-inset block h-8 rounded-full px-3 text-xs leading-8 font-semibold text-ink-2 capitalize peer-checked:bg-white/15 peer-checked:text-ink peer-focus-visible:ring-2">{f}</span>
            </label>
          ))}
        </div>
      )}
    </Form>
  );
}

export function AdminEmpty({ children }: { children: React.ReactNode }) {
  return <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">{children}</p>;
}

/** A small status label. */
export function Pill({ tone = "plain", children }: { tone?: "plain" | "good" | "bad" | "warn"; children: React.ReactNode }) {
  const tones = { plain: "bg-white/10 text-ink-2", good: "bg-positive/15 text-positive", bad: "bg-like/15 text-like", warn: "bg-amber-400/15 text-amber-300" };
  return <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });
