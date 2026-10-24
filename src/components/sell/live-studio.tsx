"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useLiveStream } from "@/components/live/use-live-stream";
import type { ListingView } from "@/modules/catalog";
import type { LotView, MessageView, StudioView } from "@/modules/live";
import { addLotAction, endShowAction, pinItemAction, pinQuestionAction, sayAction, startShowAction } from "@/server/actions/live";
import { publishWhip } from "./whip";

type Props = { show: StudioView; messages: MessageView[]; lots: LotView[]; listings: Pick<ListingView, "slug" | "title" | "images" | "price">[] };

/** The host's control room: camera, going live, what's on air, the pinned answer, lots and chat. */
export function LiveStudio({ show: initialShow, messages, lots, listings }: Props) {
  const router = useRouter();
  const money = useMoney();
  const live = useLiveStream({ show: initialShow, messages, lots });
  const show = { ...initialShow, ...live.show };
  const preview = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const [broadcast, setBroadcast] = useState<{ stop: () => Promise<void> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(show.pinned?.q ?? "");
  const [a, setA] = useState(show.pinned?.a ?? "");
  const [lot, setLot] = useState({ slug: show.items[0]?.slug ?? "", startPrice: "20", increment: "1", minutes: "2" });
  const titles = new Map(listings.map((l) => [l.slug, l]));

  useEffect(() => {
    if (preview.current) preview.current.srcObject = camera;
  }, [camera]);
  useEffect(() => () => camera?.getTracks().forEach((t) => t.stop()), [camera]);
  useEffect(() => () => void broadcast?.stop(), [broadcast]);

  async function run(key: string, work: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setBusy(key);
    setError(null);
    const r = await work();
    setBusy(null);
    if (!r.ok) setError(r.message);
    else router.refresh();
    return r.ok;
  }

  async function startCamera() {
    setError(null);
    try {
      setCamera(await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } }, audio: true }));
    } catch {
      setError("Allow the camera and microphone to broadcast.");
    }
  }

  async function startBroadcast() {
    if (!camera || !show.ingestUrl) return;
    setBusy("broadcast");
    setError(null);
    try {
      setBroadcast(await publishWhip(show.ingestUrl, camera));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach the media server.");
    }
    setBusy(null);
  }

  async function stopBroadcast() {
    await broadcast?.stop();
    setBroadcast(null);
  }

  async function say(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const text = new FormData(form).get("text")?.toString().trim();
    if (!text) return;
    const r = await sayAction(show.id, text);
    if (!r.ok) return setError(r.message);
    live.addMessage(r.message);
    form.reset();
  }

  const openLot = live.lots.find((l) => l.status === "open");
  const input = "glass-inset h-11 min-w-0 rounded-2xl px-3 text-base outline-none";

  return (
    <div className="flex flex-col gap-4">
      <section className="glass flex flex-col gap-3 rounded-[26px] p-4">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tracking-[0.06em] ${show.status === "live" ? "bg-live text-white" : "bg-white/10 text-ink-2"}`}>
            {show.status === "live" ? "LIVE" : show.status === "ended" ? "ENDED" : "NOT LIVE YET"}
          </span>
          <span className="text-xs text-ink-2">{live.viewers === null ? "" : `${live.viewers} watching`}</span>
          <Link href={`/live/${show.id}`} target="_blank" className="ml-auto text-xs font-semibold text-agent">
            Open as a viewer
          </Link>
        </div>

        <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-[22px] bg-black">
          {camera ? <video ref={preview} autoPlay muted playsInline className="size-full -scale-x-100 object-cover" /> : <Image src={show.coverUrl} alt="" fill sizes="260px" className="object-cover opacity-60" />}
          {broadcast && <span className="absolute top-2 left-2 rounded-full bg-live px-2 py-0.5 text-[10px] font-extrabold">ON AIR</span>}
        </div>

        {show.ingestUrl ? (
          <div className="flex gap-2">
            {!camera ? (
              <button type="button" onClick={startCamera} className="h-11 flex-1 rounded-full bg-white text-sm font-bold text-black">
                Turn on camera
              </button>
            ) : !broadcast ? (
              <button type="button" disabled={busy !== null} onClick={startBroadcast} className="h-11 flex-1 rounded-full bg-white text-sm font-bold text-black disabled:opacity-50">
                {busy === "broadcast" ? "Connecting…" : "Start broadcasting"}
              </button>
            ) : (
              <button type="button" onClick={stopBroadcast} className="glass-inset h-11 flex-1 rounded-full text-sm font-semibold">
                Stop broadcasting
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-ink-2">Video isn&apos;t set up on this server, so viewers see your cover photo. Chat, products and bids still work live.</p>
        )}

        <div className="flex gap-2">
          {show.status !== "live" && show.status !== "ended" && (
            <button type="button" disabled={busy !== null} onClick={() => run("start", () => startShowAction(show.id))} className="h-12 flex-1 rounded-full bg-accent text-[15px] font-bold disabled:opacity-50">
              {busy === "start" ? "Going live…" : "Go live"}
            </button>
          )}
          {show.status === "live" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                await stopBroadcast();
                await run("end", () => endShowAction(show.id));
              }}
              className="h-12 flex-1 rounded-full bg-like/20 text-[15px] font-bold text-like disabled:opacity-50"
            >
              End the show
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-like">
            {error}
          </p>
        )}
      </section>

      <section className="glass rounded-[26px] p-4">
        <h2 className="mb-2 text-[15px] font-bold">On air</h2>
        <ul className="flex flex-col gap-2">
          {show.items.map((i) => {
            const l = titles.get(i.slug);
            return (
              <li key={i.slug} className="flex items-center gap-3">
                {l && <Image src={l.images[0]} alt="" width={40} height={40} sizes="40px" className="size-10 rounded-xl object-cover" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{l?.title ?? i.slug}</span>
                  <span className="text-xs text-ink-2">{i.livePrice !== null ? `Live price ${money(i.livePrice)}` : "Regular price"}</span>
                </span>
                {i.status === "on-air" ? (
                  <span className="rounded-full bg-accent/25 px-2.5 py-1 text-[11px] font-bold text-accent-light">ON AIR</span>
                ) : (
                  <button type="button" disabled={busy !== null || show.status === "ended"} onClick={() => run(`pin:${i.slug}`, () => pinItemAction(show.id, i.slug))} className="glass-inset h-9 rounded-full px-3 text-xs font-semibold disabled:opacity-50">
                    Show now
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="glass flex flex-col gap-2 rounded-[26px] p-4">
        <h2 className="text-[15px] font-bold">Pinned answer</h2>
        <input className={input} value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} placeholder="Does it ship to Ghana?" aria-label="Pinned question" />
        <input className={input} value={a} onChange={(e) => setA(e.target.value)} maxLength={300} placeholder="Yes, 6 to 9 days, duties paid at checkout." aria-label="Your answer" />
        <button type="button" disabled={busy !== null} onClick={() => run("pinq", () => pinQuestionAction(show.id, q, a))} className="glass-inset h-10 self-start rounded-full px-4 text-sm font-semibold">
          Pin it
        </button>
      </section>

      {show.kind === "auction" && (
        <section className="glass flex flex-col gap-2 rounded-[26px] p-4">
          <h2 className="text-[15px] font-bold">Lots</h2>
          {openLot && (
            <p className="rounded-2xl bg-white/[0.07] p-3 text-sm">
              {titles.get(openLot.slug)?.title}: {openLot.topBid ? `top bid ${money(openLot.topBid.amount)} by ${openLot.topBid.name}` : "no bids yet"} · {openLot.bids} bids
            </p>
          )}
          <select className={input} value={lot.slug} onChange={(e) => setLot({ ...lot, slug: e.target.value })} aria-label="Product for the lot">
            {show.items.map((i) => (
              <option key={i.slug} value={i.slug}>
                {titles.get(i.slug)?.title ?? i.slug}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-xs text-ink-2">
              Start ($)
              <input className={input} inputMode="decimal" value={lot.startPrice} onChange={(e) => setLot({ ...lot, startPrice: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-2">
              Step ($)
              <input className={input} inputMode="decimal" value={lot.increment} onChange={(e) => setLot({ ...lot, increment: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-2">
              Minutes
              <input className={input} inputMode="decimal" value={lot.minutes} onChange={(e) => setLot({ ...lot, minutes: e.target.value })} />
            </label>
          </div>
          <button
            type="button"
            disabled={busy !== null || !!openLot || show.status !== "live"}
            onClick={() => run("lot", () => addLotAction(show.id, { slug: lot.slug, startPrice: Number(lot.startPrice), increment: Number(lot.increment), minutes: Number(lot.minutes) }))}
            className="h-11 rounded-full bg-accent text-sm font-bold disabled:opacity-40"
          >
            {openLot ? "A lot is open" : show.status !== "live" ? "Go live to open lots" : "Open the lot"}
          </button>
        </section>
      )}

      <section className="glass flex flex-col gap-2 rounded-[26px] p-4">
        <h2 className="text-[15px] font-bold">Chat</h2>
        <ul aria-live="polite" className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {live.messages.map((m) => (
            <li key={m.id} className="text-sm">
              <b className={m.host ? "text-accent-light" : "text-[#FFE1A8]"}>{m.name}</b> {m.text}
            </li>
          ))}
        </ul>
        <form onSubmit={say} className="flex gap-2">
          <input name="text" className={`${input} flex-1`} maxLength={200} placeholder="Reply to everyone" aria-label="Message" />
          <button type="submit" aria-label="Send" className="grid size-11 place-items-center rounded-full bg-accent">
            <Icon name="send" className="size-5" />
          </button>
        </form>
      </section>
    </div>
  );
}
