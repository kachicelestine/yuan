"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import { SELLER_KINDS } from "@/modules/catalog";
import type { ApplicationView, BusinessDetails, DocumentKind } from "@/modules/merchants";
import { uploadFile } from "@/lib/upload";
import { attachDocumentAction, saveApplicationAction, startDocumentAction, submitApplicationAction } from "@/server/actions/sell";

const DOCUMENTS: { kind: DocumentKind; label: string; hint: string; required: boolean }[] = [
  { kind: "business_license", label: "Business licence", hint: "Registration certificate or licence, all four corners visible", required: true },
  { kind: "id_front", label: "ID of the owner (front)", hint: "Passport, national ID or driving licence", required: true },
  { kind: "id_back", label: "ID (back)", hint: "If your ID has a back", required: false },
  { kind: "selfie", label: "Selfie holding the ID", hint: "Helps us approve faster", required: false },
];
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

const empty: BusinessDetails = { name: "", handle: "", kind: "Factory", country: "", city: "", address: "", phone: "", website: null, yearsInBusiness: null, description: "" };

/** Apply to sell: business details, payout wallet, documents, then submit for review. */
export function ApplyForm({ application }: { application: ApplicationView | null }) {
  const id = useId();
  const router = useRouter();
  const { markets } = useStore();
  const [app, setApp] = useState(application);
  const [form, setForm] = useState<BusinessDetails>(application?.business ?? empty);
  const [wallet, setWallet] = useState(application?.payoutWallet ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const status = app?.status ?? "draft";
  const locked = status === "submitted" || status === "approved";
  const set = <K extends keyof BusinessDetails>(key: K, value: BusinessDetails[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setBusy("save");
    setMessage(null);
    const r = await saveApplicationAction(form, wallet || null);
    setBusy(null);
    if (!r.ok) {
      setMessage({ tone: "error", text: r.message });
      return false;
    }
    setApp(r.application);
    setMessage({ tone: "ok", text: "Saved." });
    return true;
  }

  async function upload(kind: DocumentKind, file: File | undefined) {
    if (!file) return;
    setMessage(null);
    // Documents attach to the application, so it needs saving once first.
    if (!app && !(await save())) return;
    setBusy(kind);
    const ticket = await startDocumentAction({ kind, contentType: file.type, bytes: file.size });
    if (!ticket.ok) {
      setBusy(null);
      return setMessage({ tone: "error", text: ticket.message });
    }
    try {
      await uploadFile(ticket.url, ticket.headers, file);
    } catch (error) {
      setBusy(null);
      return setMessage({ tone: "error", text: error instanceof Error ? error.message : "The upload didn't finish." });
    }
    const r = await attachDocumentAction({ kind, key: ticket.key });
    setBusy(null);
    if (!r.ok) return setMessage({ tone: "error", text: r.message });
    setApp(r.application);
  }

  async function submit() {
    if (!(await save())) return;
    setBusy("submit");
    const r = await submitApplicationAction();
    setBusy(null);
    if (!r.ok) return setMessage({ tone: "error", text: r.message });
    setApp(r.application);
    setMessage(null);
    router.refresh();
  }

  const input = "glass-inset h-12 w-full rounded-2xl px-4 text-base outline-none placeholder:text-ink-3 disabled:opacity-60";

  return (
    <div className="flex flex-col gap-5">
      {status === "submitted" && (
        <Banner icon="clock" tone="text-save">
          <b className="text-ink">We&apos;re reviewing your application.</b> Most are decided within two working days. We&apos;ll show the result here.
        </Banner>
      )}
      {status === "rejected" && app?.decisionNote && (
        <Banner icon="flag" tone="text-like">
          <b className="text-ink">Not approved yet.</b> {app.decisionNote} Fix it below and submit again.
        </Banner>
      )}

      <Section title="Your business">
        <Field label="Shop name">
          <input className={input} value={form.name} disabled={locked} onChange={(e) => set("name", e.target.value)} placeholder="Kente Looms" maxLength={60} />
        </Field>
        <Field label="Shop address" hint="Letters, numbers and hyphens. It can't be changed later.">
          <div className="glass-inset flex h-12 items-center rounded-2xl pl-4">
            <span className="text-ink-3">/s/</span>
            <input
              className="h-full min-w-0 flex-1 bg-transparent pr-4 text-base outline-none"
              value={form.handle}
              disabled={locked}
              onChange={(e) => set("handle", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="kente-looms"
              maxLength={30}
            />
          </div>
        </Field>
        <fieldset disabled={locked}>
          <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">What you are</legend>
          <div className="flex flex-wrap gap-2">
            {SELLER_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={form.kind === k}
                onClick={() => set("kind", k)}
                className={`h-10 rounded-full px-4 text-sm font-semibold ${form.kind === k ? "bg-white text-black" : "glass-inset text-ink-2"}`}
              >
                {k}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Country of registration">
            <select className={input} value={form.country} disabled={locked} onChange={(e) => set("country", e.target.value)}>
              <option value="">Choose…</option>
              {[...markets]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="City">
            <input className={input} value={form.city} disabled={locked} onChange={(e) => set("city", e.target.value)} maxLength={80} />
          </Field>
        </div>
        <Field label="Business address">
          <input className={input} value={form.address} disabled={locked} onChange={(e) => set("address", e.target.value)} maxLength={300} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone">
            <input className={input} value={form.phone} disabled={locked} inputMode="tel" onChange={(e) => set("phone", e.target.value)} placeholder="+233 24 000 0000" maxLength={20} />
          </Field>
          <Field label="Years in business">
            <input
              className={input}
              value={form.yearsInBusiness ?? ""}
              disabled={locked}
              inputMode="numeric"
              onChange={(e) => set("yearsInBusiness", e.target.value === "" ? null : Number(e.target.value.replace(/\D/g, "")))}
            />
          </Field>
        </div>
        <Field label="Website (optional)">
          <input className={input} value={form.website ?? ""} disabled={locked} onChange={(e) => set("website", e.target.value || null)} placeholder="https://" maxLength={200} />
        </Field>
        <Field label="What you make or sell" hint="This becomes your shop's bio.">
          <textarea
            className="glass-inset min-h-28 w-full rounded-2xl p-4 text-base outline-none placeholder:text-ink-3 disabled:opacity-60"
            value={form.description}
            disabled={locked}
            onChange={(e) => set("description", e.target.value)}
            maxLength={1000}
          />
        </Field>
      </Section>

      <Section title="Payouts">
        <Field label="USDC wallet on Base" hint="Sales are paid out in USDC to this address. Double-check it: payments can't be reversed.">
          <input className={`${input} font-mono text-sm`} value={wallet} disabled={locked} onChange={(e) => setWallet(e.target.value.trim())} placeholder="0x…" maxLength={42} spellCheck={false} />
        </Field>
      </Section>

      <Section title="Documents" hint="Only our review team sees these. They're stored privately and never shown on your shop.">
        <ul className="flex flex-col gap-2">
          {DOCUMENTS.map((d) => {
            const have = app?.documents.find((x) => x.kind === d.kind);
            return (
              <li key={d.kind} className="glass-inset flex items-center gap-3 rounded-[18px] p-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-full ${have ? "bg-positive/15 text-positive" : "bg-white/10 text-ink-2"}`}>
                  <Icon name={have ? "check" : "card"} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {d.label}
                    {!d.required && <span className="font-normal text-ink-3"> · optional</span>}
                  </span>
                  <span className="block text-xs text-ink-2">{have ? `Uploaded · ${Math.ceil(have.bytes / 1024)} KB` : d.hint}</span>
                </span>
                {!locked && (
                  <label className={`h-9 shrink-0 cursor-pointer rounded-full px-4 text-[13px] leading-9 font-bold ${have ? "glass-inset" : "bg-white text-black"}`}>
                    {busy === d.kind ? "Uploading…" : have ? "Replace" : "Upload"}
                    <input type="file" accept={ACCEPT} className="sr-only" disabled={busy !== null} onChange={(e) => upload(d.kind, e.target.files?.[0])} aria-label={`Upload ${d.label}`} />
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-like" : "text-positive"}`}>
          {message.text}
        </p>
      )}
      {!locked && (
        <div id={`${id}-actions`} className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={submit} disabled={busy !== null} className="h-[52px] flex-1 rounded-full bg-accent text-[15px] font-bold disabled:opacity-50">
            {busy === "submit" ? "Submitting…" : "Submit for review"}
          </button>
          <button type="button" onClick={save} disabled={busy !== null} className="glass-inset h-[52px] rounded-full px-6 text-[15px] font-semibold disabled:opacity-50">
            {busy === "save" ? "Saving…" : "Save for later"}
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="glass flex flex-col gap-3.5 rounded-[26px] p-4">
      <div>
        <h2 className="text-[17px] font-bold">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-2">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

function Banner({ icon, tone, children }: { icon: "clock" | "flag"; tone: string; children: React.ReactNode }) {
  return (
    <p className="glass-inset flex items-start gap-3 rounded-[22px] p-4 text-sm text-ink-2">
      <Icon name={icon} className={`mt-0.5 size-5 shrink-0 ${tone}`} />
      <span>{children}</span>
    </p>
  );
}
