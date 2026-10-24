import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { brand } from "@/config/brand";
// Factory towns are editorial content, still in fixtures.
import { towns } from "@/lib/catalog";
import { plural } from "@/lib/format";
import { getCategories, getProducts, getSellers } from "@/server/catalog";

export const metadata: Metadata = { title: "Everything made in China" };

export default async function CategoriesPage() {
  const [categories, products, sellers] = await Promise.all([getCategories(), getProducts(), getSellers()]);
  const sellerById = new Map(sellers.map((s) => [s.id, s]));
  return (
    <div className="mx-auto max-w-[1200px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-start gap-3 pt-2 pb-5 lg:pt-0">
        <div className="flex-1">
          <h1 className="font-display text-[32px] leading-tight font-extrabold tracking-[-0.03em]">Everything made in China</h1>
          <p className="mt-1 text-sm text-ink-2">
            {categories.length} categories · {sellers.filter((s) => s.verified).length} verified sellers · {products.length} products
          </p>
        </div>
        <Link href="/search" aria-label="Search" className="glass grid size-12 shrink-0 place-items-center rounded-full lg:hidden">
          <Icon name="search" />
        </Link>
      </header>

      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c, i) => {
          const items = products.filter((p) => p.category === c.id);
          return (
            <li key={c.id}>
              <Link href={`/c/${c.id}`} data-tone="dark" className="group relative block aspect-[4/5] overflow-hidden rounded-[26px] bg-surface">
                <Image src={c.image} alt="" fill loading={i < 4 ? "eager" : undefined} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <span className="absolute inset-x-3 bottom-3">
                  <span className="block font-display text-lg leading-tight font-bold text-legible">{c.label}</span>
                  <span className="mt-0.5 block text-xs text-white/75">{plural(items.length, "product")}</span>
                  <span className="mt-2 flex -space-x-2">
                    {items.slice(0, 3).map((p) => (
                      <Image key={p.slug} src={p.images[0]} alt="" width={28} height={28} sizes="28px" className="size-7 rounded-full object-cover ring-2 ring-black/60" />
                    ))}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="towns-h" className="mt-10">
        <div className="mb-3">
          <h2 id="towns-h" className="font-display text-2xl font-bold tracking-[-0.02em]">
            Factory towns
          </h2>
          <p className="text-sm text-ink-2">Every Chinese town has a speciality. Shop straight from the one that makes it best.</p>
        </div>
        <ul className="no-scrollbar -mx-3.5 flex snap-x snap-mandatory scroll-px-3.5 gap-3 overflow-x-auto px-3.5 pb-1 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
          {towns.map((t) => (
            <li key={t.id} className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-auto">
              <Link href={`/search?q=${encodeURIComponent(t.name)}`} className="glass block overflow-hidden rounded-[26px]">
                <span className="relative block aspect-[16/10]">
                  <Image src={t.image} alt="" fill sizes="(min-width: 1024px) 33vw, 80vw" className="object-cover" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <span className="absolute bottom-3 left-3.5 text-legible">
                    <span className="block font-display text-xl font-bold">{t.name}</span>
                    <span className="block text-xs text-white/80">{t.province} · ships via {t.port}</span>
                  </span>
                </span>
                <span className="flex flex-col gap-2 p-3.5">
                  <span className="text-[15px] font-semibold">{t.speciality}</span>
                  <span className="text-[13px] leading-snug text-ink-2">{t.fact}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="flex -space-x-2">
                      {t.sellerIds.map((id) => {
                        const s = sellerById.get(id);
                        return s ? <Image key={id} src={s.avatar} alt="" width={26} height={26} sizes="26px" className="size-[26px] rounded-full object-cover ring-2 ring-surface" /> : null;
                      })}
                    </span>
                    <span className="text-xs text-ink-2">
                      {plural(t.sellerIds.length, "seller")} on {brand.name}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

