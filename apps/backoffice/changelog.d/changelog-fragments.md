### Added
- **CI baru memverifikasi setiap PR — sebelumnya tidak ada pemeriksaan otomatis sama sekali, hanya workflow deploy.** `.github/workflows/ci.yml` menjalankan typecheck, lint, test, validasi potongan changelog, dan cek keutuhan migrasi DB pada setiap pull request serta push ke `main`. Semua langkah dijalankan sampai habis walau ada yang gagal, jadi satu kali push langsung memperlihatkan seluruh masalahnya.
  - `pnpm changelog:check` dan `pnpm migrations:check` ikut jadi gate PR.
  - `pnpm migrations:check` (`scripts/check-migrations.mjs`) menolak `_journal.json` yang idx-nya bolong/ganda, nama file yang awalannya tidak cocok dengan idx, dan file `.sql` yang tidak terdaftar. Ini menangkap kasus dua branch paralel yang sama-sama membuat `0013_*` — kondisi yang selama ini lolos dari git merge dan baru meledak saat `db:migrate` di server.
  - `pnpm test` ditambahkan di root sebagai pintasan `turbo test`.
  - `typecheck` ditambahkan ke `backoffice` dan `order-web`. Sebelumnya `pnpm typecheck` hanya benar-benar memeriksa `pos-desktop` karena kedua app Next.js itu tidak punya script-nya.
  - `pnpm test` ditambahkan di root, dan `pnpm pos:check` sebagai satu-satunya cara memeriksa `pos-desktop`.

- **`pnpm worktree:new <branch>` menyiapkan satu worktree siap kerja dalam satu perintah**, dan `pnpm worktree:remove` membereskannya lagi. Ini yang membuat beberapa fitur bisa dikerjakan paralel di satu repo tanpa saling mengganggu.
  - Selain `git worktree add`, skrip menyalin `.env` root dan `.env.local` tiap app — ketiganya gitignored, jadi worktree baru lahir tanpa satu pun dan tidak bisa menjalankan apa-apa sebelum disalin.
  - `DATABASE_URL` di worktree baru **selalu** ditulis ulang ke Postgres lokal. `.env` root berisi URL produksi, dan menyalinnya apa adanya ke tempat beberapa orang/agent bekerja paralel adalah cara tercepat merusak data sungguhan.
  - Tiap worktree dapat database sendiri, `petshop_wt_<slug>` yang dibuat `TEMPLATE petshop_db` — isinya identik dengan DB lokal saat itu (terverifikasi: 1.092 produk, 7 cabang, 4 user), jadi bebas di-reset, di-seed, atau dimigrasi tanpa mengganggu worktree lain.
  - Port dipilih otomatis dari yang benar-benar kosong; 6969/7070 dicadangkan untuk worktree utama.
  - `worktree:remove` menolak menghapus kalau masih ada perubahan belum di-commit atau commit yang belum masuk `main` (`--force` untuk menimpa). Ia juga menghapus foldernya sendiri, karena `git worktree remove` selalu menolak folder berisi `node_modules`.
  - Di Windows ada palang panjang path: folder tujuan + nama berkas terpanjang repo ini harus < 260 karakter, dan skripnya menolak sebelum membuat apa pun. Tanpa palang ini `git worktree add` gagal di tengah checkout dan meninggalkan branch setengah jadi.

- **`docs/agents/claims.md`: papan klaim untuk kerja paralel.** Berisi kunci migrasi, tabel klaim aktif, peta domain, dan daftar berkas magnet. Aturan ringkasnya masuk `CLAUDE.md` dan `AGENTS.md`.
  - **Kunci migrasi:** hanya satu branch boleh menambah migrasi DB pada satu waktu. `pnpm migrations:check` menangkap tabrakan *sesudah* terjadi, dan membereskannya berarti menomori ulang migrasi yang mungkin sudah dijalankan orang lain di DB lokalnya — jauh lebih mahal daripada mencegahnya.
  - **Klaim di-commit ke `main` sebelum branch dibuat.** Klaim yang ditulis di branch sendiri baru terlihat saat di-merge, yaitu saat tabrakannya sudah terlanjur terjadi.
  - **Peta domain** memetakan 11 domain ke path UI, API, service, dan schema-nya masing-masing (seluruh path sudah dicek ada). Gunanya membagi pekerjaan secara vertikal — satu orang pegang UI + API + service satu domain. Pembagian mendatar ("semua API" vs "semua UI") dijamin bertabrakan di tiap berkas.
  - **Berkas magnet** dicatat beserta aturannya: `sidebar.tsx` (440 baris daftar menu), `packages/db/src/schema/*.ts`, `lib/authz.ts`, `lib/db.ts`, dan `CHANGELOG.md`. Di sinilah konflik paralel sebenarnya terjadi, bukan di kode domain masing-masing.

