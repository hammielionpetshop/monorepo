# Pola Baku Tampilan

Berlaku untuk **semua** halaman di semua modul. Wajib dibaca sebelum membuat atau
mengubah halaman apa pun.

Sumber: aturan dari pemilik berdasarkan pengalaman di lapangan (11 Oktober 2026).
Pemakai sistem ini punya tingkat pemahaman yang berbeda-beda, dan memakainya di
PC maupun handphone.

## Pesan error

**TAM-01. Error tampil di jendela tersendiri di tengah layar.**
Berlaku untuk semua error, termasuk salah mengisi formulir.

**TAM-02. Jendela error hanya tertutup dengan tombol "OK, paham".**
Tidak tertutup dengan klik atau sentuh di luar jendela, tombol Esc, tombol kembali
di handphone, geseran layar, atau hitungan waktu. Selama jendela terbuka, layar di
belakangnya tidak bisa digulir, digeser, atau diklik.
Tombol "OK, paham" baru bisa ditekan setelah 1 detik, supaya pesannya terbaca.
*Kenapa:* di lapangan sering terjadi "aduh Pak, tidak sengaja tertutup, saya bingung
carinya", lalu pekerjaan terhambat karena karyawan tidak tahu apa yang salah.

**TAM-03. Isi jendela adalah alasan dalam Bahasa Indonesia sederhana:** apa yang
gagal, kenapa, dan apa yang harus dilakukan.
Contoh: "Kasbon tidak bisa diajukan karena masih ada kasbon yang belum lunas.
Lunasi dulu atau hubungi HR."
Berlaku juga untuk isian wajib yang belum diisi: sebutkan kolom mana dan kenapa
wajib. Contoh: "Tanggal lembur belum diisi. Tanggal dibutuhkan untuk menghitung
upah lembur."

**TAM-04. Dilarang menampilkan pesan mentah dari sistem** (bahasa Inggris, kode,
nama tabel) atau pesan tanpa alasan seperti "Terjadi kesalahan".
Kalau penyebabnya memang tidak diketahui, katakan terus terang dan tampilkan satu
kode rujukan pendek.

**TAM-05. Setiap error yang muncul di layar karyawan disimpan** di satu tempat
penyimpanan (riwayat error) yang bisa dibuka pemilik.
Yang disimpan: siapa, jabatannya, kapan error muncul, kapan "OK, paham" diklik,
di halaman mana, sedang melakukan apa, pesan yang tampil, kode rujukan, rincian
teknis, dan perangkatnya (PC atau handphone).
Catatan dibuat saat error **muncul** dan dilengkapi saat "OK, paham" diklik, supaya
error tetap tercatat walaupun aplikasi tertutup sebelum tombol diklik.
Riwayat error punya ringkasan: error apa yang paling sering muncul, dan di halaman
mana.
*Kenapa:* supaya bisa diperiksa kemudian, tanpa bergantung pada ingatan karyawan.
Ringkasannya menunjukkan halaman mana yang paling membingungkan.

**TAM-06. Semua halaman memakai satu komponen jendela error yang sama.**
Tidak ada halaman yang membuat jendela error sendiri.

**TAM-23. Siapa melihat riwayat error dan mana yang perlu ditindak**
(keputusan pemilik 13 Oktober 2026, Tahap 3E; jenis: pelapis atas TAM-05).

1. Riwayat error dibuka **Pemilik dan GM** (menu Sistem).
2. Error karena salah mengisi (TAM-03) hanya disimpan, tidak mengirim
   pemberitahuan ke siapa pun.
3. Masuk daftar "perlu perhatian" GM: error yang **penyebabnya tidak
   diketahui** (yang memakai kode rujukan, TAM-04), dan error yang **sama
   dialami 3 orang atau lebih di hari yang sama**.
4. Riwayat error disimpan **12 bulan**, lalu dibuang; ringkasan per bulan
   tetap disimpan.
5. Angka 3 orang dan 12 bulan adalah pengaturan.
6. Error di daftar "perlu perhatian" ditutup GM dengan tombol **"Sudah
   ditangani"** beserta catatan; sesudah itu keluar dari daftar. Error yang
   sama muncul lagi di hari lain masuk lagi *(4B, B7; jenis: pelapis)*.

