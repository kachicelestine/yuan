// Bundles the operational entry points (migrate, seed, worker) into single files for the
// production image, so it needs no TypeScript tooling and no full node_modules.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

await build({
  entryPoints: { migrate: "scripts/db/migrate.mts", seed: "scripts/db/seed.mts", worker: "scripts/worker.mts" },
  outdir: "dist/ops",
  outExtension: { ".js": ".mjs" },
  absWorkingDir: root,
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  // Lazy imports stay lazy in separate chunks: the embedded-Postgres code path (dev only)
  // must not load in production just because the same module also talks to a server.
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  // Some dependencies still call require(); give ESM output one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  // Outside React Server Components the real package throws; these scripts are server code.
  alias: { "server-only": "./src/shared/testing/empty.ts" },
  // Embedded Postgres is development-only (WebAssembly files); production uses DATABASE_URL.
  external: ["@electric-sql/pglite", "@electric-sql/pglite/*", "sharp"],
  logLevel: "info",
});
