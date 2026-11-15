# Audit Nilai Transfer Internal vs Piutang Internal

Tanggal cek: 2026-10-05 · Sumber: database produksi (hanya dibaca, tidak ada data diubah) · Kanban #43 poin 3

## Ringkasan

- Piutang internal **selalu** = barang diterima × harga di baris transfer (332/332 transfer). Rumus penagihannya konsisten.
- Yang membuat angka tidak cocok adalah **harga dan baris transfer yang terbentuk salah saat PO Internal diproses jadi nota Bulk Sale**. Ada 14 transfer yang nilai notanya ≠ piutangnya:
  - **12 perlu dikoreksi**: kurang tagih Rp 3.001.189 (10 transfer), lebih tagih Rp 2.255.000 (1 transfer sudah dibayar) dan Rp 9.744.000 (1 transfer yang sudah dibebaskan/WAIVED).
  - **2 wajar**: barang memang hilang di jalan dan sudah tercatat saat penerimaan.
- Penyebabnya tiga bug, dan **ketiganya sudah diperbaiki di kode** (branch `fix/ibt-nilai-transfer`). Transfer baru tidak akan mengalami ini lagi. Data lama di bawah tetap perlu dikoreksi manual.

## Tiga penyebab

| Kode | Kejadian | Akibat |
|---|---|---|
| A | Dipesan satuan kecil, dijual satuan besar (mis. dipesan PCS, dijual SAK) | Jumlah dikonversi ke PCS tapi harganya tetap per SAK → piutang **berlipat**, modal batch di toko penerima juga berlipat |
| B | Kantor menambah produk di Bulk Sale yang tidak ada di PO Internal | Barang terjual di nota tapi tidak ikut transfer → **tidak tertagih** dan **stok toko penerima tidak bertambah** |
| C | Dipesan satuan besar, dijual satuan kecil (mis. dipesan 1 DUS, dijual 2 BOX) | Dibulatkan jadi "0 DUS terkirim" → **tidak tertagih** dan stok tidak pindah |

## Rincian per transfer

"Seharusnya" = nilai nota dikurangi barang yang memang hilang di jalan.

### Kelompok 1 — Belum dibayar: cukup naikkan total piutang (Rp 2.053.000)

| No. IBT | Dari → Ke | Nota | Piutang sekarang | Seharusnya | Koreksi | Sebab |
|---|---|---:|---:|---:|---:|---|
| IBT-20260915-0001 | Gudang → Toko Pusat | 20.281.500 | 19.316.500 | 20.281.500 | **+965.000** | B: PAKAN AYAM AD 2 (2 SAK) |
| IBT-20260919-0001 | Gudang → Toko Pusat | 54.143.500 | 53.785.500 | 54.143.500 | **+358.000** | B: CRYSTAL CREAMY DELIGHT CHICKEN (2 DUS) |
| IBT-20260921-0001 | Gudang → Toko Pusat | 4.141.939 | 3.411.939 | 4.141.939 | **+730.000** | B: PUSSBITE TUNA 400GR (2 SAK) |

Barang tambahan di atas juga **tidak tercatat masuk stok Toko Pusat**. Kalau fisiknya memang sampai, stok Toko Pusat perlu ditambah lewat Penyesuaian Stok.

### Kelompok 2 — Sudah lunas tapi kurang tagih (Rp 948.189)

| No. IBT | Nota | Piutang (lunas) | Koreksi | Sebab |
|---|---:|---:|---:|---|
| IBT-20260903-0004 | 67.483.000 | 66.872.000 | **+611.000** | B (PW FRONTERA 25L LEMON 2 SAK) + A |
| IBT-20260917-0001 | 12.880.860 | 12.738.796 | **+142.064** | A (6 baris beda satuan) |
| IBT-20260914-0001 | 6.081.000 | 5.979.000 | **+102.000** | C: CRYSTAL PC TUNA CHICKEN GRUVY dipesan 1 DUS, dijual 2 BOX |
| IBT-20260823-0007 | 280.000 | 252.000 | **+28.000** | Data lama (sebelum kirim dikunci ke nota), perlu cek fisik |
| IBT-20260822-0013 | 266.250 | 239.625 | **+26.625** | Data lama: LIFECAT DRY terjual 10 PCS, tercatat kirim 9, perlu cek fisik |
| IBT-20260831-0001 | 6.356.000 | 6.334.500 | **+21.500** | A (3 baris beda satuan) |
| IBT-20260910-0005 | 3.520.000 | 3.503.000 | **+17.000** | Selisih pembulatan harga, perlu cek |

Pilihan: tagih susulan ke cabang penerima, atau diikhlaskan dan dicatat sebagai selisih.

### Kelompok 3 — Lebih tagih

| No. IBT | Nota | Piutang | Status | Koreksi | Sebab |
|---|---:|---:|---|---:|---|
| IBT-20260908-0009 | 1.354.100 | 3.609.100 | **LUNAS** | **−2.255.000** | A: TAKARI 500GRAM 5MM dijual per DUS, ditagih per PCS × 12 |
| IBT-20260903-0005 | 406.000 | 10.150.000 | WAIVED | −9.744.000 | A: BOLT DRY IKAN CURAH 1 SAK ditagih sebagai 25 × harga SAK |

- IBT-20260908-0009: Toko Pusat **membayar Rp 2.255.000 terlalu banyak** ke Gudang. Perlu dikembalikan atau dipotong dari tagihan berikutnya.
- IBT-20260903-0005: tidak ada uang yang berpindah (dibebaskan). Total piutangnya cukup dirapikan supaya laporan piutang tidak menampilkan Rp 10,15 juta.

### Kelompok 4 — Wajar, tidak perlu koreksi

| No. IBT | Nota | Piutang | Hilang di jalan |
|---|---:|---:|---:|
| IBT-20260914-0002 | 2.099.390 | 1.863.790 | 235.600 |
| IBT-20260927-0003 | 1.040.830 | 950.830 | 90.000 |

## Dampak ke HPP (modal stok)

Bug A juga membuat modal batch di toko penerima berlipat:

- **TAKARI 500GRAM 5MM**, batch #4449 Toko Pusat: 12 PCS bermodal **Rp 205.000 per PCS** (seharusnya ± Rp 17.083). Batch sudah habis terjual, jadi HPP penjualannya ikut membengkak sekitar Rp 2,25 juta. Koreksi ini masuk ranah audit HPP (lihat `docs/audit-hpp-fase0/`).
- BOLT DRY IKAN CURAH, batch #4245: modal sudah Rp 16.300 per PCS, tampaknya sudah dibetulkan di audit HPP sebelumnya.

## Yang perlu diputuskan Owner / Finance

1. Kelompok 1: setuju total piutang dinaikkan sesuai tabel? Barang tambahannya benar sampai di Toko Pusat?
2. Kelompok 2: ditagih susulan atau diikhlaskan?
3. Kelompok 3: kelebihan bayar Rp 2.255.000 dikembalikan atau dipotong dari tagihan berikutnya?
4. HPP TAKARI: dikoreksi bersama audit HPP?

Setelah diputuskan, koreksinya dijalankan lewat SQL terkontrol, dengan cadangan data sebelum diubah.
