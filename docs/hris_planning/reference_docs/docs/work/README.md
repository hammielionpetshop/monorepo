# Dokumen Pekerjaan

Cara mengerjakan dan menggabung pekerjaan (branch, klaim): `aturan-kerja.md`.

Semua dokumen pekerjaan baru ditulis di folder ini.

| Kondisi | Tulis di | Nama file |
|---|---|---|
| Ada ide atau kebutuhan baru | `backlog/` | `TTTT-BB-HH-<nama-singkat>.md` |
| Sudah tahu solusinya seperti apa | `specs/` | `TTTT-BB-HH-<nama-singkat>-desain.md` |
| Siap memecah langkah pengerjaan | `plans/` | `TTTT-BB-HH-<nama-singkat>.md` |

`WIP.md` berisi status terbaru dan dibaca pertama kali oleh setiap sesi baru.

## Isi tiap dokumen

**Backlog** menjawab: apa masalahnya, siapa yang mengalaminya, dan apa yang diinginkan.
Belum membahas solusi.

**Spec** menjawab: aturan bisnisnya apa, datanya disimpan di mana dan milik modul mana,
alurnya bagaimana, tampilannya seperti apa, dan apa yang sengaja tidak dikerjakan.

Setiap spec wajib punya dua bagian ini:

- **Kejadian di lapangan.** Daftar hal yang bisa terjadi pada manusia yang memakai
  fitur itu: salah isi, salah orang, berubah pikiran, terputus di tengah, orangnya
  tidak masuk, sudah terlanjur disetujui atau dibayar. Claude mengusulkan daftarnya
  lebih dulu, pemilik menambah dari pengalaman. Tiap kejadian dijawab: sistem
  berbuat apa.
- **Jalan keluar.** Untuk setiap aksi: bisa kembali, diulang dari awal, atau
  dibatalkan? Oleh siapa, sampai kapan, dan apa akibatnya pada data lain.

Spec harus disetujui pemilik sebelum lanjut.

**Plan** menjawab: langkah pengerjaannya apa saja, urutannya, dan bagaimana tiap
langkah dibuktikan benar.

## Setelah pekerjaan selesai

1. Aturan final dipindahkan ke buku aturan modul di `docs/aturan/`.
2. `CHANGELOG.md` diisi.
3. `WIP.md` diperbarui.

Dokumen backlog, spec, dan plan dibiarkan sebagai riwayat. Kalau isinya berbeda
dengan buku aturan, yang berlaku adalah buku aturan.
