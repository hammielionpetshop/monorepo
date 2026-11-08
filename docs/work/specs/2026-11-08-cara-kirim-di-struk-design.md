# A3 — Cara kirim tercetak di struk & surat jalan

Tanggal: 2026-11-08 · Disetujui owner 2026-11-08 ("ok kerjakan") · Domain: backoffice (POS & transaksi, Transaksi, PO Internal) · Tanpa migrasi
Asal: antrean perbaikan Logistik HRIS butir A3; spec LT1 §3.1 butir 4 ("Pilihan tercetak di struk/surat jalan") yang tertunda sejak 1.107.108.

## 1. Tujuan

Orang gudang/sopir dan pelanggan bisa membaca dari kertas bagaimana barang dikirim, tanpa membuka sistem.

## 2. Teks yang dicetak

| Cara kirim tersimpan | Dicetak |
|---|---|
| Nota: Dikirim truk Gudang (`TRUCK`) | **DIKIRIM TRUK GUDANG** (tebal) |
| Nota: Diantar kurir cabang (`BRANCH_COURIER`) | Diantar kurir cabang |
| Nota: Ambil sendiri (`PICKUP`) | tidak dicetak |
| Nota: belum dipilih / nota lama (kosong) | tidak dicetak |
| PO Internal: Truk Gudang (`TRUCK`) | **DIKIRIM TRUK GUDANG** (tebal) |
| PO Internal: Kirim sendiri (`SELF`) | Kirim sendiri |
| PO Internal: belum dikirim (kosong) | tidak dicetak |

Aturan teks ini satu tempat di `lib/delivery-method.ts` (fungsi baru penghasil teks cetak), dipakai semua jalur cetak.

## 3. Letak di kertas

- **Struk kasir** (80mm): satu baris di bawah baris `Plgn`, sebelum garis pemisah barang.
- **Surat jalan / nota penjualan** (dot-matrix, termal, gambar): satu baris di bawah `Kepada` / `Staf`, sebelum garis kepala tabel barang; **dicetak di setiap lembar** bila nota berlembar-lembar (lembar yang terlepas tetap terbaca sopir).
- **Surat Jalan PO Internal A4** (detail PO Internal backoffice): baris "Cara kirim" di blok keterangan atas.

## 4. Jalur yang ikut

Satu penyusun dipakai bersama, jadi semua jalur sama:

- Struk: printer Bluetooth (HP), QZ Tray (PC kasir), cetak browser, dan **gambar struk** (kirim WA).
- Surat jalan: termal (kasir), dot-matrix QZ (Bulk Sale), cetak browser, gambar.
- Pemanggil: layar bayar POS (cetak pertama), Riwayat Transaksi POS (cetak ulang), detail transaksi backoffice (cetak ulang struk & surat jalan), Bulk Sale, layar sukses PO Internal di kasir, detail PO Internal backoffice.

## 5. Cetak ulang ikut cara kirim terbaru

- Cetak ulang selalu membaca cara kirim **saat ini** dari database (`transactions.delivery_method`; untuk nota PO Internal dibaca dari `inter_branch_transfers.delivery_method` lewat `source_ibt_id`). Jadi sesudah **Ubah cara kirim**, cetak ulang langsung memakai pilihan baru.
- PO Internal di layar sukses kasir: struk/surat jalan yang dicetak **sebelum** tekan Kirim tidak memuat cara kirim (belum ditentukan); yang dicetak **sesudah** Kirim memuat pilihan Kirim.
- Data yang hilang (API lama/offline) = tidak dicetak, bukan gagal cetak.

## 6. Di luar cakupan

- Karcis grooming, BPB, struk PO supplier, laporan shift: tidak berubah.
- Tidak ada perubahan alur memilih cara kirim, tanpa migrasi, tanpa tanda Baru (bukan menu/pilihan baru).

## 7. Pemeriksaan

- Tes unit penyusun: struk ESC/POS (`escpos-receipt.test.ts`), tata letak surat jalan (`delivery-note-layout.test.ts`), fungsi teks cetak (`delivery-method.test.ts`) — tiap cara kirim termasuk kosong.
- `pnpm typecheck` sekali di kandidat akhir.
- Uji layar oleh owner di staging (langkah singkat menyusul saat tayang).

## 8. Changelog

Fragment `apps/backoffice/changelog.d/feat-print-delivery-method.md` (`### Added`).
Branch: `feat/print-delivery-method` dari `origin/main`.
