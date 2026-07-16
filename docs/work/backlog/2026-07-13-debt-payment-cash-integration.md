# Backlog — Pelunasan Piutang Masuk Kas & Rekonsiliasi Shift

**Tanggal:** 2026-07-13 (TODO asli ditunda sejak 2026-07-03 atas permintaan Owner)
**Scope:** `apps/backoffice` (`api/bo/customers/[id]/debts/**`, cash-flow, shift settlement) + `packages/db`
**Prioritas:** Tinggi (lubang rekonsiliasi kas — uang fisik masuk tanpa jejak akuntansi)

Saat customer melunasi hutang, `debt_payments` hanya tersimpan di tabelnya sendiri. Uang yang masuk
**tidak tercatat di arus kas** dan **tidak masuk rekonsiliasi shift kasir**. Yang berkurang hanya angka
piutang. Kalau pelunasan diterima tunai di laci kasir, uang itu menjadi **selisih kas tak terjelaskan**
saat settlement.

---

## ⚠️ KOREKSI PENTING atas framing lama (verifikasi kode 2026-07-13)

Catatan lama menyebut pelunasan "tidak masuk laporan laba/rugi" — **itu memang BENAR dan HARUS tetap begitu.**

`getProfitLossReport` (`lib/services/report-service.ts`) menghitung omzet dari
`SUM(transactions.payableAmount)` untuk **semua** transaksi `COMPLETED`, **tanpa memandang metode bayar**.
Artinya penjualan kredit **sudah diakui sebagai omzet pada saat penjualan** (basis akrual). Piutang yang
lahir dari situ adalah **aset**, bukan pendapatan tertunda.

➡️ **Kalau pelunasan piutang ditambahkan sebagai pendapatan di P&L, omzet akan DIHITUNG DUA KALI.**

**KEPUTUSAN (dikunci):** pelunasan piutang adalah **pergerakan neraca** (piutang → kas), **bukan
pendapatan**. Yang perlu diperbaiki **hanya sumbu KAS**:
1. **Arus kas** (`cash_flow_entries`) — supaya uang masuk terlihat.
2. **Rekonsiliasi shift** — supaya kas fisik di laci cocok dengan sistem.
3. **P&L — JANGAN DISENTUH.**

> Ini membalik sebagian rencana lama. Bila kelak ada permintaan "pelunasan muncul di laporan", arahkan
> ke **Laporan Arus Kas**, bukan Laba Rugi.

---

## Kondisi kode saat ini (terverifikasi)

| Hal | Fakta |
|---|---|
| `POST .../debts/[debtId]/pay` | Insert `debt_payments` + update `customer_debts` saja. **Tak menyentuh kas/shift.** Sudah ada `FOR UPDATE` + transaksi DB. |
| `debt_payments` (schema) | `debtId`, `amount`, `paymentMethodId`, `note`, `createdBy`, `createdAt`, `voided*`. **Tanpa `branchId`, tanpa `shiftId`, tanpa tautan ke kas.** |
| `customer_debts` | punya `branchId` (nullable) — cabang asal hutang. |
| `cash_flow_entries` | `type` (INCOME/EXPENSE), `categoryId` (FK kategori), `branchId`, `amount`, `note`, `createdBy`, `createdAt`. **Tanpa `shiftId`, tanpa tautan ke sumber.** |
| Rekonsiliasi shift | `expectedCash` per kasir = modal + penjualan tunai − pengeluaran. **Pelunasan tunai tidak masuk hitungan** → jadi selisih (kas lebih) tak terjelaskan. |
| Void pembayaran | `.../payments/[paymentId]/void` sudah ada (`debt.payment_void`, OWNER/GM) — **wajib ikut membalik entri kas** bila kas diintegrasikan. |

---

## Ketegangan desain yang harus diputuskan

**Pelunasan bisa terjadi di luar shift kasir mana pun** (mis. customer transfer ke rekening, atau bayar
ke Finance di kantor saat tak ada shift OPEN). Jadi tak bisa asal "paksa masuk shift aktif".

Dua sumbu yang saling silang:
- **Metode bayar:** TUNAI (masuk laci fisik → wajib masuk rekonsiliasi shift) vs NON-TUNAI (transfer/QRIS
  → masuk kas bank, **tidak** boleh menambah `expectedCash` laci).
- **Konteks:** ada shift OPEN di cabang itu vs tidak ada.

### Keputusan yang diusulkan (perlu konfirmasi Owner)

| Kasus | Perlakuan |
|---|---|
| Tunai + ada shift OPEN | Catat ke `cash_flow_entries` (INCOME) **dan** tautkan ke shift → **menambah `expectedCash`**. |
| Tunai + tak ada shift OPEN | **Tolak (409)** dengan pesan jelas, ATAU catat sebagai penerimaan kas non-shift. → **BUTUH KEPUTUSAN OWNER.** |
| Non-tunai (transfer/QRIS) | Catat ke `cash_flow_entries` (INCOME) saja; **tidak** menyentuh `expectedCash` laci. |

> Rekomendasi: **tolak** pelunasan tunai tanpa shift OPEN. Uang tunai tanpa laci = tak bisa
> direkonsiliasi; lebih baik dipaksa lewat shift daripada jadi kas siluman.

