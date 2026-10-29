# Aturan Wajib

Dua belas aturan yang berlaku untuk semua pekerjaan. `CLAUDE.md` memuat versi satu
barisnya; file ini memuat isi lengkap beserta alasannya.

Kalau menemui keadaan yang tidak tertulis, pakai alasannya untuk memutuskan, lalu
sampaikan ke pemilik.

## WAJ-01. Jangan push ke main tanpa izin pemilik

Izin diberikan untuk satu perubahan, dan tidak berlaku untuk perubahan berikutnya.

*Kenapa:* yang ada di main adalah yang dipakai karyawan. Pemilik adalah penjaga
pintunya.

## WAJ-02. Perubahan database hanya lewat file migrasi di repo

Jangan pernah mengubah database langsung.

*Kenapa:* database harus selalu bisa dibangun ulang dari file di repo. Di sistem
lama, sekitar 300 perubahan tercatat di Supabase tetapi hanya 106 file ada di repo.

## WAJ-03. Satu data, satu pemilik

Jangan membuat tabel atau kolom yang menyimpan ulang data milik modul lain. Baca
dari modul pemiliknya (lihat `00-peta-modul.md`).

*Kenapa:* dua salinan pasti suatu saat berbeda, dan tidak ada yang tahu mana yang
benar. Di sistem lama, jadwal kerja disimpan di 5 tempat.

## WAJ-04. Satu rumus, satu tempat

Sebelum menulis perhitungan, cari apakah sudah ada. Kalau ada, pakai itu.
Tampilan, import, dan database tidak boleh punya salinan rumus masing-masing.

*Kenapa:* di sistem lama rumus telat ditulis di 5 tempat, sehingga mengubah satu
aturan berarti mengubah 5 tempat tanpa boleh ada yang terlewat.

## WAJ-05. Aturan bisnis tidak ditulis dengan nama orang, cabang, atau jabatan di kode

Jadikan pengaturan yang bisa diubah dari data. Kejadian khusus untuk orang
tertentu ditangani lewat daftar pengecualian (PRI-26), bukan di kode.

*Kenapa:* orang pindah, cabang bertambah. Pemilik harus bisa mengubah aturan tanpa
mengubah kode.

## WAJ-06. Tes wajib ada untuk uang, waktu yang memengaruhi uang, dan hak akses

- Setiap perhitungan uang: gaji, potongan, kasbon, upah ritase, denda.
- Setiap perhitungan waktu yang memengaruhi uang: telat, lembur, alpha.
- Setiap aturan hak akses.

Tiap tes merujuk nomor aturannya di buku aturan (contoh: `GAJ-04`). Tampilan saja
tidak wajib dites.

**Mesin pengaman hak akses** (perintah pemilik, 11 Oktober 2026). Untuk hak
akses, tes saja tidak cukup kalau hanya memeriksa yang diingat. V3 wajib punya
mesin pengaman yang masuk sebagai tiap jabatan dan mencoba semua tindakan di semua
data, lalu memastikan yang di luar batas jabatan itu ditolak. Mesin ini jalan
otomatis pada setiap perubahan, dan perubahan tidak boleh digabung kalau ada satu
saja yang lolos. Rancangannya di
`../work/backlog/2026-10-11-mesin-pengaman-hak-akses.md`.

**Mesin pengaman error** (disetujui pemilik, 11 Oktober 2026). Tiga lapis tes
jalan otomatis pada setiap perubahan, dan perubahan tidak boleh digabung kalau
ada satu saja yang gagal:

1. **Tes aturan:** tiap aturan bernomor di buku aturan ditulis sebagai "kalau
   melakukan ini, harus terjadi itu".
2. **Tes skenario:** satu rangkaian kerja dijalankan dari awal sampai akhir, lalu
   hasil akhirnya diperiksa. Contoh: absen, izin, lembur, lalu slip gajinya.
3. **Tes jalan keluar:** tiap kejadian di bagian "Kejadian di lapangan" dicoba:
   salah isi, batal, isi ulang (WAJ-11).

Error yang tetap terjadi saat sistem dipakai dicatat otomatis dan bisa dilihat
pemilik. Batasnya: mesin hanya menjaga aturan yang sudah tertulis.

*Kenapa:* tes adalah soal beserta kunci jawabannya. Tanpa tes, perubahan di satu
tempat bisa merusak hitungan gaji tanpa ada yang tahu sampai karyawan mengeluh.
Di sistem lama, akun karyawan bisa mengganti perannya sendiri menjadi Owner, dan
tidak ada yang tahu sampai strukturnya dibaca satu per satu.

## WAJ-07. Aturan yang menyangkut uang wajib punya tanggal berlaku

Aturan baru tidak boleh mengubah hasil periode yang sudah lewat.

*Kenapa:* slip gaji bulan lalu harus tetap bisa dihitung ulang dengan hasil sama.

## WAJ-08. Setiap pekerjaan selesai, tiga hal diperbarui

1. `CHANGELOG.md` diisi. Changelog wajib diperbarui pada setiap push dan setiap
   kali ada yang tayang; tidak ada push tanpa entri changelog.
2. Buku aturan modul di `docs/aturan/` diperbarui.
3. `docs/work/WIP.md` diperbarui.

