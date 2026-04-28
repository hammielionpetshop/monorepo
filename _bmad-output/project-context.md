---
project_name: 'hammielion-monorepo'
user_name: 'Cundus'
date: '2026-04-27'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'style_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 21
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Core**: TypeScript ^5.0.0, Node.js ^20
- **Monorepo Management**: pnpm @9.0.0, Turbo
- **Frontend (Backoffice)**: Next.js 15.5.15, React 19.1.0, Tailwind CSS 4, Radix UI
- **Frontend (POS Desktop)**: React 18.2.0, Vite 5.1.6, Electron 30.0.1, React Router DOM 7 (HashRouter), Zustand, TanStack Query, Tailwind CSS 3.4.1
- **Database Layer**: PostgreSQL, Drizzle ORM, Drizzle Kit
- **Shared Packages**: @petshop/shared (pnpm workspace)

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

- **Strict Mode**: Wajib menggunakan mode ketat (`strict: true`). Definisi tipe data harus eksplisit; hindari penggunaan `any`.
- **Akurasi Angka & Desimal**:
  - **Kalkulasi**: Gunakan `big.js` untuk SEMUA kalkulasi finansial dan stok. Dilarang menggunakan tipe `number` bawaan JS untuk kalkulasi presisi.
  - **Penyimpanan**: Hasil kalkulasi WAJIB dikonversi menjadi `string` menggunakan `.toString()` sebelum disimpan ke database (Drizzle) pada kolom `decimal` atau `numeric`.
  - **Input**: Untuk input mentah (UI/API), pastikan dikonversi ke `string` sebelum masuk ke layer database.
- **Pola Penamaan & Ekspor**:
  - **Filenames**: Gunakan **kebab-case** secara konsisten (contoh: `transaction-service.ts`, `auth-store.ts`).
  - **Exports**: Gunakan **camelCase** untuk fungsi/metode dan **PascalCase** untuk kelas. Utamakan *named exports*.
- **Penanganan Error & Lokalisasi**:
  - **Bahasa**: Semua pesan kesalahan yang menghadap pengguna HARUS dalam **Bahasa Indonesia** (contoh: `throw new Error('Stok tidak mencukupi')`).
- **Async Patterns**: Gunakan `async/await` secara konsisten untuk semua operasi asynchronous.

### Framework-Specific Rules (Next.js & React)

- **Backoffice (Next.js 15)**:
  - Gunakan **App Router**. Manfaatkan **Server Components** secara default untuk fetching data.
  - Gunakan **Server Actions** untuk mutasi data (form submissions, dsb).
- **POS Desktop (React 18 + Electron)**:
  - **State Management**: Gunakan **Zustand** untuk state global aplikasi.
  - **Data Fetching**: Gunakan **TanStack Query** untuk sinkronisasi data dengan backend.
  - **Routing**: Wajib menggunakan **HashRouter** dari `react-router-dom`.
- **Shared Logic**: Semua logika bisnis yang digunakan bersama antara Backoffice dan POS WAJIB diletakkan di `@petshop/shared` untuk menjaga konsistensi.
- **UI Components**: Gunakan **Radix UI** sebagai primitif komponen dan **Tailwind CSS** untuk styling.

### Code Quality & Style Rules

- **Formatting**: Semua file wajib diformat menggunakan **Prettier** (`pnpm format`).
- **Linting**: Patuhi semua aturan **ESLint**. Hindari penggunaan `@ts-ignore`.
- **Naming Conventions**:
  - Variabel/Fungsi: `camelCase`. Kelas/Komponen React: `PascalCase`.
  - Konstanta Global: `UPPER_SNAKE_CASE`. Nama File: **kebab-case**.
- **Modularity**: Pecah komponen atau fungsi yang melebihi 200 baris menjadi modul yang lebih kecil.
- **Comments**: Fokus pada menjelaskan *mengapa* (konteks bisnis), bukan sekadar *apa* yang dilakukan kode.

### Development Workflow Rules

- **Package Management**: Gunakan **pnpm** secara eksklusif. Selalu gunakan `--filter` jika menjalankan perintah untuk aplikasi/package tertentu dari root.
- **Turbo Tasks**: Manfaatkan Turbo untuk menjalankan `dev`, `build`, dan `lint` secara paralel di seluruh monorepo.
- **Git Workflow**: Branch naming prefix `feat/`, `fix/`, `refactor/`. Gunakan *Conventional Commits*.
- **Environment**: Pastikan file `.env` dikonfigurasi dengan benar untuk masing-masing lingkungan (Backoffice vs POS).

### Critical Don't-Miss Rules (Anti-Patterns & Security)

- **Akurasi & Integritas Data**:
  - **Pessimistic Locking**: WAJIB menggunakan `.for('update')` dalam transaksi database saat membaca data stok/finansial yang akan diubah untuk mencegah *race condition*.
  - **No Native Math on DB Values**: Dilarang menggunakan operator matematika bawaan (`+`, `-`, dsb) langsung pada variabel angka dari database. Gunakan library `big.js`.
  - **Direct Stock Manipulation**: Dilarang memanipulasi stok langsung ke DB tanpa melalui `StockService`.
- **Keamanan**:
  - **Hardcoded Secrets**: Jangan menaruh API Key atau rahasia di dalam kode. Gunakan `.env`.
  - **Validation**: Gunakan **Zod** untuk validasi semua input dari API/Form sebelum diproses.
  - **Server-Side Logic**: Validasi harga dan diskon harus terjadi di layer Service/Server.
- **Error Handling**:
  - **No Silent Failures**: Blok `catch` dilarang kosong. Error harus dicatat atau diinformasikan ke pengguna.

---

## Usage Guidelines

**For AI Agents:**

- Baca file ini sebelum mengimplementasikan kode apa pun.
- Ikuti SEMUA aturan tepat seperti yang didokumentasikan.
- Jika ragu, pilih opsi yang lebih restriktif.
- Perbarui file ini jika muncul pola baru yang penting.

**For Humans:**

- Jaga agar file ini tetap ramping dan fokus pada kebutuhan agen.
- Perbarui saat tumpukan teknologi berubah.
- Tinjau secara berkala untuk menghapus aturan yang sudah menjadi usang.

Last Updated: 2026-04-27