---

## Item kerja

`D1 → D2 → D3 → D4 → D5`

### D1 — Keputusan Owner + kategori kas
**Effort:** S · **Depends:** —
- [ ] Owner memutuskan kasus "tunai tanpa shift OPEN" (tolak vs penerimaan non-shift).
- [ ] Seed kategori `cash_flow_categories`: **"Pelunasan Piutang"** (`type='INCOME'`), idempotent.
- [ ] Putuskan: apakah entri kas ini boleh dihapus/diedit manual dari halaman Keuangan (rekomendasi: **tidak** —
      harus lewat void pembayaran agar piutang & kas selalu sinkron).

### D2 — Schema: tautan pelunasan ↔ kas ↔ shift
**Effort:** M · **Depends:** D1
- [ ] `debt_payments`: tambah `branchId` (FK `branches`, nullable — backfill dari `customer_debts.branchId`)
      + `shiftId` (FK `shifts`, nullable) + `cashFlowEntryId` (FK `cash_flow_entries`, nullable).
- [ ] Migrasi drizzle non-breaking (semua nullable). Backfill baris lama: `branchId` dari hutangnya;
      `shiftId`/`cashFlowEntryId` biarkan NULL (historis, tak bisa direkonstruksi).
- [ ] Pertimbangkan `cash_flow_entries.shiftId` (nullable) bila rekonsiliasi shift butuh join langsung.

> Baris lama ber-`cashFlowEntryId = NULL` = "pelunasan sebelum integrasi kas". Jangan di-backfill
> ke kas — akan mengacaukan arus kas periode lampau.

### D3 — Route `pay`: tulis kas + shift dalam satu transaksi DB
**Effort:** M · **Depends:** D2
- [ ] Di dalam `db.transaction` yang **sudah ada**: setelah insert `debt_payments`, resolve
      `paymentMethods.type` → tunai vs non-tunai; resolve shift OPEN cabang (bila tunai).
- [ ] Insert `cash_flow_entries` (INCOME, kategori "Pelunasan Piutang", `branchId`, `amount`,
      note berisi nomor hutang/customer) → simpan id-nya ke `debt_payments.cashFlowEntryId`.
- [ ] Terapkan keputusan D1 untuk kasus tunai-tanpa-shift (409 bila "tolak").
- [ ] **Atomik**: kas & pelunasan harus commit/rollback bersama — jangan ada pelunasan tanpa kas.

### D4 — Void pembayaran ikut membalik kas
**Effort:** S · **Depends:** D3
- [ ] `.../payments/[paymentId]/void`: bila `cashFlowEntryId` terisi → buat **entri pembalik**
      (EXPENSE, kategori sama, note "Void pelunasan #…") **atau** hapus entri asal — pilih satu,
      konsisten dengan pola void yang sudah dipakai di repo (cek `void-service`).
- [ ] Rekomendasi: **entri pembalik**, bukan hapus — jejak audit tak boleh hilang.
- [ ] Void juga harus menyesuaikan `expectedCash` shift terkait bila shift masih OPEN.

### D5 — Rekonsiliasi shift & tampilan
**Effort:** M · **Depends:** D3
- [ ] `expectedCash` (per kasir & `totalClosingCashExpected`) memperhitungkan pelunasan **tunai**
      pada shift tsb: `modal + penjualan tunai + pelunasan piutang tunai − pengeluaran`.
- [ ] Cetak settlement & halaman shift-history menampilkan baris **"Pelunasan Piutang (tunai)"**
      terpisah — kasir harus paham kenapa laci berisi lebih.
- [ ] Halaman Keuangan / arus kas menampilkan entri pelunasan (otomatis ikut, karena `cash_flow_entries`).
- [ ] Update `apps/backoffice/CHANGELOG.md` (perubahan perilaku: kas & settlement).

---

## Kriteria selesai (DoD)

- [ ] Pelunasan tunai → muncul di arus kas **dan** menaikkan `expectedCash` shift; settlement cocok
      dengan uang fisik di laci.
- [ ] Pelunasan non-tunai → muncul di arus kas, **tidak** menaikkan `expectedCash` laci.
- [ ] Void pelunasan → kas ikut dibalik; piutang kembali; tak ada kas siluman.
- [ ] **Laba Rugi TIDAK berubah nilainya sama sekali** (uji: jalankan P&L sebelum & sesudah pelunasan
      pada periode sama → angka identik). Ini guard anti dobel-hitung omzet.
- [ ] Pelunasan lama (pra-integrasi) tak ikut termunculkan di arus kas periode lampau.
- [ ] Unit test: tunai+shift, tunai tanpa shift, non-tunai, void, dan **regresi P&L tidak berubah**.
- [ ] `CHANGELOG.md` diperbarui.

## Catatan

- Pesan error/label **Bahasa Indonesia**; nominal **integer** + `big.js` bila ada kalkulasi.
- Terkait: pembayaran hutang **supplier** (`payable.pay`) — apakah punya lubang serupa (uang **keluar**
  tanpa entri kas)? **Belum diaudit.** Periksa saat D1; bila sama, tangani dengan pola yang sama.
- Menggantikan memori `project-debt-payment-cash-integration-todo`.
