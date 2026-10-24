import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests read the same .env as the app (brand, payments mode); CI provides its own.
if (existsSync(".env")) process.loadEnvFile(".env");

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
