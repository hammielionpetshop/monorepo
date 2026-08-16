### Added
- Halaman **Riwayat Retur** (`/retur/riwayat`): daftar semua retur beserta nomor transaksi asal, cabang, siapa yang memproses, jumlah item, nilai refund, dan statusnya. Filter nomor retur/transaksi, rentang tanggal, status (aktif/dibatalkan), dan cabang (khusus yang scope-nya `ALL`); ada paginasi dan tiga kartu ringkasan (retur aktif, nilai refund aktif, retur dibatalkan) yang dihitung atas **seluruh hasil filter**, bukan hanya halaman yang tampil.
- Modal **Detail Retur**: item yang diretur (produk, satuan, qty, harga satuan, refund per baris), alasan retur, dan — bila sudah dibatalkan — waktu, pelaku, serta alasan pembatalannya.
- Tombol **Batalkan Retur** di baris riwayat (permission `return.cancel`, PIN Owner + alasan). Endpoint pembatalannya sudah ada sejak lama tapi **tidak pernah bisa dipanggil dari layar mana pun**: tidak ada satu pun halaman yang menampilkan `returnId`, sehingga retur yang salah input hanya bisa dibatalkan lewat panggilan API manual.
- Endpoint `GET /api/bo/retur?page&limit&q&status&dateFrom&dateTo&branchId` — riwayat retur dengan ringkasan, dibatasi sumbu scope cabang (`branchScope === 'ALL'` boleh memilih cabang, selain itu dipaksa ke cabang aktif).
- Endpoint `GET /api/bo/retur/[returnId]` — detail satu retur beserta itemnya, dengan pembatasan cabang yang sama.
- `ReturService.listReturns()` dan `ReturService.getReturnDetail()`.

### Changed
- `/retur` dan `/retur/riwayat` kini punya tab bersama (**Proses Retur** / **Riwayat Retur**), dan "Riwayat Retur" ditambahkan ke sidebar grup Transaksi.
- Setelah retur berhasil diproses, kotak suksesnya menautkan langsung ke riwayat dengan nomor retur itu sudah terisi di filter.
- Pembatalan retur tetap memverifikasi PIN Owner **cabang aktif**, sesuai perilaku endpoint yang sudah ada. Karena itu baris retur milik cabang lain hanya bisa dilihat, tidak bisa dibatalkan, sampai cabang aktifnya dipindah lewat pemilih cabang di header — tombolnya diganti keterangan, bukan dibiarkan gagal saat diklik.
