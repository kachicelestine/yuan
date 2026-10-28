"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { inviteStaffAction, leaveShopAction, removeMemberAction, revokeInviteAction } from "@/server/actions/team";

export type TeamMember = { accountId: string; role: "owner" | "staff"; since: string; name: string; handle: string; avatar: string; you: boolean };
export type TeamInvite = { id: string; email: string; createdAt: string };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** The people who run the shop. The owner adds and removes staff; staff can leave. */
export function TeamManager({ members, invites, owner }: { members: TeamMember[]; invites: TeamInvite[]; owner: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const run = (work: () => Promise<{ ok: true } | { ok: false; message: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await work();
      if (!r.ok) return setError(r.message);
      after?.();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
        {members.map((m) => (
          <li key={m.accountId} className="flex items-center gap-3 px-4 py-3">
            {m.avatar ? (
              <Image src={m.avatar} alt="" width={40} height={40} sizes="40px" className="size-10 shrink-0 rounded-full object-cover" />
            ) : (
              <span aria-hidden="true" className="glass-inset grid size-10 shrink-0 place-items-center rounded-full font-display font-extrabold uppercase">
                {m.name.slice(0, 1)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {m.name}
                {m.you && <span className="font-normal text-ink-2"> (you)</span>}
              </span>
              <span className="block truncate text-xs text-ink-2">
                @{m.handle} · {m.role === "owner" ? "Owner" : "Staff"} since {day(m.since)}
              </span>
            </span>
            {m.role === "staff" &&
              (owner && !m.you ? (
                confirm === m.accountId ? (
                  <button type="button" disabled={busy} onClick={() => run(() => removeMemberAction(m.accountId), () => setConfirm(null))} className="h-8 rounded-full bg-like/15 px-3 text-xs font-bold text-like">
                    Remove?
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirm(m.accountId)} className="h-8 rounded-full bg-white/10 px-3 text-xs font-bold text-ink-2">
                    Remove
                  </button>
                )
              ) : (
                m.you && (
                  <button type="button" disabled={busy} onClick={() => run(leaveShopAction, () => router.push("/sell"))} className="h-8 rounded-full bg-white/10 px-3 text-xs font-bold text-ink-2">
                    Leave
                  </button>
                )
              ))}
          </li>
        ))}
      </ul>

      {owner && (
        <section aria-labelledby="invite-h" className="glass flex flex-col gap-3 rounded-[24px] p-4">
          <h2 id="invite-h" className="text-[15px] font-bold">
            Add someone
          </h2>
          <p className="-mt-2 text-xs text-ink-2">They sign in with this email and accept. Staff can edit listings, ship orders and answer shoppers; money, payouts and promotions stay with you.</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const to = email.trim();
              if (to) run(() => inviteStaffAction(to), () => {
                setSent(to);
                setEmail("");
              });
            }}
          >
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" aria-label="Their email" autoComplete="off" className="glass-inset h-11 min-w-0 flex-1 rounded-full px-4 text-sm outline-none placeholder:text-ink-3" />
            <button type="submit" disabled={busy || !email.trim()} className="h-11 shrink-0 rounded-full bg-accent px-4 text-sm font-bold text-white disabled:opacity-50">
              Invite
            </button>
          </form>
          {sent && <p className="text-xs text-positive">Invitation sent to {sent}.</p>}
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-like">
          {error}
        </p>
      )}

      {invites.length > 0 && (
        <section aria-labelledby="pending-h">
          <h2 id="pending-h" className="mb-2 px-1 text-[11px] font-bold tracking-[0.08em] text-ink-3">
            WAITING TO ACCEPT
          </h2>
          <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                <Icon name="send" className="size-5 shrink-0 text-ink-2" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{i.email}</span>
                  <span className="block text-xs text-ink-2">Invited {day(i.createdAt)}</span>
                </span>
                {owner && (
                  <button type="button" disabled={busy} onClick={() => run(() => revokeInviteAction(i.id))} className="h-8 rounded-full bg-white/10 px-3 text-xs font-bold text-ink-2">
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
