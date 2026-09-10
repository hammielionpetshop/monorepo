### Added
- **PO Internal masuk bisa diproses langsung dari halaman kasir (`/pos`).** Cabang pengirim
  melihat permintaan PO Internal yang ditujukan padanya dan memprosesnya seperti bulk sale
  tanpa harus buka backoffice.
  - Permission baru `internal_transfer.process_pos` (OWNER, GM, MANAGER, KASIR) — perlu
    dijalankan `seed-permissions` manual di produksi karena pipeline deploy tidak seed.
  - `GET /api/pos/internal-po` — daftar PO Internal (status `DRAFT`/`PENDING_APPROVAL`, belum
    dikonversi) yang cabang pengirimnya = cabang sesi POS.
  - `GET /api/pos/internal-po/[id]` — detail item yang diminta, stok tersedia di cabang
    (dihitung dalam base UOM), harga retail per item, dan customer internal cabang tujuan.
  - `POST /api/pos/transactions` menerima `sourceIbtId`: transaksi ditandai `saleType` BULK,
    PO Internal-nya otomatis di-approve & ditautkan (`convertedTransactionId`) lewat jalur
    yang sama dengan Bulk Sale backoffice. Divalidasi (cabang pengirim, belum dibatalkan,
    belum pernah dikonversi) dan digerbang permission `internal_transfer.process_pos`.
  - Keranjang POS menyimpan tautan PO Internal aktif; ikut bersih saat keranjang
    dikosongkan atau daftar tunggu dilanjutkan.
  - Tombol **PO Internal** (+ badge jumlah) di halaman kasir, di samping Daftar Tunggu.
    Membuka drawer daftar PO Internal masuk; klik satu record menampilkan detail item +
    stok tersedia (helper text merah bila kurang/kosong).
  - Tombol **Proses** menyalin produk ke keranjang pada harga retail; bila ada stok
    kurang/kosong muncul konfirmasi 3 pilihan (pakai stok yang ada / oversell / hapus
    produk kurang). Tombol **Batalkan** membatalkan PO Internal langsung dari kasir
    (`PATCH /api/pos/internal-po/[id]/cancel`).
  - Banner di kasir menandai keranjang yang berasal dari PO Internal; checkout meneruskan
    `sourceIbtId` sehingga nomor transaksi otomatis tertaut ke PO Internal saat selesai.
