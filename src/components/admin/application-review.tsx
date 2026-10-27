"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { documentLabel, type ReviewView } from "@/modules/merchants";
import { approveApplicationAction, rejectApplicationAction } from "@/server/actions/admin";

/** One application: the business, the payout wallet, the documents, and the decision. */
export function ApplicationReview({ application: a }: { application: ReviewView }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const b = a.business;

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "reject");
    setError(null);
    const r = approve ? await approveApplicationAction(a.id) : await rejectApplicationAction(a.id, note);
    setBusy(null);
    if (!r.ok) return setError(r.message);
    router.push("/admin/queues");
    router.refresh();
  }

  const rows: [string, string][] = b
    ? [
        ["Shop address", `/s/${b.handle}`],
        ["Kind", b.kind],
        ["Registered in", b.country],
        ["City", b.city],
        ["Address", b.address],
        ["Phone", b.phone],
        ["Website", b.website ?? "—"],
        ["Years in business", b.yearsInBusiness?.toString() ?? "—"],
        ["Payout wallet", a.payoutWallet ?? "—"],
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <section className="glass rounded-[26px] p-4">
        <h2 className="text-xl font-bold">{b?.name ?? "Unnamed business"}</h2>
        <p className="mt-1 text-sm whitespace-pre-line text-ink-2">{b?.description}</p>
        <dl className="mt-3">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line py-2 text-sm last:border-0">
              <dt className="text-ink-2">{k}</dt>
              <dd className="min-w-0 text-right font-semibold break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="glass rounded-[26px] p-4">
        <h2 className="mb-1 text-[17px] font-bold">Documents</h2>
        <p className="mb-3 text-xs text-ink-2">Links expire in 10 minutes. Check the name matches the business and the ID holder, and that nothing looks edited.</p>
        <ul className="grid grid-cols-2 gap-2.5">
          {a.documents.map((d) => (
            <li key={d.uploadedAt + d.kind} className="glass-inset overflow-hidden rounded-[18px]">
              <a href={d.url} target="_blank" rel="noreferrer" className="block">
                {d.contentType.startsWith("image/") ? (
                  <span className="relative block aspect-[4/3] bg-surface">
                    <Image src={d.url} alt={documentLabel(d.kind)} fill unoptimized sizes="300px" className="object-contain" />
                  </span>
                ) : (
                  <span className="grid aspect-[4/3] place-items-center bg-surface text-ink-2">
                    <Icon name="card" className="size-8" />
                  </span>
                )}
                <span className="block p-2 text-xs font-semibold capitalize">{documentLabel(d.kind)}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {a.status === "submitted" ? (
        <section className="glass flex flex-col gap-3 rounded-[26px] p-4">
          <button type="button" disabled={busy !== null} onClick={() => decide(true)} className="h-12 rounded-full bg-positive/90 text-[15px] font-bold text-black disabled:opacity-50">
            {busy === "approve" ? "Opening the shop…" : "Approve and open the shop"}
          </button>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Or send it back with a reason</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className="glass-inset rounded-2xl p-3 text-base outline-none" placeholder="The licence photo is blurry; upload a sharper one." />
          </label>
          <button type="button" disabled={busy !== null || note.trim().length < 10} onClick={() => decide(false)} className="h-11 rounded-full bg-like/15 text-sm font-bold text-like disabled:opacity-40">
            {busy === "reject" ? "Sending…" : "Not approved"}
          </button>
          {error && (
            <p role="alert" className="text-sm text-like">
              {error}
            </p>
          )}
        </section>
      ) : (
        <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">This application is {a.status}.</p>
      )}
    </div>
  );
}
