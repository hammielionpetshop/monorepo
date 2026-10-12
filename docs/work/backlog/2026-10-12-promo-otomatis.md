# Backlog — Promo Otomatis, Diskon per Barang & Laporan Diskon

**Status:** P0 (dokumen) — tahap lain belum dimulai
**Tanggal:** 2026-10-12
**Sumber rencana:** [`docs/work/specs/2026-10-12-promo-otomatis-design.md`](../specs/2026-10-12-promo-otomatis-design.md)
**Istilah:** [`docs/glosarium-bisnis.md`](../../glosarium-bisnis.md)
**Scope:** `apps/backoffice` (POS web + Back Office) + `packages/db`

Satu item = satu branch = satu rilis. Tiap item mengikuti alur baku: `klaim: <branch>` di `main`
(+ **kunci migrasi** bila ada migrasi) → worktree → kode + tes → typecheck/lint/test/
`changelog:check`/`migrations:check` → lapor owner (bahasa sederhana + risiko) → **izin push per
item** → backup DB produksi → rilis → `klaim: lepas <branch>`. Status sesudah rilis: **"tayang —
menunggu uji coba owner"**.

**Setiap pertanyaan bisnis baru atau temuan yang bertentangan dengan spec/keputusan** dilaporkan ke
owner dan dicatat di spec/glosarium **sebelum** item itu dilanjutkan — tidak diputuskan sendiri.

## Urutan pengerjaan

```
P0 → P1 → P2 → P3 → P4          (promo di portal pesanan: dibahas terpisah)
     tinggi tinggi sedang sedang
```

---

## P0 — Dokumen

- [x] Spec promo otomatis
- [x] Backlog ini
- [x] Glosarium & daftar bahas diperbarui dengan keputusan owner 2026-10-12

## P1 — Diskon manual per barang, retur mengikuti nilai dibayar, Laporan Riwayat Diskon

**Migrasi:** ya (kunci migrasi) · **Risiko:** sedang–tinggi (layar bayar kasir, retur)

- [ ] Tabel catatan potongan per baris nota (jenis MANUAL: nilai, alasan, pelaku, waktu)
- [ ] Mesin diskon manual (`lib/manual-discount.ts`) + tes; batas diskon = tanpa batas (bawaan)
- [ ] Mesin nilai bersih baris (satu rumus untuk retur, laporan, bonus jasa)
- [ ] Keranjang kasir: tombol Diskon per baris + popup wajib pilih (potongan, alasan)
- [ ] Layar bayar: tombol "+ Diskon" total nota dihapus; tab Grooming ikut memakai diskon per baris
- [ ] Server memeriksa ulang diskon manual saat nota disimpan
- [ ] Retur pelanggan: uang kembali = nilai yang benar-benar dibayar (nota lama berdiskon total:
      dibagi sebanding)
- [ ] Koreksi nota, batal nota, daftar tunggu, struk, settlement shift tetap benar — tes DB
- [ ] Laporan Riwayat Diskon (per produk → popup nota) + tanda "Baru"
- [ ] Penjualan per Produk dan Laba Rugi tetap cocok — tes pembanding kode lama vs baru

## P2 — Mesin promo + layar Promo + potongan per barang / minimal pcs / flash sale

**Migrasi:** ya · **Risiko:** tinggi (harga di kasir)

- [ ] Tabel promo (kepala, barang syarat, barang hadiah, cabang) + izin Owner/GM
- [ ] Mesin promo (`lib/promo/`) + tes: satu barang satu promo, pilih termurah untuk pelanggan,
      kelipatan, maksimal per nota, hanya Retail, jam server
- [ ] Back Office: daftar/buat/nonaktifkan promo; peringatan jual rugi; tanpa edit sesudah terpakai
- [ ] Kasir: promo berlaku otomatis, baris bertanda promo, tidak bisa didiskon manual
- [ ] Server sebagai hakim (hitung ulang, tolak bila berbeda); daftar tunggu dihitung ulang saat bayar
- [ ] Saklar darurat "matikan semua promo" di Pengaturan
- [ ] Struk: nama promo + "Anda hemat"
- [ ] Laporan Promo (efektivitas + peringkat toko)

## P3 — Beli X gratis Y & bundling

**Risiko:** sedang

- [ ] Barang gratis otomatis masuk keranjang; ikut hilang bila syaratnya dihapus
- [ ] Bundling: potongan pada barang yang ditentukan owner
- [ ] Retur promo paket hanya satu paket utuh; koreksi nota mengunci baris promo

## P4 — Grooming gratis makanan pilihan

**Risiko:** sedang (tab Grooming)

- [ ] Hadiah berupa daftar pilihan → kasir memilih satu
- [ ] Bonus groomer tidak berubah (potongan jatuh di makanan, bukan di jasa) — tes

## Dibahas terpisah

- Isi aturan batas diskon kasir (mesinnya ada sejak P1)
- Daftar alasan diskon manual
- Promo "minimal belanja" untuk seluruh nota
- Promo di portal pesanan

## Catatan kerja (log)

| Tanggal | Tahap | Catatan |
|---|---|---|
| 2026-10-12 | P0 | Analisa kode + keputusan owner (14 butir di spec) ditulis; belum ada kode. |