*Kenapa:* salah isi biasa tidak perlu mengganggu siapa pun; yang perlu ditindak
adalah error yang tidak dipahami dan halaman yang membingungkan banyak orang.

## Pekerjaan bertahap

**TAM-07. Satu layar, satu tugas.** Pekerjaan yang terdiri dari beberapa tahap
ditampilkan satu tahap per layar, berurutan: langkah 1, lalu 2, lalu 3. Langkah
berikutnya baru terbuka setelah langkah sebelumnya selesai. Tidak boleh ada dua
tugas dalam satu layar atau satu tab.
Setiap layar menampilkan posisinya, contoh "Langkah 2 dari 4". Kalau terputus di
tengah, pekerjaan dilanjutkan dari langkah terakhir, tidak mengulang dari awal.
*Kenapa:* kemampuan karyawan berbeda-beda. Paling sering terjadi di pengiriman,
yang memang harus dikerjakan tahap demi tahap.

## Foto

**TAM-08. Setiap tempat unggah foto ditentukan jenisnya:** "kamera langsung" (tidak
bisa memilih dari galeri) atau "kamera atau galeri". Jenisnya ditulis di buku
aturan modul, bukan diputuskan saat membuat halaman.

**TAM-09. Setiap foto mencatat kapan diambil.** Untuk kejadian yang punya foto awal
dan foto akhir (contoh: antar jemput barang di pengiriman), waktu foto pertama
dicatat sebagai waktu mulai dan waktu foto kedua sebagai waktu selesai.
Cara kerja sistem lama untuk ini digali di Bab 4 (Logistik).

## Angka, tema, dan handphone

**TAM-10. Setiap nominal rupiah memakai pemisah ribuan**, di tampilan maupun saat
diketik di kolom isian. Contoh: Rp 1.250.000.

**TAM-11. Ada mode terang dan mode gelap**, bisa dipilih pemakai, dan berlaku di
semua halaman.

**TAM-12. Setiap halaman harus rapi di PC dan di handphone.** Di handphone tidak
boleh ada tulisan, tombol, atau tabel yang saling menumpuk atau terpotong.
Halaman belum dianggap selesai sebelum diperiksa di lebar layar handphone.

## Tombol

**TAM-13. Pengaman klik ganda.** Setiap tombol yang menyimpan, mengirim, atau
menyetujui terkunci sejak diklik sampai prosesnya selesai, paling singkat 1 detik,
dan menampilkan tanda sedang memproses. Selain itu, server menolak kiriman yang
sama dua kali.
*Kenapa bukan hitungan detik saja:* di handphone dengan sinyal lambat, proses bisa
lebih lama dari 2 detik. Kalau tombol terbuka lagi setelah 2 detik, karyawan akan
mengklik lagi dan data tersimpan dua kali.

## Jalan keluar

**TAM-14. Setiap layar dan setiap aksi punya jalan keluar yang terlihat.**
Pemakai tidak boleh terjebak di satu layar atau di satu keadaan. Jalan keluar yang
tersedia ditentukan di spec fitur itu, dari tiga jenis ini:

- **Kembali**: ke langkah atau layar sebelumnya, tanpa kehilangan isian.
- **Ulangi dari awal**: membuang isian dan memulai lagi dari langkah 1. Dipakai
  untuk pekerjaan bertahap yang belum dikirim.
- **Batalkan**: untuk yang sudah terlanjur dikirim atau disetujui tetapi salah.

Bentuk, warna, dan letak tombolnya diserahkan ke perancang supaya enak dipandang,
dengan syarat: seragam di semua halaman, dan tombol yang membatalkan atau membuang
isian tampil berbeda dari tombol utama supaya tidak tertekan tanpa sengaja.

Jalan keluar dari jendela error tetap satu, yaitu tombol "OK, paham" (TAM-02).
*Kenapa:* sistem ini dipakai manusia. Salah isi, salah pilih, dan berubah pikiran
pasti terjadi, dan karyawan harus bisa memperbaikinya sendiri tanpa menunggu
bantuan.

