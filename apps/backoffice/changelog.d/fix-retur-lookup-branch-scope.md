### Fixed

- Retur: OWNER/GM (`branchScope === 'ALL'`) kini bisa mencari dan memproses retur untuk transaksi cabang mana pun tanpa harus mengganti cabang aktif lebih dulu. Sebelumnya pencarian transaksi di layar Retur selalu dipaksa ke cabang aktif operator, sehingga nota milik cabang lain — termasuk mayoritas bulk sale yang dikerjakan dari Gudang — selalu balas 404 "Transaksi tidak ditemukan atau bukan milik cabang ini".
- Retur: pembalikan stok, baris `returns`, dan audit log sekarang mengikuti cabang transaksi aslinya, bukan cabang aktif operator. Sebelumnya OWNER yang meretur nota cabang lain menambah stok ke cabang aktifnya sendiri.

### Changed

- Operator non-OWNER/GM tetap hanya bisa meretur transaksi cabangnya sendiri; permintaan retur atas nota cabang lain ditolak dengan pesan yang jelas (`code: FOREIGN_BRANCH`).
