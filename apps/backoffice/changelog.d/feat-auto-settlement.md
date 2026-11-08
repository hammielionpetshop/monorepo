### Added
- Pelunasan otomatis utang internal dari Setoran: saat Finance memverifikasi setoran tunai atau non-tunai sebuah cabang, uangnya langsung melunasi utang internal cabang itu mulai dari tagihan paling lama, lalu diteruskan ke utang pemasoknya (mis. Toko Pusat ke Gudang). Sisanya dicatat sebagai setoran bebas. Hanya utang sejak 1 November 2026 dan hanya uang yang sampai di Tempat Uang yang dipegang Finance.
- Rincian pelunasan di Setoran › Riwayat dan pesan ringkas sesudah Verifikasi; koreksi setoran membalik pelunasannya (tercatat BATAL SETORAN) lalu melunasi ulang.
- Utang Internal: kolom Umur (merah lewat 30 hari), ringkasan sisa utang per cabang, label SETORAN di riwayat bayar, dan pengingat bahwa bayar manual hanya untuk uang di luar Setoran.

### Changed
- Setoran › Tunai belum disetor hanya memuat shift sejak 1 November 2026; shift lama sebelum itu dibiarkan.

### Fixed
- Baris berwarna di Setoran (Tunai belum disetor, Non-tunai) kini terbaca di mode gelap.
