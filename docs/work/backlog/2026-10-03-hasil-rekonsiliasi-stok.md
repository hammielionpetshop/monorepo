# Hasil audit batch/FIFO dan usulan rekonsiliasi

Audit produksi 2026-10-03 03:41:09 WIB (snapshot UTC `2026-10-02T20:41:09.364007Z`).
Query: [stock-invariant-audit.sql](../plans/sql/2026-10-03-stock-invariant-audit.sql).
K1 A digunakan: **agregat = seluruh sisa batch − seluruh residual shortfall yang belum closed**, termasuk write-off.
Write-off tidak menambah stok. Penjumlahan qty lintas produk di bawah hanya kontrol aritmetika; satuan fisiknya tidak dapat disamakan.

## Akses dan batas tindakan

- Jalur produksi diverifikasi dari runbook migrasi VPS: SSH dengan key deploy dan pemeriksaan host key, container PostgreSQL pada server aplikasi yang aktif. Database `petshop_db`, 81 tabel schema petshop, ledger migrasi terakhir ID 28 (migrasi repo 0027). Migrasi baru 0028 belum diterapkan ke produksi.
- Setiap audit menggunakan `REPEATABLE READ READ ONLY`, timeout statement 60 detik, `ON_ERROR_STOP`, lalu `ROLLBACK`. Output membuktikan `read_only=on` dan `isolation=repeatable read`.
- Query terlebih dahulu dijalankan pada `petshop_wt_audit_stock_reconciliation` lokal. Template lokal memiliki 12 drift, 1 konversi invalid, dan 15 batch tanpa PO; bukan salinan produksi saat ini.
- Tidak ada UPDATE/INSERT/DELETE, migrasi, deploy, atau perubahan kredensial produksi. Kode berada di branch bertumpuk, belum di main.

## Hasil produksi

| Pemeriksaan | Jumlah | Makna |
|---|---:|---|
| Pasangan produk/cabang | 2.385 | Union stock, batch dan shortfall; orphan ikut diperiksa |
| Drift saldo / agregat tidak ada | 487 | Perlu pembuktian dokumen atau recount |
| Batch negatif | 0 | Kondisi snapshot, bukan bukti semua operasi historis benar |
| Stok pada satuan non-base | 0 | Tidak ada row non-base saat snapshot |
| Pemakaian satuan tanpa konversi valid | 39 | Riwayat sale/transfer pada 3 produk; rasio tidak boleh ditebak |
| Modal batch perlu tinjauan | 458 | 294 masih bersisa; nol/rasio ekstrem terhadap master hanya indikator |
| Batch tanpa referensi PO | 5.779 | Termasuk opening, reversal, transfer dan koreksi yang memang bukan PO |
| Histori write-off | 0 | Tidak ada write-off produksi pada snapshot ini |
| Shortfall dari nota VOIDED/item berubah | 23 | Semua yang terdeteksi berasal dari VOIDED; 15 masih residual, total 810 qty base |
| Indikator batch PO berlebih/status tidak cocok | 0 | Hanya PO yang tertaut pada batch; bukan pembuktian tidak pernah ada duplikasi |
| Payable PO ganda | 0 | Tidak terdeteksi saat snapshot |

Total batch 166.396, agregat 126.826, defisit aktif 19.502, residual write-off 0.
Selisih invariant neto **−20.068**; bukan angka koreksi massal yang disetujui.

Artefak lengkap tanpa data pribadi customer/kredensial:

- [Ringkasan snapshot produksi](../implementation/batch-fifo/audit/production-summary.json).
- [Semua temuan dan ID produksi (JSONL)](../implementation/batch-fifo/audit/production-findings.jsonl).
- [487 kandidat recount: ID, sebelum, target aritmetika, kepastian](../implementation/batch-fifo/audit/production-recount-candidates.csv).
- [Ringkasan lokal](../implementation/batch-fifo/audit/local-summary.json) dan [temuan lokal](../implementation/batch-fifo/audit/local-findings.jsonl).

## Kandidat koreksi konkret untuk ditinjau

Target aritmetika berikut adalah angka yang akan membuat invariant cocok **jika batch dan residual sumber terbukti benar**. Belum membuktikan stok fisik. Usulan utama adalah approved recount per pasangan, dengan qty hasil hitung menjadi target final. Jangan langsung menyalin target ini ke agregat.

