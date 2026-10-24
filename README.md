# Lychee

Shoppable videos, live rooms and factory-direct prices on everything made in China, delivered to any country, paid in dollar stablecoins.

- **ARCHITECTURE.md**: how the code is organised and why (clean architecture, bounded contexts, the rules lint enforces).
- **ROADMAP.md**: what's built, what's next.

## Run it

Requirements: Node 24 and pnpm 12. No database setup is needed for development.

```bash
pnpm install
cp .env.example .env     # brand, database and payment settings
pnpm dev                 # http://localhost:3000
```

Sign in with any email. Without an email provider configured, the code is printed in the server log; set `AUTH_DEV_CODES=true` in `.env` to see it on screen instead. Wallet sign-in works with any browser wallet (MetaMask, Coinbase Wallet, Rabby) or a wallet app's built-in browser.

Without `DATABASE_URL`, `pnpm dev` runs an embedded Postgres in `.data/pglite`. It is migrated and seeded the first time it's used and kept between restarts; delete the folder to start over. Payments run in **simulated** mode: checkout opens a real invoice and the pay page has a "Simulate payment" button.

To use a Postgres server instead, set `DATABASE_URL` and run:

```bash
pnpm db:migrate          # apply migrations in drizzle/
pnpm db:seed             # load countries, exchange rates and the sample catalog
```

Run `pnpm db:migrate` again whenever a new migration lands in `drizzle/`. If the server is behind or empty, the app stops with an error naming the command to run.

## Scripts

| Command | What it does |
|---|---|
| `pnpm check` | Type-check, lint (including architecture boundaries) and run every test |
| `pnpm test` | Unit tests, plus integration tests against in-memory Postgres |
| `pnpm build` | Production build |
| `pnpm preview` | Production build, then serve it on port 3000: how the app really performs |
| `pnpm db:generate` | Generate a migration after changing a `schema.ts` |
| `pnpm db:migrate` / `pnpm db:seed` | Prepare a Postgres server |
| `pnpm db:studio` | Browse the database |
| `pnpm data:countries` | Rebuild the countries and exchange-rate seed from open datasets |

## Performance

`pnpm dev` compiles each page the first time it's opened and ships unminified React, so it is several times slower than the real app; judge speed with `pnpm preview`. The budget is a first paint and largest paint within 1 s on a mid-range phone on 4G, and the choices behind it are in ARCHITECTURE.md (decision 13).

On Windows, excluding the project folder from Microsoft Defender (or using a Dev Drive) makes `pnpm dev` noticeably faster.

## Research

[docs/research](docs/research/README.md) covers how today's social-commerce and marketplace leaders work, how they scaled, what's free to run on (and the catches), and a stage-by-stage plan from a $0 server to multi-region infrastructure.

## Configuration

Everything is in `.env` (see `.env.example`). The brand (`NEXT_PUBLIC_BRAND_NAME`, `_SEAL`, `_TAGLINE`) is read from there, so renaming the product is a one-line change. Invalid settings stop the app at startup with a message naming the variable.

## Taking real payments

Set `AUTH_SECRET`, `RESEND_API_KEY` and `EMAIL_FROM` (sign-in codes are emailed, never shown), then `PAYMENTS_MODE=onchain`, a Base treasury address (`PAYMENTS_BASE_ADDRESS`), `PAYMENTS_BASE_CHAIN` and an RPC URL. Start on `base-sepolia` with test USDC. Read the "Risks to settle before launch" section of ARCHITECTURE.md first: accepting crypto for goods has licensing and compliance requirements that vary by country.
