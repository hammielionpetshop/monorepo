# Backlog — Jasa (Grooming)

**Status:** J0 selesai (dokumen) · **J1 sedang dikerjakan** · J2–J4 belum dimulai · Hotel Cat pending
**Tanggal:** 2026-10-11
**Sumber rencana:** [`docs/work/specs/2026-10-11-jasa-grooming-design.md`](../specs/2026-10-11-jasa-grooming-design.md)
**Istilah:** [`docs/glosarium-bisnis.md`](../../glosarium-bisnis.md)
**Scope:** `apps/backoffice` (POS web + Back Office) + `packages/db` (+ saringan katalog `apps/order-web`)

Satu item = satu sesi = satu branch/worktree = satu commit fitur (pesan menyebut `Jn`).
Tiap item mengikuti alur baku: `klaim: <branch>` di `main` (+ **kunci migrasi** bila ada
migrasi) → worktree → kode + tes → typecheck/lint/test/`changelog:check`/`migrations:check` →
lapor owner (bahasa sederhana + risiko) → **izin push per item** → backup DB produksi → rilis →
`klaim: lepas <branch>`. Status sesudah rilis: **"tayang — menunggu uji coba owner"**.

**Perubahan alur rilis — keputusan owner 2026-10-11 malam:** owner memilih **lanjut ke tahap berikutnya tanpa menayangkan J1** ("lanjut J2 tanpa tayang"). Jadi tetap satu item = satu sesi = satu branch = satu commit fitur, tetapi branch tiap tahap **bertumpuk** di atas tahap sebelumnya dan **belum ada yang di-push ke main**. Kapan dirilis (per tahap atau gabungan) diputuskan owner; izin push tetap diminta saat itu.

**Setiap pertanyaan bisnis baru atau temuan yang bertentangan dengan spec/keputusan** dilaporkan
ke owner dan dicatat di spec/glosarium **sebelum** item itu dilanjutkan — tidak diputuskan sendiri.

## Urutan pengerjaan

```
J0 ✅ → J1 ▶ → J2 → J3 → J4          (Hotel Cat: pending, dirancang terpisah)
        tinggi  rendah sedang rendah
```

---

## J0 — Dokumen ✅

- [x] Keputusan owner dicatat di daftar bahas & glosarium
- [x] Spec jasa grooming
- [x] Backlog ini

## J1 — Tanda jasa di produk; jasa tidak memotong stok

**Branch:** `feat/jasa-tanda-produk` · **Migrasi:** 0037 (kunci migrasi) · **Risiko:** sedang–tinggi
(jalur transaksi kasir)

- [ ] Migrasi 0037: `products.product_kind` (`BARANG` bawaan) + tandai empat produk grooming
- [ ] Penjaga di `StockService`: jasa tidak mengurangi/menambah stok, tanpa utang stok, modal 0
- [ ] Jalur jual, batal nota, retur pelanggan, koreksi nota — tes DB masing-masing
- [ ] Form produk Back Office: pilihan "Jenis" (Owner/GM)
- [ ] Jasa disaring dari stock opname, PO, PO Internal/transfer, Bulk Sale, barang rusak, retur
      supplier, katalog portal pesanan (+ ditolak server)
- [ ] Potongan changelog, cek lengkap, laporan ke owner

Yang **tidak** berubah di J1: grooming masih dijual dari tab Kasir; stok minus & utang stok lama
dibiarkan; Hotel Cat tidak disentuh.

## J2 — Pengaturan groomer + data pemilik & kucing (Back Office)

**Migrasi:** ya (tabel baru + izin) · **Risiko:** rendah

- [ ] Tabel `groomers`, `pets`; izin baru dipasang migrasi
- [ ] Pengaturan → Groomer (tambah, nonaktifkan — tanpa hapus)
- [ ] Data Kucing (daftar + di detail pelanggan)
- [ ] Peringatan nomor telepon pemilik sudah terdaftar
- [ ] Tanda "Baru" di menu & tambahan barunya

> **J3 dipecah menjadi tiga (2026-10-12)** karena terlalu besar untuk satu tahap — sama seperti pola Retur Internal (mesin dulu, layar kemudian):
> **J3a** mesin di server (tabel `grooming_orders`, nota membawa data kucing & groomer, grooming ikut batal saat nota dibatalkan/diretur, daftar & tandai diambil — tanpa layar) → **J3b** layar tab Grooming (Terima Kucing, Sedang Dikerjakan, Hotel "Segera hadir", Sudah Selesai, karcis, Lunas sekarang / Bayar saat ambil / Bayar & Ambil) → **J3c** Tambah belanja (satu nota dengan barang), jasa hilang dari daftar produk tab Kasir, nota berisi jasa tidak bisa ditahan.

## J3 — Tab Grooming di POS

**Migrasi:** ya (`grooming_orders`) · **Risiko:** sedang

- [ ] Tab Grooming + empat bagian (Hotel = "Segera hadir")
- [ ] Terima Kucing: pemilik → kucing → jasa + groomer + kondisi
- [ ] Baris jasa tidak digabung di keranjang; "Tambah belanja" (satu nota)
- [ ] Karcis dua lembar per ekor; cetak ulang bertanda
- [ ] "Bayar saat ambil" (piutang) + "Bayar & Ambil"
- [ ] Jasa hilang dari daftar produk tab Kasir; nota berisi jasa tidak bisa ditahan; baris jasa
      dikunci dari Koreksi
- [ ] Batal nota / retur baris jasa → grooming dibatalkan

## J4 — Riwayat Grooming, Ganti Groomer, laporan jasa & bonus

**Migrasi:** ya (jejak ganti groomer) · **Risiko:** rendah

- [ ] Halaman Riwayat Grooming (Back Office)
- [ ] Ganti Groomer (Owner/GM, alasan wajib, berjejak)
- [ ] Laporan jasa & bonus (per cabang / jasa / groomer)
- [ ] Tanda "Grooming" di Laporan Piutang

## Pending — Hotel Cat

Dibahas ulang dengan owner sebelum dirancang (check-in/out, makanan, grooming saat menginap,
tanpa bonus, dibayar saat keluar).

## Catatan kerja (log)

| Tanggal | Item | Catatan |
|---|---|---|
| 2026-10-11 | J0 | Rancangan dibahas dengan owner dalam delapan putaran tanya-jawab; semua keputusan ada di spec. Owner memberi perintah mulai. |
