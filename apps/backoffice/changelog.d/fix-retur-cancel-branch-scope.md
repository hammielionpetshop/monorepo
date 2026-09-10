### Fixed

- Pembatalan retur: OWNER/GM (`branchScope === 'ALL'`) kini bisa membatalkan retur cabang mana pun tanpa harus mengganti cabang aktif. Verifikasi PIN owner, pembalikan stok, dan pengembalian piutang mengikuti cabang retur itu sendiri — bukan cabang aktif operator. Sebelumnya pembatalan retur cabang lain gagal (retur "tidak ditemukan") atau, kalau lolos, membalik stok ke cabang yang salah.
- Pembatalan retur: retur yang tidak ditemukan / sudah dibatalkan kini balas 404 / 400, bukan lagi 500.
