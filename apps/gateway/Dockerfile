# syntax=docker/dockerfile:1.7
# Web gateway (React + Vite, spec F2-7a): hasil build statis disajikan Caddy kecil.
# Build context WAJIB root repo: docker build -f apps/gateway/Dockerfile .
FROM node:20-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/gateway/package.json apps/gateway/
RUN pnpm install --frozen-lockfile --filter="gateway..."
COPY apps/gateway apps/gateway
RUN pnpm --filter=gateway build

FROM caddy:2.8.4-alpine AS runner
COPY apps/gateway/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /repo/apps/gateway/dist /srv
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
