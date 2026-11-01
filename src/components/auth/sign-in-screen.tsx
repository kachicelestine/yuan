"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import { brand } from "@/config/brand";
import { haptic } from "@/lib/feedback";
import { requestCodeAction, verifyCodeAction, walletChallengeAction, walletVerifyAction } from "@/server/actions/auth";

type Step = { kind: "email" } | { kind: "code"; email: string; challengeId: string; devCode: string | null };

/** An injected EIP-1193 wallet (MetaMask, Coinbase Wallet, Rabby, a wallet's in-app browser). */
type Ethereum = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

/** Email code or wallet signature. No passwords to leak or forget. */
export function SignInScreen({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const { refreshAccount } = useStore();

  /** Signed in: bring this device's bag and lists into the account, then carry on. */
  async function done() {
    haptic([12, 40, 24]);
    await refreshAccount();
    router.replace(next);
    router.refresh();
  }

  function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);
    start(async () => {
      const r = await requestCodeAction(email);
      if (!r.ok) return setError(r.message);
      setDigits(["", "", "", "", "", ""]);
      setStep({ kind: "code", email: email.trim().toLowerCase(), challengeId: r.challengeId, devCode: r.devCode });
      setTimeout(() => boxes.current[0]?.focus(), 50);
    });
  }

  function verify(code: string) {
    if (step.kind !== "code") return;
    setError(null);
    start(async () => {
      const r = await verifyCodeAction(step.challengeId, code);
      if (!r.ok) {
        setError(r.message);
        haptic([30, 60, 30]);
        setDigits(["", "", "", "", "", ""]);
        boxes.current[0]?.focus();
        return;
      }
      await done();
    });
  }

  function type(i: number, value: string) {
    const clean = value.replace(/\D/g, "");
    // Pasting or autofilling the whole code fills every box at once.
    if (clean.length > 1) {
      const all = clean.slice(0, 6).split("");
      const filled = [...all, ...Array(6 - all.length).fill("")];
      setDigits(filled);
      if (all.length === 6) verify(all.join(""));
      else boxes.current[all.length]?.focus();
      return;
    }
    const nextDigits = digits.map((d, j) => (j === i ? clean : d));
    setDigits(nextDigits);
    if (clean && i < 5) boxes.current[i + 1]?.focus();
    if (nextDigits.every(Boolean)) verify(nextDigits.join(""));
  }

  function signInWithWallet() {
    setError(null);
    const ethereum = (window as unknown as { ethereum?: Ethereum }).ethereum;
    if (!ethereum) {
      setError("No wallet found in this browser. Open this page in your wallet app's browser, or use email.");
      return;
    }
    start(async () => {
      try {
        const [address] = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
        const chainId = Number.parseInt((await ethereum.request({ method: "eth_chainId" })) as string, 16);
        const challenge = await walletChallengeAction(address, chainId);
        if (!challenge.ok) return setError(challenge.message);
        const signature = (await ethereum.request({ method: "personal_sign", params: [challenge.message, address] })) as string;
        const r = await walletVerifyAction(challenge.nonce, signature);
        if (!r.ok) return setError(r.message);
        await done();
      } catch (e) {
        // 4001 is the wallet's "user rejected".
        const rejected = (e as { code?: number }).code === 4001;
        setError(rejected ? "You cancelled in your wallet. Nothing was signed." : "Your wallet couldn't sign in. Try again, or use email.");
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-5 pt-safe pb-safe">
      <header className="flex items-center gap-3 py-3">
        <Link href={next} aria-label="Close" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="close" className="size-5" />
        </Link>
      </header>

      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <span className="seal grid size-14 place-items-center rounded-[18px] bg-accent text-2xl text-white shadow-[0_12px_40px_rgb(204_58_23/0.45)]">{brand.seal}</span>
        <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.03em]">{step.kind === "email" ? `Sign in to ${brand.name}` : "Check your email"}</h1>
        <p className="max-w-[32ch] text-[15px] text-ink-2">
          {step.kind === "email" ? (
            "Your orders, coins and coupons follow you to any device. No password needed."
          ) : (
            <>
              We sent a 6-digit code to <b className="text-ink">{step.email}</b>. It works once, for 10 minutes.
            </>
          )}
        </p>
      </div>

      {step.kind === "email" ? (
        <form onSubmit={sendCode} className="mt-8 flex flex-col gap-3">
          <label className="sr-only" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="glass-inset h-14 rounded-2xl px-4 text-[16px] outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-white/40"
          />
          <button type="submit" disabled={pending || !email} className="h-[52px] rounded-full bg-white text-[15px] font-bold text-black disabled:opacity-50">
            {pending ? "Sending…" : "Email me a code"}
          </button>

          <div className="my-2 flex items-center gap-3 text-xs text-ink-3">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>

          <button type="button" onClick={signInWithWallet} disabled={pending} className="glass-inset flex h-[52px] items-center justify-center gap-2.5 rounded-full text-[15px] font-semibold disabled:opacity-50">
            <Icon name="card" className="size-5" />
            Continue with a wallet
          </button>
          <p className="text-center text-xs text-ink-3">Signing proves you own the wallet. It doesn&apos;t move funds or cost a fee.</p>
        </form>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          <div role="group" aria-label="6-digit code" className="flex justify-center gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                value={d}
                onChange={(e) => type(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
                }}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${i + 1}`}
                maxLength={6}
                disabled={pending}
                className="glass-inset size-12 rounded-2xl text-center font-display text-2xl font-bold outline-none focus:ring-2 focus:ring-white/50 sm:size-14"
              />
            ))}
          </div>
          {step.devCode && (
            <p className="rounded-2xl bg-save/12 p-3 text-center text-[13px] text-save ring-1 ring-save/30">
              Development mode: your code is <b className="font-mono text-base tracking-[0.2em]">{step.devCode}</b>
            </p>
          )}
          {pending && <p className="text-center text-sm text-ink-2">Checking…</p>}
          <div className="flex justify-center gap-4 text-[13px] font-semibold">
            <button type="button" onClick={() => sendCode()} disabled={pending} className="text-ink-2 hover:text-ink">
              Send a new code
            </button>
            <button type="button" onClick={() => setStep({ kind: "email" })} className="text-ink-2 hover:text-ink">
              Use a different email
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-like/12 p-3 text-center text-[13px] text-like">
          {error}
        </p>
      )}

      <p className="mt-auto pt-10 pb-4 text-center text-[11px] text-ink-3">
        By continuing you agree to the{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        . We never sell your data.
      </p>
    </div>
  );
}
