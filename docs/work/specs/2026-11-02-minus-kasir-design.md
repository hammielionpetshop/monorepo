# Laporan Minus Kasir — rancangan (2026-11-02)

Status: disetujui owner 2026-11-02 (mockup di chat), tahap 1 = laporan saja.

## Tujuan

Owner butuh angka yang adil untuk menentukan siapa menanggung minus kas, dan melihat plus
dengan cara yang sama. Menu: **Shift › Minus Kasir** (`/cashier-variance`).

## Aturan (keputusan owner)

1. **Selisih resmi** satu shift = `deposit_received_cash` (uang diterima & diverifikasi finance)
   − `total_closing_cash_expected` (kas menurut sistem). Bukan hitungan/setoran kasir.
   Contoh nyata: shift 315 (Toko Pusat, 20 Okt) kasir salah ketik Rp 391.500, finance
   memverifikasi Rp 6.391.600 → selisih resmi −Rp 3.004, bukan −Rp 6 juta.
2. Shift yang **belum diverifikasi** tidak punya angka resmi; laporan menyebutkan tanggal
   dan nomor shift-nya per cabang.
3. **Tanpa penanggung jawab.** Selisih dibagi ke kasir menurut **porsi kas tunai** di shift
   itu = `shift_cashier_breakdown.total_sales_cash` (penjualan tunai bersih kembalian) +
   pelunasan piutang tunai yang diterima kasir itu (`debt_payments.created_by`, belum
   di-void). Pembulatan sisa terbesar → jumlah bagian persis = selisih shift (`big.js`).
4. **Minus dan plus berdampingan**, tidak saling mengurangi; plus dibagi dengan cara sama.
   Owner yang memutuskan penyelesaiannya (kasir tak tahu nilai sistem saat settle, jadi
   plus juga harus dijelaskan).
5. **Toleransi** dapat diatur (bawaan Rp 5.000): |selisih| < toleransi → tidak dibebankan.
   **Batas tak wajar** (bawaan Rp 1.000.000): |selisih| ≥ batas → ditandai, tidak dibagi
   (contoh: shift 213 Gudang 4 Okt, verifikasi Rp 33,9 jt vs sistem Rp 14,5 jt).
   Disimpan di `app_settings` kunci `cashier_variance_settings` (JSON), ubah hanya
   Owner/GM, berjejak `audit_logs` (`CASHIER_VARIANCE_SETTINGS_UPDATE`).
6. Status "sudah dipotong gaji" **ditunda** (butuh tabel baru).

## Cakupan data

Shift `origin = 'POS'`, status `CLOSED`/`FORCE_CLOSED`, dikelompokkan per bulan menurut
tanggal buka WIB. Shift tutup paksa ikut bila sudah diverifikasi. Akses: izin `shift.read`
atau `shift.deposit.verify` (sama dengan Riwayat Shift); pengguna non-ALL hanya cabangnya.

## Berkas

- `apps/backoffice/lib/cashier-variance.ts` (+tes) — aturan murni.
- `apps/backoffice/lib/services/cashier-variance-service.ts` — query & pengaturan.
- `apps/backoffice/app/(dashboard)/cashier-variance/**` — halaman.
- `apps/backoffice/app/api/bo/cashier-variance/settings/route.ts` — simpan pengaturan.

## Angka acuan Oktober 2026 (produksi, dihitung 2026-11-02 sebelum toleransi)

15 shift minus terverifikasi = −Rp 513.189; 63 shift POS tutup + 17 tutup paksa belum
diverifikasi. Dengan toleransi Rp 5.000 total minus yang dibebankan lebih kecil.
