### Added
- **Slip mingguan untuk driver dan kenek**: di **Gaji › Periode Slip** kini ada daftar minggu upah. Tiap minggu berisi slip mingguan orang bergaji mingguan (dibuat otomatis walau belum ada ritase) dan slip di luar slip utama untuk staf bulanan yang mendapat upah ritase. Isinya upah ritase dan upah belanja per hari, bonus, cicilan Potongan Lain, dan sisa potongan minggu lalu; bersih tidak pernah minus, sisanya dibawa ke minggu berikutnya.
- Slip mingguan memakai langkah yang sama dengan slip bulanan: tutup (mulai Jumat 10.00 untuk minggu yang berakhir Kamis), cetak, bayar, Jadwal Bayar (jatuh bayar Sabtu), Daftar Transfer, buka kembali, keberatan, dan **Pendapatan Saya** / **Slip Saya**. Nomornya `SM-[tanggal akhir minggu]-[urut]`.
- Slip tertahan bila masih ada upah ritase **belum bertarif**. Pengingat slip mingguan yang belum ditutup dikirim ke penutup slip pada hari Tombol Tutup aktif, lalu tiap pagi.
- Upah ritase yang sudah masuk slip lalu dibatalkan atau dinilai ulang dikoreksi di slip berikutnya; koreksi minus yang terpotong masuk Dana Disiplin. Ritase yang baru tercatat sesudah slip minggunya ditutup masuk slip berikutnya.
- **Pengaturan › Gaji**: hari awal minggu upah (bawaan Jumat), jam Tombol Tutup slip mingguan aktif, dan jam pengingatnya. Bila hari awal minggu diganti, minggu yang sedang berjalan dipotong sampai sehari sebelum hari awal baru, lalu minggu berikutnya mengikuti hari baru.
- Kartu Beranda **Upah minggu ini** untuk orang yang punya slip mingguan.

### Changed
- **Betulkan salah ketik** tarif kini hanya ditolak bila ritasenya sudah masuk slip yang **Dibayar**; bila slipnya baru ditutup, selisihnya masuk slip berikutnya.
- Upah Ritase, Ritase, dan Trip Saya mengikuti hari awal minggu dari pengaturan.
