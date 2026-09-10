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
