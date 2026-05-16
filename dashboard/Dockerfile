# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /build

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies with frozen lockfile
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build
COPY . .
RUN pnpm build

# ── Stage 2: runtime (Caddy) ──────────────────────────────────────────────────
FROM caddy:2-alpine AS runtime

COPY --from=builder /build/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost/ || exit 1
