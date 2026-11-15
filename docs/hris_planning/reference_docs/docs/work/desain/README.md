# Pegangan Tampilan untuk Pembangunan

Ditetapkan pemilik 13 Oktober 2026 (CHANGELOG 153; jenis: pengganti atas
"tiap spec disertai gambar layar" di peta jalan Tahap 4).

## Keputusan

Layar **tidak digambar satu per satu**. Bentuk tampilan sudah ada sebagai
komponen baku di sistem desain; spec tiap modul cukup menulis isi layarnya, dan
sesi pembangunan menyusun layar dari komponen yang sama.

Alasan: menggambar puluhan layar per modul menghabiskan kuota, padahal isinya
hanya komponen yang sama diulang. Yang menentukan benar tidaknya sebuah layar
adalah spec (isi, langkah, tombol, pesan) dan aturan TAM, bukan gambarnya.

## Urutan pegangan saat membangun sebuah layar

Kalau dua sumber berbeda, yang di atas menang.

1. **Aturan TAM-01 s.d. 25** (`../../aturan/00-pola-baku-tampilan.md`).
2. **Spec modul** bagian 2 dan 3: layar apa, isinya apa, langkahnya, tombolnya,
   pesannya, beda antar jabatan.
3. **Sistem desain v1.0**: `Sistem Desain Hammielion (offline).html` untuk
   warna, huruf, ukuran, dan bentuk komponen.
4. **Menu v1**: `Menu dan Navigasi Hammielion (offline).html` untuk menu
   samping PC, bilah bawah handphone, layar absen, serah terima, Laporan
   Pulang, pengajuan, dan bilah "Lihat sebagai".
5. **`layar-hammielion.css`**: salinan komponen sistem desain dalam bentuk CSS
   biasa yang mudah dibaca. Kedua file "(offline)" di atas terbungkus dan sulit
   dibaca mesin; file ini jalan pintasnya. Kalau berbeda dari butir 3, butir 3
   yang benar dan file ini dibetulkan (WAJ-10).
6. **`4A-karyawan-1-masuk-dan-profil.html`**: contoh penerapan, yaitu sepuluh
   layar Karyawan (KAR-L01 s.d. L05, L10 s.d. L14) yang disusun dari komponen
   itu. Dipakai sebagai contoh cara menyusun, bukan sebagai syarat.

## Aturan untuk sesi pembangunan (Tahap 6)

1. Komponen baku dibuat **sekali**, di satu tempat, pada awal pembangunan.
   Semua halaman memakainya; tidak ada halaman yang menulis gaya sendiri untuk
   hal yang sudah ada komponennya (sejalan dengan TAM-06 dan WAJ-04).
2. Warna, huruf, jarak, dan sudut diambil dari token sistem desain, tidak
   diketik ulang sebagai angka di halaman.
3. Kalau sebuah layar butuh bentuk yang belum ada komponennya, komponen baru
   ditambahkan ke tempat yang sama dan dicatat di tabel di bawah, bukan dibuat
   khusus untuk halaman itu.
4. Setiap layar dibangun untuk handphone 360 px lebih dulu, lalu PC 1024 px ke
   atas, mode terang dan gelap. Spec bagian 2 menyebut ukuran utamanya.
5. Pemilik memeriksa tampilan pada **layar yang sudah jadi** di tempat uji,
   bukan pada gambar. Perbaikan tampilan dicatat sebagai perbaikan biasa.

## Daftar komponen baku

Nama kelas merujuk ke `layar-hammielion.css`. Di kode sungguhan, tiap baris
menjadi satu komponen.

