# 04 — Karyawan & Akses (Langkah L2)

Sumber v3: buku `01-karyawan.md` (KAR), spec `2026-10-13-karyawan-dan-akses-spec.md` (4A),
`2026-10-13-hak-akses-desain.md`, `00-peta-modul.md` bagian Hak akses & Menu.

## 1. Tujuan

Data induk orang, cabang, jabatan, dan hak akses yang dibaca semua modul HRIS, ditambah **pintu
utama pembuatan akun** untuk semua app internal ✅.

## 2. Lingkup layar

| Layar v3 | Fase 1 | Catatan |
|---|---|---|
| KAR-L01 Masuk | **Diganti** komponen login auth terpusat (02) | |
| KAR-L02 Daftar, L03 Menunggu persetujuan | **Dihapus** | ✅ akun hanya dibuat Owner/GM |
| KAR-L04 Lupa password, L05 Pakai kode dari GM | **Masuk**, menyesuaikan AUT-13 | |
| KAR-L10 s.d. L14 Profil & Akun, ubah kontak, ubah identitas, ganti password, perangkat | **Masuk** | |
| KAR-L20 s.d. L24 Daftar Karyawan, halaman orang, penempatan, nonaktif, izin tugas lapangan | **Masuk** | |
| KAR-L25, L26 Pendaftaran Baru, Periksa pendaftar | **Diganti** layar baru "Tambah Karyawan" (bagian 3) | |
| KAR-L27 Promosi Training | **Masuk** | |
| KAR-L28 Pekerja Lepas | **Masuk** | Dipakai bongkaran (09) |
| KAR-L29 Hak Tambahan yang Aktif | **Masuk** | Hanya jenis yang relevan Fase 1 |
| KAR-L30 s.d. L33 Cabang & Jabatan, Pengaturan Jabatan, Daftar Pengecualian, Hak Akses Jabatan | **Masuk** | |
| KAR-L34, L35 Pedoman Lapor | Tidak | Menyusul bersama Panduan |
| KAR-L40 Riwayat Masuk Semua Orang | **Masuk** | Dari data `auth` |
| KAR-L41 Lihat sebagai | Tidak | ✅ menyusul |

## 3. Penyimpangan & tambahan Fase 1

### 3.1 Tambah Karyawan (pengganti pendaftaran, KAR-60)
- ✅ Hanya **Owner dan GM** yang membuat karyawan dan akun.
- Isian wajib mengikuti KAR-01 (nama, cabang, jabatan, status kerja, tanggal bergabung). Isian
  KAR-80 lainnya (nomor HP, tanggal lahir, jenis kelamin, foto diri, kontak darurat) boleh menyusul
  dan diisi karyawan sendiri. Selama belum lengkap, Beranda karyawan menampilkan pengingat. Foto diri
  dibutuhkan untuk mencocokkan foto absen.
- Akun dibuat sekaligus (atau menyusul) dengan password awal; wajib ganti saat pertama masuk.

### 3.2 Akun & Tautan (layar baru) ✅
- Owner/GM melihat setiap akun pusat beserta tautannya: **karyawan HRIS** dan **pengguna kasir**.
- Mencentang **"punya akses kasir"** → pilih role backoffice (OWNER, GM, MANAGER, KASIR, GUDANG,
  FINANCE) dan cabang tugas → pengguna kasir dibuat/diubah lewat pintu internal backoffice (AUT-11).
- 💡 Role backoffice dipilih eksplisit. Jabatan HRIS boleh memberi **saran bawaan** (pengaturan per
  jabatan), tetapi tidak menentukan sendiri.
- Menautkan akun yang sudah ada (pengguna backoffice lama) ke karyawan HRIS dilakukan manual di sini.
- Melepas tautan, menonaktifkan akses kasir, dan semua perubahan tercatat. Menonaktifkan karyawan
  (KAR-07) menonaktifkan akunnya di semua app.

### 3.3 Pasangkan Groomer & Pengantar (layar baru)
- Daftar `petshop.groomers` dipasangkan ke karyawan HRIS (pengganti pemasangan di Tarik Data Kasir v3).
- Dipakai bonus grooming & ongkir (06). Nama yang belum dipasangkan ditandai, dan bonusnya menunggu
  di Persetujuan Bonus sampai dipasangkan (bonus tidak hilang).

### 3.4 Cabang
- Cabang HRIS ditautkan ke cabang kasir (`v_cabang_kasir`). Kantor dan Gudang adalah cabang di HRIS
  walaupun mungkin tidak ada di kasir (KEH-01).
- Titik lokasi & radius milik cabang (KAR-25); QR milik Kehadiran (05).

### 3.5 Data awal ✅
- Owner mengekspor data dari database HRIS lama. Data itu dimuat **sekali** lewat skrip yang memakai
  **aturan validasi yang sama** dengan fitur import kelak, dan setiap baris ditandai "bawaan sistem
  lama".
- Di L2 yang dimuat: cabang, departemen, jabatan (SIS-26), dan karyawan (nama, kode/nomor, cabang,
  jabatan, status kerja, tanggal bergabung, nomor HP, email, rekening). Komponen gaji, sisa kasbon,
  dan saldo dana dimuat di L9.
- Skrip menolak seluruh muatan bila ada satu baris salah, dan melaporkan baris mana beserta sebabnya.

## 4. Hak akses

- Mengikuti v3 utuh: tindakan bernama di kode, pemberian per jabatan sebagai data, lingkup
  diri/cabang/departemen/semua (KAR-58, 71), batas keras KAR-72, GM setara Pemilik (KAR-67), dan
  jabatan berhak tinggi hanya diisi Pemilik/GM (KAR-74).
- Isi awal hak per jabatan: tabel `00-peta-modul.md` + rincian per modul (GAJ-46, KEH-04/14/20/37/80,
  DRV-82).
- Tindakan baru Fase 1: kelola Akun & Tautan, beri akses kasir, pasangkan groomer (Owner, GM).

## 5. Kriteria selesai

- Owner membuat karyawan + akun + akses kasir → orang itu bisa login di POS dan di HRIS dengan satu akun.
- Pengguna backoffice lama tertaut ke karyawan hasil muat data awal.
- Pindah cabang/jabatan hanya lewat riwayat bertanggal (KAR-56); nonaktif tanpa hapus (KAR-55).
- Tes hak: setiap tindakan dicoba sebagai tiap jabatan (KAR-63); batas keras KAR-72 tidak bisa dibuka.

## 6. Pertanyaan terbuka

- ❓ Daftar jabatan & departemen v3 (11 jabatan, 3 departemen) dipakai apa adanya, atau ada jabatan
  yang perlu ditambah/diubah untuk kondisi sekarang?
- ❓ Kolom apa saja yang tersedia di ekspor DB HRIS lama? (menentukan bentuk skrip muat)