| Produk/cabang | Row stok | Agregat sebelum | Batch | Residual | Target aritmetika bersyarat | Selisih | Usulan / kepastian |
|---|---|---:|---:|---:|---:|---:|---|
| 2661 / 3 | 1952 | 697 | 2.393 | 0 | 2.393 | −1.696 | Recount; drift pasti, qty fisik belum pasti |
| 1648 / 2 | 1395 | 350 | 1.750 | 0 | 1.750 | −1.400 | Recount; telusuri transfer/FIFO sebelum memilih batch koreksi |
| 2016 / 2 | 1895 | −1.050 | 0 | 200 | −200 | −850 | Audit shortfall 14/870 dan recount; jangan menganggap target negatif sebagai hitungan fisik |
| 1620 / 2 | 914 | 35 | 755 | 0 | 755 | −720 | Recount, bukan penambahan otomatis 720 |
| 2676 / 2 | 2208 | −600 | 0 | 0 | 0 | −600 | Telusuri oversell/bypass sebelum ledger shortfall dan recount |

Untuk 487 pasangan, CSV menyimpan semua ID batch/stok/shortfall dan angka lama. Field `proposed_physical_qty=PENDING_COUNT` sengaja belum diisi karena tidak ada hasil hitung fisik baru.

Konversi yang hilang:

- Produk 1575, base UOM 9, pemakaian UOM 15: 33 sale item dan 3 transfer item. Usulkan **NULL → rasio positif yang dibuktikan kemasan/dokumen**, belum ada angka rasio yang aman. Riwayat memakai rasio sekarang tidak membuktikan rasio saat transaksi.
- Produk 1649, base 9/UOM 15: sale item 515 dan 644; perlu bukti kemasan yang sama.
- Produk 2604, base 15/UOM 18: transfer item 645; perlu dokumen transfer dan kemasan. Guard baru akan menolak pemakaian ini sampai konversi sah tersedia.

Shortfall dari VOIDED:

- Contoh shortfall 1043 (produk 1844/cabang 3, nota 20738/item 42106): residual **1 → usulan 0** setelah reversal dan batch terkait diverifikasi. Shortfall 1106 (produk 2536/cabang 2, nota 20967/item 42576): **100 → usulan 0** dengan syarat yang sama.
- Semua 15 residual dan 8 yang sudah closed tercantum pada kategori `SHORTFALL_SOURCE_REVIEW`. Jangan menutup residual saja: void sudah menambah batch reversal. Pembatalan defisit tanpa penyesuaian batch yang terbukti dapat membuat invariant meleset atau stok semu.
- Shortfall 38 (produk 2662/cabang 3) residual 155 sedangkan qty base item sekarang 5: bukti tambahan bahwa konversi/histori sumber perlu ditinjau. Tidak ada usulan koreksi HPP dari harga master.
- Lot asal reversal belum terlacak penuh. Untuk kasus tanpa bukti lot, pilih recount dan koreksi berjejak yang disetujui, bukan mengklaim batch asal sudah dipulihkan.

Modal: batch 1116 (produk 2625/cabang 4, sisa 1) dan 1127 (produk 2624/cabang 4, sisa 18) bermodal 0. Usulan **0 → modal dokumen sumber per base UOM**, belum ada nominal yang dapat disetujui. Tidak mengisi dari master sekarang atau menulis ulang HPP historis.

## Gerbang mutasi berikutnya

Belum ada paket koreksi yang cukup pasti untuk ditulis ke produksi. Audit ini mengizinkan penyusunan paket berikut, bukan eksekusinya:

1. Owner menyetujui hitungan fisik/dokumen sumber dan angka target per ID. Untuk dugaan duplikasi PO, buktikan log approval, invoice, qty bersih, payable, clearing dan bahwa qty belum dipakai/ditransfer; jumlah batch saja tidak cukup.
2. Simpan backup baris tepat yang akan berubah (stock, batch, shortfall/clearing, dokumen/payable terkait), tanpa data customer yang tidak diperlukan.
3. Siapkan skrip atomik per kasus dengan advisory stock lock yang sama, header lock jika menyentuh PO/transfer, dan precondition ID/status/qty/nilai lama. Perubahan precondition membatalkan transaksi.
4. Catat koreksi lewat opname/adjustment atau dokumen koreksi yang disepakati; simpan alasan, approver dan referensi. Sertakan rollback yang memulihkan baris terpengaruh dan pemeriksaan efek transaksi setelah snapshot.
5. Minta **persetujuan terpisah atas paket konkret** sebelum write produksi. Setelah disetujui dan dieksekusi, ulang audit dan catat residual.

Residual saat ini: seluruh 487 drift, 39 pemakaian konversi invalid, 458 tinjauan modal, 23 sumber shortfall VOIDED dan keterlacakan 5.779 batch tanpa PO belum dikoreksi. Perbaikan kode mencegah jalur error yang diuji; tidak otomatis membersihkan data lama.

Audit ulang Tahap 5, snapshot `2026-10-02T20:46:54.942605Z` (03:46:54 WIB), menghasilkan jumlah temuan dan total yang sama. [Ringkasan audit ulang](../implementation/batch-fifo/audit/final-production-summary.json). Sesi ini tidak melakukan mutasi produksi.
