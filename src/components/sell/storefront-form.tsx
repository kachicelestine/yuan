"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import type { SellerView, StorefrontView } from "@/modules/catalog";
import { uploadFile } from "@/lib/upload";
import { startPhotoAction, updateStorefrontAction } from "@/server/actions/shop";

const list = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);

/** The shop page: cover, logo, bio and the facts buyers check before ordering. */
export function StorefrontForm({ seller, storefront }: { seller: SellerView; storefront: StorefrontView | null }) {
  const router = useRouter();
  const [bio, setBio] = useState(storefront?.bio ?? "");
  const [cover, setCover] = useState(storefront?.cover ?? "");
  const [avatar, setAvatar] = useState(seller.avatar);
  const [certificates, setCertificates] = useState(storefront?.certificates.join(", ") ?? "");
  const [capacity, setCapacity] = useState(storefront?.capacity ?? "");
  const [staff, setStaff] = useState(storefront?.staff?.toString() ?? "");
  const [floorArea, setFloorArea] = useState(storefront?.floorArea ?? "");
  const [exportsTo, setExportsTo] = useState(storefront?.exportsTo.join(", ") ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  async function photo(which: "cover" | "avatar", file: File | undefined) {
    if (!file) return;
    setBusy(which);
    setMessage(null);
    const t = await startPhotoAction("shops", { contentType: file.type, bytes: file.size });
    if (!t.ok) {
      setBusy(null);
      return setMessage({ tone: "error", text: t.message });
    }
    try {
      await uploadFile(t.url, t.headers, file);
      (which === "cover" ? setCover : setAvatar)(t.photo);
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "The upload didn't finish." });
    }
    setBusy(null);
  }

  async function save() {
    setBusy("save");
    setMessage(null);
    const r = await updateStorefrontAction({
      bio,
      cover: cover || null,
      avatar: avatar || null,
      certificates: list(certificates),
      capacity: capacity || null,
      staff: staff ? Number(staff.replace(/\D/g, "")) : null,
      floorArea: floorArea || null,
      exportsTo: list(exportsTo),
    });
    setBusy(null);
    if (!r.ok) return setMessage({ tone: "error", text: r.message });
    setMessage({ tone: "ok", text: "Saved. Your shop page shows it within a minute." });
    router.refresh();
  }

  const input = "glass-inset h-12 w-full rounded-2xl px-4 text-base outline-none placeholder:text-ink-3";

  return (
    <section aria-label="Shop" className="glass flex flex-col gap-3.5 rounded-[26px] p-4">
      <div className="relative">
        <label className="relative block aspect-[16/7] cursor-pointer overflow-hidden rounded-2xl bg-surface">
          {cover && <Image src={cover} alt="" fill sizes="(min-width: 900px) 860px, 100vw" className="object-cover" />}
          <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold">{busy === "cover" ? "Uploading…" : "Change cover"}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => photo("cover", e.target.files?.[0])} />
        </label>
        <label className="absolute -bottom-6 left-3 block size-16 cursor-pointer overflow-hidden rounded-2xl ring-4 ring-canvas">
          <Image src={avatar} alt="Shop logo" fill sizes="64px" className="object-cover" />
          <span className="absolute inset-x-0 bottom-0 grid h-5 place-items-center bg-black/60">
            <Icon name="camera" className="size-3" />
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => photo("avatar", e.target.files?.[0])} aria-label="Change logo" />
        </label>
      </div>
      <label className="mt-6 flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-2">Bio</span>
        <textarea className="glass-inset min-h-24 rounded-2xl p-4 text-base outline-none" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-2">Certificates (comma-separated)</span>
        <input className={input} value={certificates} onChange={(e) => setCertificates(e.target.value)} placeholder="CE, ISO 9001" />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Capacity</span>
          <input className={input} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="5,000 a month" />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Staff</span>
          <input className={input} value={staff} inputMode="numeric" onChange={(e) => setStaff(e.target.value)} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Floor area</span>
          <input className={input} value={floorArea} onChange={(e) => setFloorArea(e.target.value)} placeholder="2,000 m²" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-2">Countries you already ship to (codes)</span>
        <input className={input} value={exportsTo} onChange={(e) => setExportsTo(e.target.value.toUpperCase())} placeholder="NG, GH, KE" />
      </label>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-like" : "text-positive"}`}>
          {message.text}
        </p>
      )}
      <button type="button" onClick={save} disabled={busy !== null} className="h-12 rounded-full bg-accent text-[15px] font-bold disabled:opacity-50">
        {busy === "save" ? "Saving…" : "Save shop page"}
      </button>
    </section>
  );
}
