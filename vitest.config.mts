import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests read the same .env as the app (brand, payments mode); CI provides its own.
if (existsSync(".env")) process.loadEnvFile(".env");
// ...but never its database, storage, email or the site it belongs to: tests use in-memory
// Postgres and local files and call no running server, as in CI. A local .env can point at production.
for (const key of ["DATABASE_URL", "DATABASE_LISTEN_URL", "INTERNAL_TOKEN", "INTERNAL_URL", "STORAGE", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PRIVATE_BUCKET", "MEDIA_PUBLIC_URL", "RESEND_API_KEY", "EMAIL_FROM"]) delete process.env[key];

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside React Server Components; tests are server code.
      "server-only": fileURLToPath(new URL("./src/shared/testing/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests each boot in-memory Postgres and migrate it, several at once.
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
