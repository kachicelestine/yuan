# syntax=docker/dockerfile:1.7
# Production image: the standalone Next.js server plus bundled ops scripts (migrate, seed,
# worker). Builds for whatever platform runs the build (arm64 on Oracle's Ampere servers).

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Public values are compiled into the browser bundle, so they're build arguments.
ARG NEXT_PUBLIC_BRAND_NAME NEXT_PUBLIC_BRAND_SEAL NEXT_PUBLIC_BRAND_TAGLINE NEXT_PUBLIC_SITE_URL
ARG NEXT_DEPLOYMENT_ID
ENV NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME NEXT_PUBLIC_BRAND_SEAL=$NEXT_PUBLIC_BRAND_SEAL \
    NEXT_PUBLIC_BRAND_TAGLINE=$NEXT_PUBLIC_BRAND_TAGLINE NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID NEXT_OUTPUT=standalone
# The Server Actions key must be the same for every build that serves the same users;
# it comes in as a build secret so it never lands in an image layer's history.
RUN --mount=type=secret,id=actions_key,required=false \
    if [ -s /run/secrets/actions_key ]; then export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/actions_key)"; fi && \
    pnpm build && pnpm build:ops

FROM node:24-bookworm-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
# ffmpeg encodes uploaded videos (the background jobs run in this image).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/dist/ops ./ops
# Writable caches and local media (both persist on volumes in compose).
RUN mkdir -p .next/cache/photos .data/media && chown -R node:node .next/cache .data
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
