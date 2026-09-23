### Fixed

- Membuat Purchase Order gagal (error 500 "Gagal membuat Purchase Order") kalau cabang lain sudah membuat PO di hari yang sama. Nomor urut PO harian sebelumnya dihitung per cabang padahal nomor PO harus unik di semua cabang, jadi PO pertama cabang kedua bentrok dengan `PO-YYYYMMDD-0001` milik cabang pertama. Nomor urut kini dihitung dari nomor PO terbesar hari itu di semua cabang, dan bentrokan saat dua PO dibuat bersamaan dijawab 409 "silakan coba lagi", bukan 500.
- Tanggal pada nomor PO kini mengikuti WIB. Sebelumnya memakai UTC, sehingga PO yang dibuat antara pukul 00.00–07.00 WIB bernomor tanggal kemarin.
