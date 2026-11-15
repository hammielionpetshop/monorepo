# Brief Claude Design: Karyawan dan Akses (Tahap 4A)

> **TIDAK DIPAKAI LAGI** sejak 13 Oktober 2026 (CHANGELOG 153): layar tidak
> digambar satu per satu, melainkan dibangun dari komponen baku. Pegangannya
> `README.md` di folder ini. File ini disimpan sebagai riwayat.

Tanggal: 13 Oktober 2026
Dipakai: ditempel di web Claude Design oleh pemilik. Jawaban A1 s.d. A10 sudah
dicatat di spec (13 Oktober 2026), jadi brief ini siap dipakai.
Sumber: `../specs/2026-10-13-karyawan-dan-akses-spec.md` bagian 2 dan 3.
Pilih **Sistem Desain Hammielion v1.0** saat membuat desain ini, dan pakai menu
v1 yang sudah disetujui.

---

## Teks yang ditempel ke Claude Design

Salin mulai dari garis ini sampai akhir file.

---

Tolong buatkan layar-layar modul **Karyawan dan Akses** untuk aplikasi HRIS
Hammielion, memakai **Sistem Desain Hammielion v1.0** dan menu v1 yang sudah
ada. Semua tulisan dalam Bahasa Indonesia. Mode terang saja, kecuali disebut.

### Aturan yang wajib diikuti (sudah ada di sistem desain)

1. Error selalu di jendela tengah yang hanya tertutup dengan "OK, paham".
2. Satu layar satu tugas. Pekerjaan bertahap ditulis "Langkah 2 dari 4", dengan
   tombol **Kembali** dan **Ulangi dari awal** yang terlihat.
3. Tombol yang berakibat ke gaji atau status orang memakai jendela konfirmasi
   dengan tombol yang ditahan 3 detik (hitungan mundur) dan menyebut akibatnya.
4. Di handphone tidak ada yang terpotong dan tidak ada geser ke samping.
5. Tombol membatalkan atau membuang isian tampil berbeda dari tombol utama.

### Yang tolong digambar

Kode di depan nama layar tolong ditulis kecil di pojok gambar, supaya mudah
dirujuk.

**A. Masuk dan daftar (handphone)**

1. **KAR-L01 Masuk** (handphone **dan** PC): email, password dengan ikon mata,
   centang "Jangan ingat saya (PC bersama)", tombol Masuk, tautan "Lupa
   password" dan "Belum punya akun? Daftar". Tambah satu gambar keadaan **salah
   5 kali**: tombol Masuk mati dengan hitungan mundur "Coba lagi dalam 4:52".
2. **KAR-L02 Daftar**, empat layar:
   - Langkah 1 dari 4 Akun: email, password, ulangi password.
   - Langkah 2 dari 4 Data diri: nama lengkap, nomor HP, tanggal lahir, jenis
     kelamin, tanggal mulai bekerja (catatan kecil: "Akan dicocokkan HR").
   - Langkah 3 dari 4 Data lain: foto diri dan kontak darurat (nama, hubungan,
     HP) bertanda wajib; alamat, rekening (bank, nomor, nama pemilik), tempat
     lahir, agama, status nikah, jumlah tanggungan, pendidikan bertanda "boleh
     dikosongkan".
   - Langkah 4 dari 4 Periksa: ringkasan dan tombol Kirim.
3. **KAR-L03 Menunggu persetujuan**: dua keadaan, "Menunggu persetujuan HR" dan
   "Ditolak" dengan alasan dan tombol "Daftar ulang".
4. **KAR-L04 Lupa password**: langkah 1 (email, HP, tanggal lahir; contoh error
   "Tanggal lahir tidak cocok"), keadaan jeda setelah salah 3 kali ("Hubungi GM
   untuk meminta kode", tombol "Saya punya kode dari GM"), langkah 2 (password
   baru dengan peringatan "Catat password ini di tempat aman").
5. **KAR-L05 Pakai kode dari GM**: email, kode 6 angka, password baru.

**B. Profil saya (handphone)**

6. **KAR-L10 Profil & Akun**: daftar kartu: foto dan nama; Penempatan (cabang,
   jabatan, status kerja, tanggal bergabung, tautan Riwayat); Kontak dan foto;
   Data identitas (rekening disamarkan "•••• 4821", tanda "Menunggu HR");
   Password; Perangkat dan riwayat masuk; Tampilan (terang/gelap). Gambar juga
   versi **mode gelap**.
7. **KAR-L11 Ubah kontak dan foto**.
8. **KAR-L12 Ubah data identitas**: tiap kolom menampilkan nilai lama di
   samping nilai baru; catatan "Data lama tetap dipakai sampai HR menyetujui".
   Kalau rekening diganti, muncul tempat foto wajib "Foto buku tabungan atau
   kartu ATM".
9. **KAR-L13 Ganti password**.
10. **KAR-L14 Perangkat dan riwayat masuk**: daftar perangkat dengan tanda
    "perangkat ini", tombol "Keluarkan dari semua perangkat lain", riwayat masuk.

**C. Kantor › Karyawan (PC)**

