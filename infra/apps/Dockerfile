# syntax=docker/dockerfile:1.7
#
# Satu Dockerfile untuk backoffice dan order-web. Pilih lewat:
#   docker build -f infra/apps/Dockerfile --build-arg APP_NAME=backoffice .
#
# Build context WAJIB root repo (titik di akhir), bukan folder app — Next di monorepo
# ini menelusuri berkas sampai ke packages/ lewat outputFileTracingRoot.

# Debian, bukan Alpine. argon2 adalah native module dan prebuild resminya glibc;
# di musl ia dipaksa kompilasi dari sumber (butuh toolchain) dan sering gagal.
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo


# --- Dependensi -------------------------------------------------------------
# Manifes disalin lebih dulu supaya layer install ter-cache selama dependensi
# tidak berubah.
#
# Hanya manifes yang benar-benar dibutuhkan yang disalin. Lockfile juga memuat
# importer apps/db-compare, apps/excel-tools, dan apps/pos-desktop — ketiganya
# sengaja ditinggal: dua yang pertama gitignored (tidak pernah ada di checkout CI)
# dan yang ketiga dibekukan. pnpm menerima importer yang hilang tanpa mengeluh,
# sama seperti yang sudah berjalan di .github/workflows/ci.yml.
FROM base AS deps
ARG APP_NAME
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backoffice/package.json apps/backoffice/
COPY apps/order-web/package.json apps/order-web/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
# `--filter=<app>...` memasang hanya graf dependensi app-nya.
RUN pnpm install --frozen-lockfile --filter="${APP_NAME}..."


# --- Build ------------------------------------------------------------------
FROM deps AS builder
ARG APP_NAME
COPY . .

# apps/*/lib/db.ts melempar error saat modul dimuat kalau DATABASE_URL kosong, dan
# `next build` mengimpor setiap route module. Nilai-nilai di bawah tidak pernah
# dipakai menyambung ke mana pun: seluruh route API `force-dynamic` dan setiap
# halaman yang membaca DB juga sudah dinyatakan dinamis, jadi tidak ada prerender
# yang menyentuh Postgres. Stage ini tidak ikut ke image akhir.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
ENV JWT_SECRET=build-only-secret-yang-tidak-pernah-dipakai-runtime
ENV JWT_REFRESH_SECRET=build-only-secret-yang-tidak-pernah-dipakai-runtime
ENV CUSTOMER_JWT_SECRET=build-only-secret-yang-tidak-pernah-dipakai-runtime

RUN pnpm --filter="${APP_NAME}" build

# order-web tidak punya public/; disamakan supaya COPY di stage runner tidak gagal.
RUN mkdir -p "apps/${APP_NAME}/public"


# --- Migrator ---------------------------------------------------------------
# Image sekali-jalan untuk menjalankan migrasi DB di dalam jaringan compose VPS.
#
# Kenapa ini perlu ada: sejak Postgres pindah ke dalam jaringan Docker VPS (sengaja
# tanpa `ports:`), tidak ada lagi tempat di mana `drizzle-kit migrate` bisa dijalankan
# terhadap produksi. Dari laptop DB-nya tidak terjangkau, dan image runtime di bawah
# hanya berisi keluaran standalone Next — tidak memuat drizzle-kit maupun berkas
# migrasinya. Repo juga tidak pernah dikirim ke VPS, hanya compose + Caddyfile.
#
# Stage ini SENGAJA ditaruh sebelum `runner`: target bawaan `docker build` adalah stage
# terakhir, dan build backoffice/order-web yang sudah ada memanggilnya tanpa `--target`.
# Menaruhnya di bawah akan diam-diam mengubah image yang mereka hasilkan.
#
# Hanya packages/ yang disalin, bukan seluruh repo: yang dibutuhkan cuma skema, berkas
# migrasi, dan drizzle.config.ts. Ikut menyalin apps/ hanya membuat layer ini berubah
# (dan build ulang) tiap kali ada perubahan UI yang tidak ada hubungannya dengan DB.
FROM base AS migrator
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
# drizzle-kit adalah devDependency @petshop/db, jadi install TIDAK boleh --prod.
RUN pnpm install --frozen-lockfile --filter="@petshop/db..."
COPY packages/db packages/db
COPY packages/shared packages/shared

WORKDIR /repo/packages/db

# drizzle.config.ts memuat ../../.env lewat dotenv. Berkas itu tidak pernah ikut ke
# image (dikecualikan .dockerignore) dan memang tidak boleh — dotenv mengabaikan berkas
# yang tidak ada, dan DATABASE_URL datang dari env container di compose. dotenv juga
# tidak pernah menimpa env yang sudah terisi, jadi urutannya aman.
CMD ["pnpm", "db:migrate"]


# --- Runtime ----------------------------------------------------------------
FROM node:20-bookworm-slim AS runner
ARG APP_NAME
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Bawaan Next adalah localhost, yang tidak terjangkau dari luar container.
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Titik mount volume upload, dibuat lebih dulu dengan pemilik yang benar. Docker
# menyalin kepemilikan folder ini ke volume bernama yang masih kosong; tanpa langkah
# ini volume baru jadi milik root sementara proses jalan sebagai nextjs, dan upload
# gagal EACCES — kegagalan yang baru terlihat saat ada yang benar-benar mengunggah.
RUN mkdir -p /data/uploads && chown nextjs:nodejs /data/uploads

WORKDIR /app

# Keluaran standalone di monorepo bersarang: server.js ada di apps/<app>/, dan
# .next/static serta public/ tidak ikut di dalamnya — harus disalin terpisah.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/${APP_NAME}/public ./apps/${APP_NAME}/public

WORKDIR /app/apps/${APP_NAME}

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