### Changed
- **Port app tidak lagi ditulis mati di `package.json`; sekarang dari `PORT`.** `scripts/next-with-port.mjs` menentukan port berurutan dari env `PORT` → `PORT=` di `.env.local` app → bawaan (6969 backoffice, 7070 order-web). Tanpa ini, worktree kedua yang menjalankan `pnpm dev:backoffice` langsung mati dengan `EADDRINUSE` — `next dev -p` tidak mencari port lain, ia berhenti.
  - Pembacaannya dilakukan di skrip, bukan diserahkan ke `.env.local`, karena Next menentukan port sebelum memuat berkas env-nya.

- **`apps/pos-desktop` resmi dibekukan: dikeluarkan dari `build`, `typecheck`, `lint`, dan `test`.** Script root sekarang menyaring `--filter=!petshop-pos`, jadi app Electron itu tidak lagi ikut CI maupun perintah verifikasi lokal mana pun. Kodenya tetap di repo dan `pnpm dev:pos` tetap jalan; `pnpm pos:check` untuk memeriksanya manual kalau suatu saat dihidupkan lagi.
  - Alasannya: aplikasi itu tidak lagi dikembangkan (pekerjaan POS ada di `apps/backoffice/app/pos/`) dan pemeriksaannya sudah merah sejak lama — ±8 error TypeScript dan 162 error ESLint. Mengikutkannya berarti setiap PR merah, dan CI yang selalu merah sama saja dengan tidak punya CI.
  - Efek sampingnya `pnpm test` turun dari ~30 detik jadi ~2 detik, karena beban terbesarnya adalah 67 test pos-desktop di lingkungan jsdom. Yang tersisa: 28 test `@petshop/shared`.

- **Changelog pindah ke potongan per-branch supaya beberapa pekerjaan paralel tidak lagi bertabrakan.** Selama ini setiap perubahan menyisipkan entry di baris paling atas `CHANGELOG.md`; dua branch yang berjalan bersamaan otomatis konflik di baris yang sama pada setiap merge. Sekarang setiap pekerjaan menulis satu file sendiri di `apps/backoffice/changelog.d/`, dan penggabungan hanya terjadi sekali saat rilis.
  - `pnpm changelog:release <versi|patch|minor|major>` menggabungkan semua potongan menjadi satu entry versi baru (section terurut Added → Changed → Fixed → Removed), lalu menghapus potongannya. `--dry-run` untuk mengintip hasil, `--keep` untuk tidak menghapus.
  - `pnpm changelog:check` memvalidasi format semua potongan tanpa mengubah apa pun.
  - Skrip menolak potongan yang memakai section di luar keempat nama itu, yang menulis heading versi sendiri, atau yang menaruh teks sebelum heading section — supaya salah tulis ketahuan saat itu juga, bukan hilang diam-diam waktu digabung.
  - Aturan wajib di `CLAUDE.md` dan hook `PostToolUse` di `.claude/settings.json` ikut diarahkan ke `changelog.d/`; format lengkapnya di `apps/backoffice/changelog.d/README.md`.

### Fixed
- **`public/**` dikeluarkan dari ESLint backoffice.** `public/qz-tray.js` adalah pustaka pihak ketiga yang di-vendor, dan satu-satunya *error* lint di seluruh app (`no-require-imports` di baris 737) berasal dari sana — bukan dari kode sendiri. Tanpa ini, lint backoffice selalu exit 1 dan CI tidak akan pernah hijau.
