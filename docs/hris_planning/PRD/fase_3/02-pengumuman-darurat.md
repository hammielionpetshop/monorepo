# 02 — Pengumuman Darurat (Langkah F3-2)

Sumber v3: PRI-36; TAM-16, 22; spec Perlengkapan Bersama BER-L08, BER-L22, BER-L24, BER-L25, §4
(tabel pengumuman), §6 (Penerbit pengumuman), §10 (kejadian 24, 25), §11.

## 1. Tujuan

Mengirim **kejadian mendesak** ke semua orang atau cabang dan jabatan tertentu, misalnya
"Toko Singaparna tutup hari ini karena banjir" atau "Sistem kasir mati, catat di kertas", dan
memastikan setiap penerima melihatnya. **Bukan** untuk perubahan aturan (itu Papan, 03).

## 2. Aturan inti

- **Pengirim**: Pemilik, GM, HR.
- **Sasaran**: semua orang, atau gabungan cabang dan jabatan. Layar menyebut jumlah penerima.
- **Isi**: judul + pesan paling banyak **300 huruf** (terbaca dalam 5 detik).
- **Masa tayang**: bawaan sampai akhir hari ini; bisa diperpanjang saat mengirim.
- **Tampil**: jendela paling depan di antrean (01), saat login **dan** di layar mana pun yang sedang
  terbuka, paling lambat 1 menit; isian yang sedang diketik tidak hilang. Tombol "Sudah saya baca"
  aktif setelah **5 detik**. Satu kali per orang, lalu tersimpan di daftar (Papan, tab Berlaku
  bertanda "Darurat"; sesudah masa tayang, di Riwayat).
- **Tidak terikat jarak 7 hari** Papan (PRI-36 butir 4).
- **Tidak diubah, tidak dihapus.** Salah kirim: **Akhiri sekarang** (yang belum membaca tidak lagi
  mendapat jendelanya), lalu kirim yang benar; keduanya tercatat.
- Orang yang masuk sasaran sesudah terkirim (pindah cabang/jabatan) ikut menerima selama masih
  tayang (BER-L25).

## 3. Layar

| Layar | Menu | Siapa | Catatan |
|---|---|---|---|
| Pengumuman (BER-L22) | Kantor › Pengumuman | HR, Admin HR (lihat), Pemilik, GM | Tombol **Kirim pengumuman darurat** berwarna bahaya; daftar darurat dengan "sudah baca x dari y" |
| Kirim pengumuman darurat (BER-L24) | dari BER-L22 | Pemilik, GM, HR | 3 langkah: Isi → Sasaran & masa tayang → Periksa & Kirim (tombol ditahan 3 detik). HP dan PC |
| Siapa sudah dan belum baca (BER-L25) | dari BER-L22 | Pengirim, HR, Admin HR, Pemilik, GM | Nama, cabang, jabatan, sudah baca (kapan) / belum; saring "belum baca" |
| Jendela darurat | antrean (01) | Sasaran | Paling depan; tombol aktif 5 detik |

## 4. Mesin terjadwal

- **Penerbit pengumuman** (v3 §6, tiap 5 menit): mengakhiri pengumuman darurat yang masa tayangnya
  habis. (Dipakai juga oleh Papan untuk menerbitkan yang terjadwal, 03.)

## 5. Kriteria selesai

- Tes: sasaran cabang/jabatan, batas 300 huruf, akhiri sekarang, orang pindah ikut menerima, hak
  kirim per jabatan, bukan diri sendiri tidak relevan (pengirim boleh termasuk sasaran).
- Uji HP: kirim dari PC → jendela muncul di HP yang sedang terbuka ≤ 1 menit, di atas isian
  yang sedang diketik; tombol baru aktif setelah 5 detik; "siapa sudah baca" bertambah.

## 6. Pertanyaan terbuka

- ✅ **Di web mana saja tampil** (owner 2026-11-15): hanya di **web HRIS** (semua karyawan memakai
  HRIS di HP untuk absen, jadi kabar tetap sampai); POS/Back Office menyusul bila owner mau.
- ✅ **Tanpa notifikasi HP (push)** (owner 2026-11-15): pengirim melihat siapa yang belum membaca lalu
  menghubungi lewat WA.
- ❓ Masa tayang paling lama berapa hari? Saran 💡: 7 hari (pengaturan).