Status pekerjaan hanya ditulis di tiga tempat: `docs/work/WIP.md`,
`docs/work/claims.md`, dan `CHANGELOG.md`. Jangan membuat dokumen status baru.
Dokumen yang tidak lagi dirawat diberi tanda "BASI" di baris pertamanya.

Pekerjaan yang sudah tayang tetapi belum dicoba pemilik ditulis
**"tayang, menunggu uji coba pemilik"**, bukan "selesai".

*Kenapa:* sesi berikutnya tidak punya ingatan. Yang tidak tertulis dianggap tidak
pernah terjadi. Status yang tersebar di banyak dokumen pasti ada yang usang.

## WAJ-09. Sistem lama hanya dibaca

`../hris-app/` adalah rujukan. Jangan mengubahnya dari sesi yang bekerja di folder
ini, dan jangan menyentuh database produksinya.

*Kenapa:* sistem lama masih dipakai menggaji karyawan setiap bulan.

## WAJ-10. Panduan harus sesuai kenyataan

Kalau isi `CLAUDE.md` atau buku aturan berbeda dengan keadaan repo, perbaiki pada
pekerjaan yang sama dan beri tahu pemilik.

*Kenapa:* panduan yang salah lebih berbahaya daripada tidak ada panduan, karena
akan dipercaya.

## WAJ-11. Setiap jalan masuk harus punya jalan keluar

Setiap aksi yang bisa dimulai pemakai harus punya cara untuk kembali, mengulang
dari awal, atau membatalkan yang terlanjur salah. Jalan keluarnya dirancang
bersamaan dengan aksinya, di spec, bukan ditambahkan setelah ada yang terjebak.

Sebelum spec disetujui, Claude dan pemilik membahas macam-macam kejadian di
lapangan: salah isi, salah orang, berubah pikiran, terputus di tengah, orangnya
tidak masuk, sudah terlanjur disetujui atau dibayar. Claude mengusulkan daftar
kejadiannya lebih dulu, pemilik menambah dari pengalaman.

*Kenapa:* sistem ini dipakai manusia, dan kejadiannya selalu lebih banyak dari yang
terpikir saat merancang. Aksi tanpa jalan keluar membuat karyawan terjebak dan
pekerjaan berhenti.

## WAJ-12. Setiap aturan baru ditentukan jenisnya, dan catatan dirapikan

Setiap kali ada aturan baru atau perubahan aturan, sebelum menulisnya Claude
menentukan jenisnya. Kalau tidak jelas dari perkataan pemilik, **tanya**, dengan
saran.

| Jenis | Artinya | Yang dilakukan pada catatan |
|---|---|---|
| **Pengganti** | Aturan lama tidak berlaku lagi | Aturan lama dihapus dari buku aturan, aturan baru ditulis di nomor yang sama |
| **Pelapis** | Aturan lama tetap berlaku, aturan baru menambah di atasnya | Aturan baru diberi nomor baru, dan ditulis mana yang menang kalau keduanya bertemu |
| **Pengecualian** | Aturan lama tetap berlaku, kecuali untuk keadaan tertentu | Ditulis sebagai aturan tersendiri yang merujuk aturan induknya (untuk orang tertentu: PRI-26) |

Setelah itu, pada pekerjaan yang sama:

1. Cari semua tempat yang menyebut aturan lama (buku aturan lain, spec, kamus,
   tes) dan sesuaikan. Tidak boleh ada dua tempat yang mengatakan hal berbeda.
2. Tulis tanggal mulai berlakunya (untuk aturan uang wajib, WAJ-07).
3. Catat di `CHANGELOG.md`: nomor aturan, jenisnya, dan alasannya.
4. Kalau aturan itu menyangkut karyawan, buat pengumumannya di papan perubahan
   aturan (PRI-29).

*Kenapa:* tumpang tindih lahir saat aturan baru ditambahkan tanpa memutuskan nasib
aturan lama. Sistem lama penuh aturan yang sebenarnya pengganti tetapi ditulis
sebagai tambahan, sehingga yang lama masih ikut berjalan.

## WAJ-13. Kerjakan sesederhana yang diminta; jangan menambah yang tidak diminta

Permintaan yang sederhana dikerjakan dengan cara yang sederhana. Claude **tidak**
membuat rumit teks, kode, atau langkah yang sebetulnya mudah, dan **tidak** membuat
perubahan acak yang tidak penting dan tidak diminta (kolom baru, berkas baru,
"perbaikan" sampingan, komentar bertele-tele) hanya karena kelihatan bagus.

- Kerjakan tepat apa yang diminta. Kalau menurut Claude ada tambahan yang berguna
  tetapi di luar permintaan, **tanya dulu** dengan saran singkat; jangan langsung
  dikerjakan.
- Tulisan, komentar, dan jawaban dibuat ringkas dan secukupnya, bukan panjang
  supaya terlihat lengkap.

*Kenapa:* pemilik bukan programmer dan harus bisa mengikuti setiap perubahan.
Tambahan yang tidak diminta membuat sistem sulit diperiksa, mudah salah, dan
membuang waktu. *(Keputusan pemilik 15 Oktober 2026.)*

## Kalau Claude berbuat salah

Setiap kali Claude salah karena tidak tahu sesuatu, perbaikannya dua langkah:
perbaiki kesalahannya, lalu tambahkan satu baris di buku aturan yang sesuai supaya
sesi berikutnya tidak mengulanginya. Tulis apa yang salah dan kenapa.
