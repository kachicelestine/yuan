// The build command on Vercel: production deploys bring the database up to date first, so
// the new code never runs against tables it doesn't expect. Migrations only add to the
// schema. Previews share nothing with this and skip it.
import { spawnSync } from "node:child_process";

const run = (command: string) => {
  const r = spawnSync(command, { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (process.env.VERCEL_ENV === "production" && process.env.DATABASE_URL) run("pnpm db:migrate");
run("next build");
