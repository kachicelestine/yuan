// `pnpm preview`: build, then serve the production build on this machine.
// A local preview isn't a real deployment, so like development it may use simulated
// payments and on-screen sign-in codes (DEMO_DEPLOYMENT) and a throwaway internal token.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const env = {
  ...process.env,
  DEMO_DEPLOYMENT: process.env.DEMO_DEPLOYMENT ?? "true",
  INTERNAL_TOKEN: process.env.INTERNAL_TOKEN ?? randomBytes(24).toString("hex"),
};

for (const args of [["build"], ["start", ...process.argv.slice(2)]]) {
  const r = spawnSync("next", args, { stdio: "inherit", shell: true, env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
