# Plan — Verifikasi Manual Matriks Otorisasi per Role (DoD RBAC R6)

**Tanggal:** 2026-07-13
**Status:** 🔴 **BELUM DIJALANKAN** — satu-satunya kriteria R6 yang masih terbuka
**Sumber:** [[2026-07-09-rbac-domain-migration]] M8 (`- [~]` manual test), M4 & M6 (kriteria uji manual)
**Scope:** `apps/backoffice` (runtime, bukan kode) + DB (`role_permissions`)

## Kenapa ini penting

R6 (M1–M8) mengganti seluruh gate `_ROLES` literal dengan `requirePermission(code)` + `scopeFilter`.
Ditutup oleh **203 unit test hijau + parity by-construction** — tapi unit test memakai payload JWT
**yang di-mock**. Yang belum pernah diuji: **rantai nyata** `login → DB role_permissions → JWT →
requirePermission`. Bila satu mata rantai putus (mis. kode permission belum ter-seed di DB), gejalanya
bukan test merah melainkan **403 di produksi untuk aksi yang seharusnya boleh**.

M4/M5/M7 juga **sengaja mengubah** siapa-boleh-apa (A1, A3, A4, dan penutupan celah `mark-transit` /
`cancel-remaining`). Perubahan otorisasi tanpa uji manual = kelas bug paling mahal.

---

## 🚨 P0 — Pre-flight: seed permission WAJIB dijalankan ulang ke DB

**Risiko konkret yang ditemukan saat audit 2026-07-13.** M6 menambahkan kode permission **baru**
`internal_transfer.approve` ke `packages/db/src/seed/permissions.ts`. Katalog seed kini **29 kode /
71 baris** `role_permissions` — sementara verifikasi terakhir yang tercatat di R2 (2026-07-08) adalah
**28 kode / 67 baris**, dan A1 menaikkannya ke 68.

`permissions` di JWT diisi saat **login** dari tabel `role_permissions`. Kalau seed belum dijalankan
ulang setelah M6, maka `internal_transfer.approve` **tidak ada di DB** → tak ada satu pun role yang
membawanya di token → **approve/batalkan Transfer Internal akan 403 untuk SEMUA role, termasuk OWNER.**

```bash
pnpm --filter @petshop/db db:seed-permissions   # idempotent, aman diulang
```

**Verifikasi setelah seed** (jumlah diturunkan dari katalog seed — hitung ulang, jangan percaya angka ini buta):

| Role | Ekspektasi jumlah permission |
|---|---|
| OWNER | 29 (semua) |
| GM | 26 (semua kecuali `return.cancel`, `user.manage`, `branch.manage`) |
| MANAGER | 11 |
| GUDANG | 2 (`internal_transfer.stock_check`, `.receive`) |
| FINANCE | 2 (`internal_transfer.receive`, `payable.pay`) |
| KASIR | 1 (`internal_transfer.receive`) |
| **Total baris `role_permissions`** | **71** |

```sql
SELECT r.name, COUNT(*) AS jml
FROM petshop.role_permissions rp
JOIN petshop.roles r ON r.id = rp.role_id
GROUP BY r.name ORDER BY jml DESC;

-- Pastikan kode baru M6 ada:
SELECT code FROM petshop.permissions WHERE code = 'internal_transfer.approve';
```

- [ ] Seed dijalankan; jumlah per role & total 71 cocok.
- [ ] `internal_transfer.approve` ada di tabel `permissions`.

> ⚠️ **Token lama.** `branchScope` & `permissions` disematkan di JWT saat login. Semua user yang
> tokennya terbit **sebelum** seed/R4 harus **login ulang**. Token lama tanpa `branchScope` diperlakukan
> `OWN` (fail-safe, lihat catatan M4) → OWNER/GM bisa tampak "kehilangan" akses lintas cabang sampai
> login ulang. **Selalu login ulang tiap akun sebelum menguji.**

---

## Persiapan

- [ ] 1 akun per role: OWNER, GM, MANAGER, KASIR, GUDANG, FINANCE.
- [ ] MANAGER/GUDANG/FINANCE/KASIR **tidak** di cabang yang sama dengan data uji lintas-cabang
      (perlu 2 cabang untuk menguji `scopeFilter`: cabang sendiri vs cabang lain).
