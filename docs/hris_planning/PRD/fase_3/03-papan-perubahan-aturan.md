# 03 — Papan Perubahan Aturan (Langkah F3-3)

Sumber v3: PRI-29, PRI-35, PRI-40 butir 2, WAJ-07; spec Perlengkapan Bersama BER-L08, L09, L22, L23,
L25, §4, §6, §10 (kejadian 18 s.d. 23, 35), §11; KIN-46 (aturan dari rapat diumumkan di sini).

## 1. Tujuan

Setiap perubahan aturan yang menyangkut karyawan (tarif, denda, potongan, jam kerja, batas waktu)
diumumkan **di satu papan**, dalam bahasa sehari-hari, **sebelum berlaku**, hanya kepada yang
terkena, dan pemilik bisa melihat siapa yang belum membaca. Alasan owner (11 Oktober 2026): aturan
yang berubah tanpa diumumkan terasa tidak adil, walaupun isinya benar.

Papan **berbeda** dari "Apa yang baru": Apa yang baru = perubahan **sistem**; Papan = perubahan
**aturan perusahaan**.

## 2. Aturan inti (rincian di v3)

- **Isi**: judul, **sebelumnya**, **sekarang**, **mulai berlaku**, **harus bertanya ke siapa**.
- **Penulis**: HR, Pemilik, GM (Admin HR boleh menyiapkan konsep). Yang **menyangkut uang** baru
  tampil ke karyawan sesudah disetujui **Pemilik atau GM**; yang lain boleh langsung terbit.
- **Sasaran** diusulkan sistem dari pengaturan yang diubah (tarif rute → driver dan kenek; jam kerja
  cabang → orang di cabang itu); penulis boleh menyesuaikan. Hanya sasaran yang melihat.
- **Dua tanggal wajib**: jadwal terbit dan tanggal berlaku. Jarak paling sedikit **7 hari** untuk
  perubahan yang merugikan atau mengubah cara hitung, **1 hari** untuk yang murni menguntungkan.
  Tidak pernah berlaku di hari terbit. Kedua angka adalah pengaturan.
- **Belum dibaca**: masuk antrean berantai (01) dan tetap di paling atas Beranda sampai "Sudah saya
  baca". Absen dan pekerjaan lain **tidak dikunci**.
- **Tidak diubah setelah terbit**: **Ralat** (pengumuman baru menggantikan, yang lama bertanda
  "Diralat", semua sasaran membaca lagi) atau **Tarik** (hanya sebelum berlaku, alasan wajib).
  Sudah berlaku: buat perubahan aturan baru.
- **Riwayat**: aturan lama tetap bisa dilihat beserta masa berlakunya.

## 3. Layar

| Layar | Menu | Siapa | Catatan |
|---|---|---|---|
| Papan Perubahan Aturan (BER-L08) | Panduan › Papan Perubahan Aturan | Semua (hanya yang mengenai dirinya) | Tab **Berlaku** dan **Riwayat**; belum dibaca di atas; darurat yang masih tayang ikut tampil |
| Rincian pengumuman (BER-L09) | dari L08, Beranda, jendela antrean | Sasaran | Tombol **Sudah saya baca** (sekali, tercatat kapan); tanda "Diralat" + tautan |
| Pengumuman (BER-L22) | Kantor › Pengumuman | HR, Admin HR, Pemilik, GM | Tab Konsep, Menunggu persetujuan, Terjadwal, Terbit, Ditarik |
| Tulis perubahan aturan (BER-L23) | dari L22 dan dari layar ubah pengaturan | Penulis | 4 langkah: Isi → Sasaran → Dua tanggal → Periksa; Simpan sebagai konsep; Terbitkan / Jadwalkan / Kirim untuk disetujui |
| Siapa sudah dan belum baca (BER-L25) | dari L22 | Penulis, HR, Admin HR, Pemilik, GM | Sama dengan pengumuman darurat |
| Putuskan pengumuman uang | Persetujuan (Mesin Pengajuan) | Pemilik, GM | 💡 memakai Mesin Pengajuan yang sudah ada sebagai jenis baru "Pengumuman perubahan aturan"; tidak memutuskan tulisannya sendiri (KAR-72) |

## 4. Wajib umumkan saat pengaturan diubah (PRI-35 butir 2)

- Daftar pengaturan HRIS sudah punya tanda **`mustAnnounce`** per pengaturan. Saat pengaturan
  bertanda itu disimpan, layar langsung membuka **Tulis perubahan aturan** dengan "sebelumnya" dan
  "sekarang" terisi dari nilai lama dan baru; penulis merapikan bahasanya.
- Perubahan baru tersimpan kalau pengumumannya diisi, **atau** ditandai "tidak perlu diumumkan"
  dengan alasan (tercatat).
- Tanggal berlaku pengumuman **dikunci sama** dengan tanggal berlaku pengaturannya.
- **Menarik** pengumuman yang lahir dari perubahan pengaturan **ikut membatalkan** perubahan itu.
- Pengumuman uang yang belum disetujui sampai jadwal terbit lewat: tidak terbit, jadwal dan tanggal
  berlaku bergeser, pengaturannya belum berubah (v3 kejadian 19).
- Spec F3-3 memeriksa ulang **daftar pengaturan mana yang bertanda `mustAnnounce`** (sekarang baru
  sebagian kecil bertanda ya) dan mengusulkan isinya ke owner.

## 5. Mesin terjadwal

- **Penerbit pengumuman** (tiap 5 menit, sama dengan 02 §4): menerbitkan yang jadwal terbitnya tiba;
  yang terbit masuk antrean sasarannya.

## 6. Kriteria selesai

- Tes aturan: jarak 7/1 hari ditolak bila kurang; tidak berlaku di hari terbit; pengumuman uang
  oleh HR menunggu persetujuan; ralat meminta semua membaca lagi; tarik ikut membatalkan pengaturan;
  orang pindah cabang ikut menjadi sasaran; sasaran hanya melihat yang mengenai dirinya.
- Uji owner: ubah satu tarif contoh di staging → draf pengumuman muncul terisi → setujui → terbit
  sesuai jadwal → karyawan uji mendapat jendela → "siapa belum baca" berkurang.

## 7. Pertanyaan terbuka

- ❓ **Siapa yang diterapkan "wajib umumkan"?** Hanya pengaturan HRIS (gaji, potongan, tarif ritase,
  jam kerja, batas waktu), atau juga pengaturan di Back Office yang mengenai karyawan (misalnya
  aturan minus kas kasir)? Saran 💡: **HRIS saja** di Fase 3.
- ❓ Karena HR dirangkap GM, pengumuman uang yang ditulis GM **langsung terbit**. Apakah owner ingin
  tetap menyetujui pengumuman uang buatan GM? Saran 💡: tidak, sesuai v3 (GM penyetuju sah).
- ❓ Perlukah pengumuman awal massal saat HRIS pertama rilis ("aturan yang berlaku mulai hari ini")?
  Saran 💡: tidak lewat Papan; cukup Panduan Karyawan (04), karena Papan untuk **perubahan**.
