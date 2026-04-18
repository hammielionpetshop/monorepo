# 9. USER FLOWS

## 9.1 Flow Kasir Transaksi Normal

```
[Login] → [Pilih/Buka Shift] → [Input Modal Awal]
   ↓
[Dashboard POS]
   ↓
[Scan/Cari Produk]
   ↓
[Pilih UOM] → [Pilih Tier Harga]
   ↓
[Input Qty] → [Sistem Cek Stock & Auto-Break jika perlu]
   ↓
[Tambah ke Keranjang]
   ↓
[Ulangi untuk produk lain]
   ↓
[Review Keranjang]
   ↓
[(Opsional) Input Customer]
   ↓
[(Opsional) Apply Diskon Manual]
   ↓
[Pilih Payment Method]
   ↓
[Input Nominal Bayar]
   ↓
[Cetak Struk]
   ↓
[Transaksi Selesai]
```

## 9.2 Flow Settlement

```
[Manager klik Settlement]
   ↓
[Sistem hitung Total Penjualan per Kasir per Metode]
   ↓
[Sistem hitung Total Pengeluaran per Kasir]
   ↓
[Sistem hitung Expected Cash per Kasir]
   ↓
[Tampilkan breakdown ke Manager]
   ↓
[Setiap Kasir hitung uang fisik MEREKA sendiri]
   ↓
[Manager input Real Cash per Kasir]
   ↓
[Sistem hitung Selisih per Kasir]
   ↓
[Review]
   ↓
[Konfirmasi Final]
   ↓
[Print Settlement Report (3 rangkap)]
   ↓
[Shift CLOSED]
```

## 9.3 Flow Void Request

```
KASIR SIDE:
[Buka List Transaksi] → [Pilih Nota] → [Klik Request Void]
   ↓
[Pilih Alasan] → [Upload Bukti (opsional)] → [Submit]
   ↓
[Status: Pending Approval]

BACKOFFICE SIDE:
[Notif Request Void] → [Review Detail] → [Keputusan]
   ↓
┌─────────┬────────┬──────────────┐
APPROVE  REJECT  REQUEST_INFO
   ↓         ↓          ↓
[Execute] [Notify  [Notify
[Void]    Kasir]   Kasir]
   ↓
[Stock Return, Refund, Audit Log]
```

## 9.4 Flow Stock Opname Harian

```
[Kasir buka SO Harian]
   ↓
[Pilih Metode: Suggest / Keluar Hari Ini / Manual]
   ↓
[Sistem tampilkan list produk]
   ↓
[Kasir checklist 20-30 item]
   ↓
[Untuk setiap item: input stock fisik]
   ↓
[Sistem hitung selisih per UOM]
   ↓
[Review summary]
   ↓
[Submit untuk Approval]
   ↓
[Backoffice Review]
   ↓
┌───────────┬──────────┐
APPROVE    REJECT
   ↓           ↓
[Stock    [Kembali ke
 Adjust]   Kasir untuk
 [Log      Recount]
 Kerugian]
   ↓
[Print Report]
```

## 9.5 Flow Purchase Order

```
[Kasir buat Request PO]
   ↓
[Pilih Supplier + Tambah Produk + Qty]
   ↓
[Submit] → [Status: PENDING_APPROVAL]
   ↓
[Owner Review di Backoffice]
   ↓
[APPROVE] → [Generate PO Document] → [Kirim Supplier]
   ↓
[Status: APPROVED → IN_TRANSIT]
   ↓
[Barang Datang]
   ↓
[Petugas Gudang Input Penerimaan]
   ↓
[Scan barcode + Input qty + Foto]
   ↓
[Submit] → [Status: PARTIALLY/FULLY_RECEIVED]
   ↓
[Finance Review + Approve Penerimaan]
   ↓
[Stock Update + Batch Created + Hutang Supplier Tercatat]
   ↓
[Status: COMPLETED]
   ↓
[Finance Bayar Supplier]
   ↓
[PO Archived]
```
