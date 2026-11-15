# Tempat uji per jabatan

Tanggal: 11 Oktober 2026

## Masalah

Sistem dipakai banyak orang dengan jabatan dan tingkat pemahaman yang berbeda:
owner, kasir, driver, dan lainnya. Tampilan tiap jabatan berbeda. Satu alur sering
melewati beberapa jabatan, misalnya pengiriman: pembuat order, penerima, eksekutor.

Pemilik ingin memeriksa sendiri semua tampilan dan alur itu, tanpa harus keluar
dan masuk akun berulang kali.

## Yang diinginkan

1. **Tempat uji terpisah.** Salinan sistem dengan data contoh, bukan data karyawan
   asli. Apa pun yang dicoba di sana tidak memengaruhi sistem yang dipakai bekerja.
2. **Akun contoh untuk setiap jabatan**, sudah tersedia sejak tempat uji dibuat,
   lengkap dengan data contoh yang masuk akal (karyawan, jadwal, order, trip).
3. **Tombol "Lihat sebagai".** Pemilik memilih jabatan atau akun contoh dari satu
   daftar, dan tampilan langsung berganti tanpa keluar akun.
4. **Uji alur lintas jabatan.** Bisa membuka beberapa jabatan berdampingan untuk
   mengikuti satu alur dari awal sampai akhir (contoh: order dibuat, diterima,
   dikerjakan).
5. **Uji alur otomatis.** Untuk alur penting, ada tes yang menjalankan alur itu
   sebagai tiap jabatan dan memeriksa bahwa tiap jabatan hanya melihat dan bisa
   melakukan apa yang menjadi haknya.
6. **Data contoh sebanyak keadaan nyata.** Tempat uji diisi data setara minimal dua
   tahun pemakaian, supaya kecepatan bisa diukur dengan benar (PRI-15).

## Batasan yang harus dijaga

- Di **tempat uji**, "Lihat sebagai" bebas dipakai dan boleh melakukan tindakan.
- Di **sistem asli**, "Lihat sebagai" hanya untuk pemilik, hanya melihat (tidak bisa
  menyimpan atau menyetujui apa pun), selalu menampilkan tanda yang jelas di layar,
  dan setiap pemakaiannya tercatat.
  Alasannya: tindakan yang dilakukan atas nama orang lain akan tercatat seolah
  orang itu yang melakukannya, dan itu merusak catatan siapa berbuat apa.
- Tempat uji tidak boleh tersambung ke database asli.

## Syarat dari sisi desain

Hak akses harus ditentukan di **satu tempat** (lihat `docs/aturan/00-peta-modul.md`, bagian Hak akses).
Kalau tiap halaman memutuskan sendiri siapa boleh melihat apa, "Lihat sebagai" tidak
bisa dipercaya dan tes per jabatan tidak bisa ditulis.

## Kapan dikerjakan

Bersamaan dengan modul pertama (Karyawan), karena login dan hak akses dibuat di
sana. Setiap modul berikutnya menambah akun contoh, data contoh, dan tes alurnya.

## Keputusan Tahap 3B (13 Oktober 2026)

- Pemilik tidak mau memasang Docker atau alat sejenis; tempat uji berupa
  **web kedua** yang dibuka di browser seperti biasa (SIS-41).
- Alur rilis disetujui: setiap perubahan tampil dulu di tempat uji, pemilik
  mencoba sendiri, lalu bilang "rilis" dan perubahan naik ke sistem asli
  di hari yang sama.
- Di sistem asli, "Lihat sebagai" boleh memilih orang sungguhan, hanya
  melihat, untuk Pemilik dan GM (KAR-78).
- **Pemilik minta dibuatkan plan tersendiri** untuk tempat uji dan alur
  rilis ini. Dibuat di Tahap 4 bersama spec modul Karyawan (atau Tahap 5
  saat serah terima), di `../plans/`.
