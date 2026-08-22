### Added
- **Kolom "Stok" di Laporan Nilai Stok, ditampilkan sebagai kombinasi satuan (mis. "5 Dus 0 Box 0 Pcs"), bukan cuma angka satuan dasar mentah.** Qty dipecah greedy dari satuan terbesar ke terkecil pakai rasio konversi produk yang sudah ada (`lib/uom-breakdown.ts`) — qty basis yang dipakai tetap sama seperti sebelumnya (SUM `qty_remaining` batch, tanpa dikali rasio), cuma cara tampilnya yang berubah. Ikut ke export CSV.
- Nomor urut (kolom "No") di tabel laporan.

### Changed
- **Halaman dipindah dari menu Laporan ke menu Inventori**, nama menu jadi "Nilai & Stok Produk" — URL tetap `/reports/stock-valuation`, tidak ada yang perlu diubah di bookmark/link lama.
