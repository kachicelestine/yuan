import { privateKeyToAccount } from "viem/accounts";
import { beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { unitOfWork } from "@/shared/infrastructure/unit-of-work";
import { newId, type Clock } from "@/shared/kernel";
import { makeIdentity, type Identity } from "../application/sign-in";
import { NodeSecrets, ViemVerifier } from "./adapters";
import { DrizzleAccountRepository, DrizzleChallengeRepository, DrizzleSessionRepository } from "./drizzle-identity-repositories";

describe("identity on Postgres", () => {
  let db: Database;
  let now = new Date("2026-10-24T10:00:00Z");
  const clock: Clock = { now: () => now };
  const sent: { to: string; code: string }[] = [];

  const identity = (revealCodes = false): Identity => {
    const repos = (tx: Database) => ({ accounts: new DrizzleAccountRepository(tx), challenges: new DrizzleChallengeRepository(tx), sessions: new DrizzleSessionRepository(tx) });
    return makeIdentity({
      ...repos(db),
      uow: unitOfWork(db, repos),
      secrets: new NodeSecrets("test-secret-test-secret-test-secret-123"),
      mailer: { sendSignInCode: async (to, code) => void sent.push({ to, code }) },
      verifier: new ViemVerifier(),
      clock,
      newId: () => newId(),
      revealCodes,
    });
  };

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
  });

  it("emails a code, signs in with it, and keeps the session", async () => {
    const id = identity();
    const r = await id.requestEmailCode("Ada@Example.com");
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.devCode).toBeNull();
    const mail = sent.at(-1)!;
    expect(mail.to).toBe("ada@example.com");
    expect(mail.code).toMatch(/^\d{6}$/);

    const signedIn = await id.verifyEmailCode(r.value.challengeId, mail.code);
    if (!signedIn.ok) throw new Error(signedIn.error.message);
    expect(signedIn.value.account.email).toBe("ada@example.com");

    const current = await id.currentAccount(signedIn.value.token);
    expect(current?.account.id).toBe(signedIn.value.account.id);

    // The same email signs into the same account next time.
    const again = await id.requestEmailCode("ada@example.com");
    if (!again.ok) throw new Error("again");
    const second = await id.verifyEmailCode(again.value.challengeId, sent.at(-1)!.code);
    expect(second.ok && second.value.account.id).toBe(signedIn.value.account.id);

    await id.signOut(signedIn.value.token);
    expect(await id.currentAccount(signedIn.value.token)).toBeNull();
  });

  it("signs a suspended account out everywhere and keeps it out until the suspension is lifted", async () => {
    const id = identity(true);
    const signIn = async () => {
      const r = await id.requestEmailCode("grace@example.com");
      if (!r.ok) throw new Error(r.error.message);
      return id.verifyEmailCode(r.value.challengeId, r.value.devCode!);
    };
    const first = await signIn();
    if (!first.ok) throw new Error(first.error.message);
    const accountId = first.value.account.id;

    expect(await id.setSuspended(accountId, "x")).toMatchObject({ ok: false, error: { code: "invalid_reason" } });
    expect(await id.setSuspended(newId(), "Selling counterfeit goods.")).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect((await id.setSuspended(accountId, "Selling counterfeit goods.")).ok).toBe(true);
    expect(await id.currentAccount(first.value.token)).toBeNull();
    expect(await signIn()).toMatchObject({ ok: false, error: { code: "suspended" } });

    expect((await id.setSuspended(accountId, null)).ok).toBe(true);
    const back = await signIn();
    expect(back.ok && back.value.account.id).toBe(accountId);
  });

  it("refuses wrong codes, reused codes and floods", async () => {
    const id = identity(true);
    const r = await id.requestEmailCode("flood@example.com");
    if (!r.ok) throw new Error("request");
    const wrong = r.value.devCode === "000000" ? "111111" : "000000";
    expect(await id.verifyEmailCode(r.value.challengeId, wrong)).toMatchObject({ ok: false, error: { code: "wrong_code" } });
    expect((await id.verifyEmailCode(r.value.challengeId, r.value.devCode!)).ok).toBe(true);
    expect(await id.verifyEmailCode(r.value.challengeId, r.value.devCode!)).toMatchObject({ ok: false, error: { code: "code_used" } });

    for (let i = 0; i < 4; i++) await id.requestEmailCode("flood@example.com");
    expect(await id.requestEmailCode("flood@example.com")).toMatchObject({ ok: false, error: { code: "rate_limited" } });
  });

  it("signs in with a wallet signature over the issued message", async () => {
    const id = identity();
    const wallet = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
    const start = await id.startWalletSignIn({ address: wallet.address, domain: "lychee.example", uri: "https://lychee.example", chainId: 8453, appName: "Lychee" });
    if (!start.ok) throw new Error(start.error.message);

    const signature = await wallet.signMessage({ message: start.value.message });
    const signedIn = await id.completeWalletSignIn(start.value.nonce, signature);
    if (!signedIn.ok) throw new Error(signedIn.error.message);
    expect(signedIn.value.account.wallet).toBe(wallet.address);

    // A replayed signature is refused.
    expect(await id.completeWalletSignIn(start.value.nonce, signature)).toMatchObject({ ok: false, error: { code: "challenge_used" } });
  });

  it("refuses a signature from a different wallet", async () => {
    const id = identity();
    const claimed = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
    const attacker = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
    const start = await id.startWalletSignIn({ address: claimed.address, domain: "lychee.example", uri: "https://lychee.example", chainId: 8453, appName: "Lychee" });
    if (!start.ok) throw new Error("start");
    const forged = await attacker.signMessage({ message: start.value.message });
    expect(await id.completeWalletSignIn(start.value.nonce, forged)).toMatchObject({ ok: false, error: { code: "bad_signature" } });
  });

  it("ends sessions after 30 idle days", async () => {
    const id = identity(true);
    const r = await id.requestEmailCode("idle@example.com");
    if (!r.ok) throw new Error("request");
    const s = await id.verifyEmailCode(r.value.challengeId, r.value.devCode!);
    if (!s.ok) throw new Error("verify");
    now = new Date(now.getTime() + 31 * 86_400_000);
    expect(await id.currentAccount(s.value.token)).toBeNull();
  });
});