11. **KAR-L20 Daftar Karyawan**: pencarian, saring (cabang, jabatan, status
    kerja, aktif), tabel dengan tanda kecil di baris ("Training: waktunya
    dinilai", "7 hari tanpa kabar", "Ubah data menunggu", "Belum ada
    rekening"), pembagian halaman.
    Tambah satu gambar kecil versi **Kepala Gudang**: kolom hanya nama, cabang,
    jabatan, izin menyetir, izin kenek.
12. **KAR-L21 Halaman orang**: kepala (foto, nama, kode, cabang, jabatan,
    status, aktif), kartu Data diri, Penempatan, Status, Izin tugas lapangan,
    Akun (tombol "Keluarkan dari semua perangkat", "Buat kode lupa password"),
    Pengecualian, Hak tambahan. Tombol "Lihat sebagai" di kepala.
13. **KAR-L22 Catat perubahan penempatan**, empat langkah: pilih jenis (pindah
    cabang, ganti jabatan, ganti status kerja, jabatan tambahan); isi; tanggal
    berlaku dan alasan; periksa dengan kalimat akibat ("Rina pindah dari Toko
    Pusat ke Toko Cikarang mulai 1 November 2026...") dan tombol Simpan ditahan
    3 detik.
14. **KAR-L23 Nonaktifkan**, tiga langkah: tanggal dan alasan; cara berhenti
    ("dengan pemberitahuan sebulan" / "tanpa pemberitahuan sebulan" — untuk HR
    tertulis "usulkan ke pemilik"); periksa dengan akibat dan tombol ditahan 3
    detik.
15. **KAR-L24 Izin tugas lapangan**: dua sakelar dengan pemberi dan tanggal;
    untuk jabatan Driver tertulis "Otomatis (jabatan Driver)".
16. **KAR-L25 Pendaftaran Baru** dan **KAR-L26 Periksa pendaftar** (tiga
    langkah: data pendaftar dengan tombol Tolak; tetapkan cabang, jabatan,
    status kerja, tanggal bergabung yang dicocokkan; periksa dan Setujui
    ditahan 3 detik).
17. **KAR-L27 Promosi Training**: daftar dengan tombol Setujui dan Tunda;
    jendela konfirmasi Setujui ("Status Rina menjadi Karyawan dan gajinya
    menjadi Gaji Standar mulai 26 November 2026"); isian Tunda (alasan, tanggal
    nilai lagi).
18. **KAR-L28 Pekerja Lepas**: daftar nama dan HP, tombol Tambah.
19. **KAR-L29 Hak Tambahan yang Aktif**: daftar dengan sisa hari ("berakhir
    2 hari lagi"), tombol Perpanjang dan Cabut; langkah "Beri hak tambahan".

**D. Pengaturan › Karyawan (PC)**

20. **KAR-L30 Cabang & Jabatan**: daftar cabang (dengan titik lokasi di peta
    kecil), departemen, jabatan (dengan tanda "berhak tinggi").
21. **KAR-L31 Pengaturan Jabatan**: tabel jabatan × tanda (diabsen, kena telat,
    dapat lembur, kompensasi libur, libur tetap, wajib absen istirahat, penjaga
    cabang, slip utama, ikut tanggung kehilangan, gaji hanya terlihat Pemilik
    dan GM, terhitung jumlah karyawan, tombol utama handphone). Satu sel
    bertanda "Usulan menunggu". Langkah mengubah: nilai baru, tanggal berlaku,
    alasan, periksa ("8 orang berjabatan Kasir terkena").
22. **KAR-L32 Daftar Pengecualian**: daftar yang berlaku dengan "tinjauan
    berikutnya"; langkah Tambah; jendela pengingat tinjauan dengan tombol
    "Masih perlu" dan "Hentikan".
23. **KAR-L33 Hak Akses Jabatan**: pilih jabatan; daftar tindakan per modul
    dengan pilihan lingkup (tidak ada · diri sendiri · cabangnya ·
    departemennya · semua), yang berubah disorot; layar periksa sebelum →
    sesudah; contoh jendela error batas keras ("HR tidak bisa diberi hak
    mengubah jabatannya sendiri"). Jabatan GM tertulis "mengikuti Pemilik".
24. **KAR-L35 Pedoman Lapor (ubah)** dan **KAR-L34 Pedoman Lapor (baca,
    handphone)**.

**E. Sistem (PC)**

25. **KAR-L40 Riwayat Masuk Semua Orang**: tabel dengan saring orang, jenis,
    tanggal.
26. **KAR-L41 Lihat sebagai**: pilih orang; lalu layar Beranda kasir dengan
    **bilah mencolok di atas** "Sedang melihat sebagai: Rina (Kasir, Toko
    Pusat) · Hanya melihat · [Keluar]", di PC dan handphone.

Nama, tanggal, dan angka di gambar hanya contoh.

---

## Catatan untuk pemilik (tidak perlu ditempel)

- Jawaban A1 s.d. A10 sudah masuk; brief ini siap ditempel.
- Boleh dikerjakan bertahap per kelompok (A, B, C, D, E) kalau terlalu banyak
  sekaligus.
- Setelah selesai, unduh hasilnya ke `docs/work/desain/` seperti sistem desain
  dan menu, lalu ketik `lanjut v3`; sesi itu memeriksa gambarnya (4A sesi 2).
- Selama Bapak menggambar, sesi berikutnya boleh menulis spec teks 4B.