## Konfirmasi dan pemberitahuan yang berakibat

**TAM-15. Tombol pada konfirmasi yang berakibat ditahan 3 detik.**
Berlaku untuk setiap jendela konfirmasi atau pemberitahuan yang menyangkut uang
atau akibat bagi karyawan: denda, potongan, pengajuan kasbon, persetujuan,
pembayaran, pembatalan, dan sejenisnya. Diartikan secara luas.

- Tombolnya (OK, Setuju, Lanjutkan) tidak bisa ditekan selama 3 detik pertama,
  dan menampilkan hitungan mundur supaya pemakai tahu harus menunggu.
- Isinya menyebut akibatnya dengan angka yang jelas.
  Contoh: "Anda terlambat 25 menit. Denda Rp 20.000 akan dipotong dari gaji."
- Isinya selalu ditutup dengan arahan: apa yang bisa dilakukan supaya tidak
  terkena lagi, dan kepada siapa harus bertanya (HRD atau rekan kerja).
  Contoh: "Kalau ada alasan yang sah, segera hubungi HRD. Supaya tidak terpotong
  lagi, absen sebelum jam masuk."
- **Pengecualian** (12 Oktober 2026, KEU-30):
  tombol "OK, catat" di layar Catatan Cepat pemilik uang tidak ditahan 3
  detik, karena catatan itu belum berakibat ke siapa pun dan masih bisa
  dikoreksi sebelum diperiksa. Gantinya nominal ditampilkan besar beserta
  tulisan terbilangnya. Tombol "Terima" setoran tetap ditahan.

*Kenapa:* dengan harapan karyawan membaca dulu sebelum menekan, dan tahu harus
bertanya ke siapa, bukan menekan OK lalu kaget saat gajinya terpotong.

Error biasa yang tidak menyangkut uang atau akibat (contoh: kolom wajib belum
diisi) memakai jeda 1 detik, bukan 3 detik (lihat TAM-02).

## Sinyal, pesan berhasil, dan tombol

**TAM-16. Tahan sinyal buruk.** Isian formulir tidak hilang kalau koneksi putus
atau halaman tertutup. Foto yang gagal terkirim dikirim ulang otomatis. Selalu ada
tanda yang jelas: "sedang mengirim", "terkirim", atau "belum terkirim".
*Kenapa:* driver di jalan sering kehilangan isian, atau mengira sudah terkirim
padahal belum.

**TAM-17. Setelah berhasil, tampilkan pesan yang jelas:** apa yang tersimpan, dan
siapa yang harus bertindak berikutnya.
Contoh: "Pengajuan izin terkirim. Menunggu persetujuan kepala toko."
*Kenapa:* karyawan yang ragu akan mengulang atau bertanya.

**TAM-18. Foto dikecilkan otomatis sebelum dikirim**, tanpa mengurangi keterbacaan.
*Kenapa:* menghemat kuota karyawan, mempercepat kiriman, dan menghemat penyimpanan.

**TAM-19. Kata pada tombol seragam di semua halaman**, diambil dari kamus istilah.
Satu tindakan, satu kata. Di handphone, tombol cukup besar untuk jari dan tidak
berdempetan.

**TAM-20. Nomor versi terlihat di layar, dan changelog bisa dibaca dari dalam
aplikasi.**
*Kenapa:* supaya pemilik dan karyawan tahu versi mana yang sedang dipakai dan apa
yang baru berubah.

## Tanda fitur baru

**TAM-21. Setiap tambahan baru diberi tanda "Baru" tepat di tempatnya:** di menu,
dan juga di kotak, kolom, tab, atau tombol yang baru di dalam halaman. Tanda itu
tampil 7 hari sejak tayang, lalu hilang sendiri.
*Kenapa:* supaya jelas apa yang baru, bukan hanya menunya. Karyawan tidak perlu
membaca changelog untuk menyadari ada yang berubah.
Sumber: permintaan pemilik di project kasir (11 Oktober 2026).

## Pengingat berantai

