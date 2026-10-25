"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import type { GiftSummary } from "@/modules/ordering";
import { senderGiftAddressAction } from "@/server/actions/gifts";

const FIELDS = [
  ["name", "Their full name"],
  ["phone", "Their phone"],
  ["line1", "Street and number"],
  ["line2", "Apartment or landmark (optional)"],
  ["city", "City"],
] as const;

/** The sender's gift order: the private link to send, whether it's been opened, and a fallback to add the address. */
export function GiftPanel({ gift, paid }: { gift: GiftSummary; paid: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [address, setAddress] = useState({ name: gift.recipientName, phone: "", line1: "", line2: "", city: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const link = () => `${window.location.origin}/gift/${gift.token}`;

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: `A gift for ${gift.recipientName}`, text: `${gift.recipientName}, I sent you something. Open it here:`, url: link() });
      else {
        await navigator.clipboard.writeText(link());
        setCopied(true);
      }
    } catch {
      // Share dismissed or clipboard blocked.
    }
  }

  const who = gift.claimedBy === "sender" ? "You added" : `${gift.recipientName} added`;
  const status = !paid
    ? "Pay for it first; then send them the link."
    : gift.claimed
      ? `${who} the address${gift.choice ? ` and picked ${gift.choice}` : ""}. The shop ships it next.${gift.thanks ? ` They said ${gift.thanks}` : ""}`
      : `Send ${gift.recipientName} this private link. They open it${gift.chooseOption ? `, pick their ${gift.chooseOption.toLowerCase()}` : ""} and add their address.`;

  return (
    <section aria-label="Gift" className="glass mt-5 rounded-[26px] p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-like/15 text-like">
          <Icon name="gift" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold">A gift for {gift.recipientName}</h2>
          <p className="text-[13px] text-ink-2">{status}</p>
        </div>
      </div>
      {paid && !gift.claimed && (
        <>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={share} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-accent text-sm font-bold">
              <Icon name={copied ? "check" : "share"} className="size-4" />
              {copied ? "Link copied" : "Send the link"}
            </button>
            <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className="glass-inset h-11 rounded-full px-4 text-[13px] font-semibold">
              I know the address
            </button>
          </div>
          {adding && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                start(async () => {
                  const r = await senderGiftAddressAction(gift.orderId, address);
                  if (!r.ok) return setError(r.message);
                  router.refresh();
                });
              }}
              className="mt-3 grid gap-2 sm:grid-cols-2"
            >
              {FIELDS.map(([key, label]) => (
                <input key={key} aria-label={label} placeholder={label} required={key !== "line2"} value={address[key]} onChange={(e) => setAddress({ ...address, [key]: e.target.value })} className="glass-inset h-11 rounded-2xl px-3.5 text-[15px] outline-none placeholder:text-ink-3" />
              ))}
              {error && (
                <p role="alert" className="text-[13px] text-like sm:col-span-2">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className="h-11 rounded-full bg-white text-sm font-bold text-black disabled:opacity-50 sm:col-span-2">
                {busy ? "Saving…" : "Ship it there"}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
