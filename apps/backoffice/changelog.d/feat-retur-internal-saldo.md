### Added
- **Saldo Internal otomatis**: saldo toko di cabang pengirim (kelebihan dari Retur Internal) langsung memotong tagihan internal terbuka yang **paling lama** untuk pasangan cabang yang sama; bila belum ada tagihan terbuka, saldo menunggu dan otomatis memotong tagihan berikutnya saat kiriman baru diterima. Setiap pemotongan tercatat sebagai baris **SALDO INTERNAL** di Riwayat pembayaran (keterangannya menyebut nomor Retur Internal, nomor IBT, dan nomor nota Bulk Sale asal saldo) dan di jejak audit. **Bukan uang kas** — tidak membuat catatan Pendapatan & Pengeluaran (RI7).
- Hutang Piutang Internal: kotak **Saldo Internal yang belum terpakai** per pasangan cabang (hanya tampil bila ada sisa) (RI7).

### Changed
- Batalkan Retur Internal ditolak bila saldo dari retur itu sudah terpakai memotong tagihan lain; hutang yang terbuka lagi karena pembatalan ikut dipotong saldo lain yang masih ada (RI7).