| Komponen | Dipakai untuk | Aturan | Kelas di contoh |
|---|---|---|---|
| Token warna terang dan gelap | Semua | TAM-11 | `.terang`, `.gelap` |
| Tombol utama, garis, bahaya, mati | Aksi | TAM-13, 19 | `.b.u`, `.b.g`, `.b.bh`, `.b.m` |
| Tombol jalan keluar (Kembali, Ulangi dari awal, Batalkan) | Jalan keluar | TAM-14, WAJ-11 | `.b.k`, `.ulangi`, `.b.bg` |
| Tombol ditahan 3 detik | Yang berakibat ke uang atau status orang | TAM-15 | `.b.tahan` |
| Jendela error "OK, paham" | Semua error | TAM-01 s.d. 06 | `.tirai` + `.jendela` + `.tanda` |
| Jendela konfirmasi | Konfirmasi biasa dan 3 detik | TAM-15 | `.tirai` + `.jendela` + `.tmb` |
| Penanda langkah | Pekerjaan bertahap | TAM-07 | `.langkah`, `.seg` |
| Bilah tombol bawah | Kembali dan Lanjut di tiap langkah | TAM-07, 14 | `.bawah` |
| Pesan berhasil | Setelah terkirim: tersimpan apa, siapa berikutnya, dua jalan | TAM-17 | `.kartu` + `.bulat.s` |
| Kotak isian, pilihan, centang, kode 6 angka | Formulir; rupiah berpemisah ribuan | TAM-10 | `.f`, `.lb`, `.in`, `.pilih`, `.centang`, `.kode6` |
| Tanda simpan otomatis | Isian tidak hilang saat sinyal putus | TAM-16 | `.simpan-oto` |
| Tempat foto | Kamera atau galeri | TAM-08 | `.foto` |
| Label status (7 status) | Menunggu, Diperiksa, Disetujui, Ditolak, Dibatalkan, Dicabut, Hangus | PRI-37 | `.chip.w/.i/.s/.d/.n` |
| Kartu dan daftar rincian | Ringkasan, baris nama dan nilai | — | `.kartu`, `.dl`, `.brs` |
| Kotak catatan (info, peringatan, bahaya) | Arahan di dalam layar | — | `.kotak.i/.w/.d` |
| Kepala layar handphone | Judul dan tombol kembali | — | `.atas` |
| Bilah bawah handphone | Beranda · Absen · tombol utama jabatan · Pemberitahuan · Menu | Menu v1 (M3) | `.nav` |
| Menu samping PC 280 px dan bilah atas | Kerangka PC | Menu v1 | lihat file Menu v1 |
| Tabel per halaman dengan cari dan saring | Daftar di PC; di handphone menjadi kartu | PRI-10, TAM-12 | lihat sistem desain 3H |
| Pengingat berantai, pengumuman darurat | Antrean jendela saat membuka aplikasi | TAM-22, 24 | lihat sistem desain 3F |
| Tanda "Baru", angka penanda, nomor versi | Menu dan Beranda | TAM-20, 21 | **dibangun** (1-i-ii): `kunciBaruSaya`/`versiTerbaruSaya` (`src/server/pintu/rilis.ts`) + lencana inline di `src/app/page.tsx` |
| Isian teks panjang berjudul dengan butir dan gambar | Panduan Karyawan (BER-L10, L26) | — | **dibangun** (1-i-ii): `src/komponen/IsianPanjang.tsx` (tulis) + `src/komponen/IsiPanduan.tsx` (baca) |
| Bilah "Lihat sebagai" | Selama mode itu dipakai | KAR-78 | lihat file Menu v1 |
| Bilah "TEMPAT UJI" | Selalu, selama di tempat uji | BER-L50, L51 | **dibangun** (varian lengkap 1-k-i, "jam uji: …" ditambahkan 1-k-iii): `src/komponen/BilahTempatUji.tsx` (token `--accent`) — "sedang sebagai: …" + "jam uji: …" + tombol [Ganti akun]/[Papan uji]; isi diisi pembungkus server `src/app/BilahTempatUjiAktif.tsx` |
| Pemilih tanggal dan jam (jam uji) | Papan uji BER-L50 | BER-L50 | **dibangun** (1-k-iii): `<Isian type="datetime-local">` di `src/app/tempat-uji/JamUjiForm.tsx` (hanya maju; nilai lokal → ISO saat dikirim). Ringan, satu pemakai (tempat uji); belum dijadikan komponen tersendiri |

Komponen bertanda "lihat ..." belum disalin ke `layar-hammielion.css`;
disalin saat komponen bakunya dibangun di Tahap 6.

## File lain di folder ini

- `2026-10-13-brief-claude-design-menu.md`: brief menu, sudah dipakai (menu v1).
- `2026-10-13-brief-claude-design-karyawan.md`: brief gambar 4A, **tidak
  dipakai lagi** sejak keputusan di atas; disimpan sebagai riwayat.

## Bentuk baru dari 4B (belum ada komponennya)

Ditambahkan sebagai komponen saat dibangun (aturan 3 di atas):
bilah "TEMPAT UJI" (**dibangun**, `src/komponen/BilahTempatUji.tsx`); isian
teks panjang berjudul dengan butir dan gambar (**dibangun**, 1-i-ii, lihat
tabel di atas); tabel peringkat ringkasan error; pemilih tanggal dan jam
untuk jam uji (**dibangun**, 1-k-iii, lihat tabel di atas).

## Bentuk baru dari 4D sampai 4I (belum ada komponennya)

Dikumpulkan di 4J-5 dari bab 4.4 `specs/2026-10-14-daftar-lintas-modul.md`.
Tiap bentuk dibangun pada langkah pertama yang memakainya
(`plans/2026-10-14-urutan-pembangunan.md`; kolom langkah adalah perkiraan, sesi
pembangunan memeriksa spec yang menyebutnya).

| Bentuk | Langkah pertama |
|---|---|
| Bilah "TEMPAT UJI" (sudah di daftar 4B) | P — **selesai** (`src/komponen/BilahTempatUji.tsx`) |
| Tabel minggu dan strip tujuh hari | 2 Kehadiran — **selesai** (2-a): `src/komponen/TabelMinggu.tsx` (orang × 7 hari, sel bisa diketuk) + `src/komponen/StripHari.tsx` (strip 7 hari untuk HP) |
| Tabel rekap banyak kolom | 2 Kehadiran — **dibangun inline (2-c)** di `src/app/kehadiran/rekap/page.tsx` (baris = orang, kolom status + telat/pulang cepat/lembur, sel menautkan ke Catatan Hari). Diangkat jadi komponen baku bila dipakai ulang modul lain. |
| Kalender periode 26–25 (juga versi "tidak masuk") | 2 Kehadiran — **dibangun inline (2-d)**: grid tanggal di `src/app/saya/pilih-libur/PilihLibur.tsx` (petak bisa diketuk, tanda penuh/tutup/teman) + tabel kalender & tab "Tidak masuk" di `src/app/kehadiran/libur-cabang/LiburCabang.tsx`. Diangkat jadi komponen baku bila dipakai ulang. |
| Peta titik lokasi dan pemasang titik | 2 Kehadiran |
| Pratinjau impor | 3 Tarik Data Kasir |
| Kotak angka ringkasan | 4 Keuangan A |
| Petak cabang | 4 Keuangan A |
| Kelompok lipat | 4 Keuangan A |
| Centang banyak | 4 Keuangan A |
| Kartu trip berjalan | 6 Logistik |
| Grafik batang (KEU-L86, L88) | 9 Keuangan B |
| Kartu kriteria | 10 Kinerja |
