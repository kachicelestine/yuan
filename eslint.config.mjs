import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Architecture boundaries (see ARCHITECTURE.md): dependencies point inward.
const frameworks = ["next", "next/*", "react", "react-*", "drizzle-orm", "drizzle-orm/*", "postgres", "@electric-sql/*", "zod"];
const restrict = (patterns, message) => ["error", { patterns: [{ group: patterns, message }] }];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    name: "architecture/domain",
    files: ["src/modules/*/domain/**", "src/shared/kernel/**"],
    rules: {
      "no-restricted-imports": restrict(
        [...frameworks, "@/modules/*/application/**", "@/modules/*/infrastructure/**", "@/shared/infrastructure/**", "@/server/**", "@/components/**", "@/app/**", "@/config/**"],
        "The domain is plain TypeScript: no frameworks, I/O or outer layers.",
      ),
    },
  },
  {
    name: "architecture/application",
    files: ["src/modules/*/application/**"],
    rules: {
      "no-restricted-imports": restrict(
        [...frameworks.filter((f) => f !== "zod"), "@/modules/*/infrastructure/**", "@/shared/infrastructure/**", "@/server/**", "@/components/**", "@/app/**"],
        "Use cases reach the outside world through ports, never adapters or UI.",
      ),
    },
  },
  {
    name: "architecture/presentation",
    files: ["src/app/**", "src/components/**", "src/lib/**"],
    rules: {
      "no-restricted-imports": restrict(
        ["@/modules/*/domain/**", "@/modules/*/application/**", "@/modules/*/infrastructure/**", "@/shared/infrastructure/**"],
        "UI talks to modules through their index (types and pure helpers) or through src/server.",
      ),
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".data/**",
    "drizzle/**",
    // Bundled ops scripts (pnpm build:ops).
    "dist/**",
  ]),
]);

export default eslintConfig;