- [ ] Semua akun **login ulang** setelah seed (lihat peringatan token lama).
- [ ] Catat hasil di kolom "Hasil" tabel di bawah; bila ✗ → buat item bug + hentikan rilis.

**Cara baca ekspektasi:** `200/201` = boleh, `403` = ditolak gate, `404`/kosong = tersaring scope
(bukan error). Bedakan **403 (gate)** dari **daftar kosong (scope)** — keduanya "tidak lihat", tapi
akar masalahnya beda.

---

## A. Sumbu CAPABILITY (gate) — yang boleh vs 403

| # | Aksi | OWNER | GM | MANAGER | KASIR | GUDANG | FINANCE | Hasil |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| A-1 | Master data: buat/ubah kategori, brand, supplier, UOM, metode bayar | ✅ | ✅ | 403 | 403 | 403 | 403 | |
| A-2 | **Buat/ubah produk** (A4 — DIKETATKAN, dulu semua role bisa) | ✅ | ✅ | **403** | **403** | **403** | **403** | |
| A-3 | Ubah harga / salin harga (`master.price.manage`) | ✅ | ✅ | 403 | 403 | 403 | 403 | |
| A-4 | **Stock adjustment** (A3 — DIKETATKAN, dulu tanpa gate) | ✅ | ✅ | ✅ | **403** | **403** | **403** | |
| A-5 | **Approve/reject Stock Opname** (A1 — GM DITAMBAH) | ✅ | **✅** | ✅ | 403 | 403 | 403 | |
| A-6 | Buat Stock Opname | ✅ | ✅ | ✅ | 403 | 403 | 403 | |
| A-7 | Buat/ubah PO (`po.manage`) | ✅ | ✅ | ✅ | 403 | 403 | 403 | |
| A-8 | Approve PO / approve penerimaan (`po.approve`) | ✅ | ✅ | 403 | 403 | 403 | 403 | |
| A-9 | **PO > Rp 5 jt** (eskalasi nilai, OWNER-only — di dalam `po.approve`) | ✅ | **403** | 403 | 403 | 403 | 403 | |
| A-10 | **`mark-transit` & `cancel-remaining` PO** (dulu TANPA auth sama sekali) | ✅ | ✅ | 403 | 403 | 403 | 403 | |
| A-11 | Ubah invoice PO (`po.financial`) | ✅ | ✅ | 403 | 403 | 403 | 403 | |
| A-12 | **Approve/batalkan IBT** (`internal_transfer.approve` — kode BARU M6) | ✅ | ✅ | ✅ | 403 | 403 | 403 | |
| A-13 | Cek stok & kirim IBT (`internal_transfer.stock_check`) | ✅ | ✅ | ✅ | 403 | ✅ | 403 | |
| A-14 | Terima IBT (`internal_transfer.receive`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| A-15 | **Buat IBT / lihat daftar IBT** (scope-only, TANPA gate — KASIR POS wajib bisa) | ✅ | ✅ | ✅ | **✅** | ✅ | ✅ | |
| A-16 | Bulk sale (`transaction.bulk_sale`) | ✅ | ✅ | ✅ | 403 | 403 | 403 | |
| A-17 | Approve/reject permintaan Void (`void.approve`) | ✅ | ✅ | 403 | 403 | 403 | 403 | |
| A-18 | **Batalkan retur** (A2 — OWNER-only, dipertahankan) | ✅ | **403** | 403 | 403 | 403 | 403 | |
| A-19 | Void pembayaran hutang (`debt.payment_void`) | ✅ | ✅ | 403 | 403 | 403 | 403 | |
| A-20 | Bayar hutang supplier/antar-cabang (`payable.pay`) | ✅ | ✅ | ✅ | 403 | 403 | ✅ | |
| A-21 | Waive hutang antar-cabang (`payable.waive`) | ✅ | ✅ | 403 | 403 | 403 | 403 | |
| A-22 | Kelola kategori kas (`cashflow.category.manage`) | ✅ | ✅ | ✅ | 403 | 403 | 403 | |
| A-23 | Kelola user (`user.manage`) | ✅ | 403 | 403 | 403 | 403 | 403 | |
| A-24 | Kelola cabang (`branch.manage`) | ✅ | 403 | 403 | 403 | 403 | 403 | |
| A-25 | Lihat shift lintas cabang (`shift.read`) | ✅ | ✅ | 403 | 403 | 403 | 403 | |

> **A-15 adalah tes regresi terpenting M6.** IBT create/list/detail sengaja **tanpa gate** (scope-only)
> supaya POS Internal Order (KASIR) tetap jalan. Bila KASIR kena 403 di sini → M6 salah, POS rusak.

---

## B. Sumbu SCOPE (cabang) — bukan 403, tapi data tersaring

Uji dengan **MANAGER/GUDANG/FINANCE cabang X**, data milik **cabang Y**.

| # | Aksi | Ekspektasi | Hasil |
|---|---|---|---|
| B-1 | OWNER/GM lihat transaksi/opname/PO | **semua cabang** (`branchScope='ALL'`) | |
| B-2 | MANAGER lihat riwayat Stock Opname | hanya cabang sendiri (bukan 403) | |
| B-3 | MANAGER lihat daftar transaksi & detail transaksi | hanya cabang sendiri; detail cabang lain → tak bisa | |
| B-4 | MANAGER buka `adjustment-logs` / `stock-logs` | hanya cabang sendiri | |
| B-5 | FINANCE buka **inter-branch payables** | tampil bila cabangnya **debitur ATAU kreditur** (`scopeFilterAny`) | |
| B-6 | FINANCE buka **supplier payables** | hanya cabang sendiri (single-column `branchScope`) | |
| B-7 | Non-global buka **Barang Rusak** | hanya cabang sendiri; OWNER/GM lihat semua (`damaged_goods.read_global`) | |
| B-8 | `nav-badges` (angka notifikasi sidebar) | non-global hanya menghitung cabang sendiri; **tak boleh 403** | |
| B-9 | IBT list untuk MANAGER | tampil bila cabangnya **sumber ATAU tujuan** (`scopeFilterAny`) | |

> **B-8 & A-15 satu keluarga:** `nav-badges` dan IBT list adalah **pembaca**. Kalau muncul 403,
> berarti scope keliru dipasang sebagai gate — bug otorisasi klasik yang M7 khusus diperingatkan.

---

## C. Alur end-to-end lintas cabang (M6)

- [ ] **C-1 Kirim→Terima IBT:** GUDANG (cabang sumber) cek stok → kirim; KASIR/GUDANG (cabang tujuan)
      terima. Stok berkurang di sumber, bertambah di tujuan.
- [ ] **C-2 IBT terkonversi bulk sale (G5):** IBT yang sudah dijual via bulk sale → `ship` **tidak**
      memotong stok gudang lagi (tak ada dobel-potong).
- [ ] **C-3 POS Internal Order (KASIR):** buat IBT dari POS → sukses (regresi A-15).

---

## D. Alur onboarding & landing (Inisiatif #2, sekalian diuji)

- [ ] **D-1** User baru (`mustChangeCredentials=true`) → dipaksa `/onboarding`, tak bisa ke halaman lain.
- [ ] **D-2** GUDANG/FINANCE login → mendarat di `/staff`, **tidak** bisa membuka `/dashboard`
      (omzet/laba global). Ini kebocoran data yang ditutup S7 — wajib dipastikan benar-benar tertutup.
- [ ] **D-3** KASIR login → `/pos`. OWNER/GM → `/dashboard`.

---

## Definition of Done

- [ ] Seed P0 dijalankan & terverifikasi (29 kode / 71 baris).
- [ ] Semua baris tabel A terisi & sesuai ekspektasi.
- [ ] Semua baris tabel B terisi & sesuai ekspektasi.
- [ ] C-1..C-3 dan D-1..D-3 lulus.
- [ ] Temuan (bila ada) → item bug + entri `CHANGELOG.md`.
- [ ] Centang `- [~]` M8 di [[2026-07-09-rbac-domain-migration]] → `- [x]`; hapus label
      "TODO uji manual sebelum rilis".

## Catatan

- Ini pekerjaan **runtime**, bukan koding — butuh backoffice berjalan + akun tiap role. Tidak bisa
  diselesaikan dari sesi agent tanpa lingkungan & kredensial.
- Bila tak sempat menguji seluruh matriks, **prioritaskan**: P0 (seed) → A-12 & A-15 (M6, paling
  berisiko merusak POS) → A-2/A-4 (perubahan perilaku A3/A4) → A-10 (celah yang baru ditutup) → D-2.