**TAM-22. Pemberitahuan penting muncul berurutan, satu jendela per butir**
(permintaan pemilik 13 Oktober 2026, Tahap 3D), seperti pop up di game. Yang
tampil di layar **selalu hanya satu jendela**. Jendela itu hanya tertutup dengan
tombol **"OK, sudah baca"**, yang baru aktif setelah **1 detik** (pengumuman
darurat 5 detik, PRI-36). Setelah ditutup, jendela berikutnya muncul.

1. **Urutan:** pengumuman darurat, lalu perubahan aturan dari Papan (PRI-35),
   lalu pengingat tugas penting.
2. **Layar absen tidak pernah terhalang:** di layar absen antrean ditunda sampai
   absennya selesai, lalu langsung muncul.
3. **Tidak ada jendela ringkasan.** Semua pemberitahuan dalam antrean muncul
   satu per satu sampai habis (penegasan pemilik 13 Oktober 2026; jenis:
   pengganti atas batas 5 jendela yang semula disetujui di E3).
4. **Pengingat tugas** muncul lagi sekali sehari, saat pertama membuka aplikasi
   hari itu, **sampai urusannya beres**, lalu hilang sendiri. Pengumuman cukup
   dibaca sekali.
5. Tidak semua pemberitahuan masuk antrean. Daftar pengingat yang masuk
   ditetapkan per modul di spec Tahap 4; yang biasa cukup di Beranda dan angka
   penanda menu.

*Kenapa:* pemberitahuan penting yang hanya ditaruh di Beranda mudah terlewat,
misalnya slip yang lupa ditandai Dibayar (GAJ-59). Satu jendela pada satu waktu
dan jeda 1 detik menjaga supaya orang benar-benar membaca, bukan menekan OK beruntun.

**TAM-24. Pegangan memilah pemberitahuan** (keputusan pemilik 13 Oktober 2026,
Tahap 3E; jenis: pelapis atas TAM-22 butir 5). Pemberitahuan masuk antrean
berantai hanya kalau:

1. ada batas waktu yang membuat uang atau hak hilang kalau terlewat (lembur
   hangus, denda, slip tertahan, gaji bisa mundur), atau
2. ada orang lain yang menunggu keputusannya (pengajuan menunggu lebih dari
   1 hari, PRI-37), atau
3. berupa pengumuman (PRI-35, PRI-36).

Selain itu cukup tampil di Beranda dan angka penanda menu. Daftar per modul
disusun di spec Tahap 4 dengan pegangan ini.

*Kenapa:* kalau semua pemberitahuan menjadi jendela, orang terbiasa menekan OK
tanpa membaca, dan pemberitahuan yang penting ikut terlewat.

**TAM-25. Tiga tingkat pemberitahuan dan cara pengelompokannya** (keputusan
pemilik 13 Oktober 2026, Tahap 4B; jenis: pelapis atas TAM-22 butir 4 dan
TAM-24). Semua modul mengirim lewat tiga pintu yang sama:

1. **Antrean berantai** (TAM-22): hanya yang lolos TAM-24. Butirnya juga
   selalu tampil di "perlu perhatian", supaya tetap bisa ditemukan sesudah OK.
2. **Perlu perhatian** (Beranda dan angka penanda menu): pekerjaan yang
   menunggu orang itu. **Hilang sendiri** saat urusannya beres; tidak ada
   tombol menutup.
3. **Pemberitahuan** (lonceng): kabar yang cukup diketahui. Ditandai terbaca
   saat dibuka; disimpan 90 hari.
4. **Pengingat tugas dikelompokkan per jenis urusan:** satu jendela menyebut
   jumlah dan yang paling lama (contoh: "Ada 6 klaim lembur menunggu
   keputusan Anda, paling lama 2 hari"). Jendela tetap muncul satu per satu
   dan tidak ada jendela ringkasan seluruh antrean (TAM-22 butir 3 tetap).
   Pengumuman dan pengingat pribadi karyawan (batas waktu miliknya sendiri)
   tetap satu jendela per butir.

*Kenapa:* penyetuju dengan belasan pengajuan menunggu akan menekan OK tanpa
membaca kalau tiap pengajuan satu jendela (alasan TAM-24).
