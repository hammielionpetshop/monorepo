# Aturan Kerja

Cara mengerjakan satu pekerjaan dari awal sampai tayang, dan cara beberapa
pekerjaan berjalan bersamaan tanpa bertabrakan.

Isi tiap dokumen pekerjaan (backlog, spec, plan) ada di `README.md`.

## Alur satu pekerjaan

```
backlog → spec (disetujui pemilik) → plan → klaim → kerjakan di branch → tes
        → disetujui pemilik → push → tayang, menunggu uji coba pemilik → selesai
```

- Perubahan kecil (label, tombol, salah ketik) tidak perlu tiga dokumen; cukup
  dikerjakan dan dicatat di changelog.
- Aturan di buku aturan diganti di tempat: aturan lama dihapus, aturan baru
  ditulis. Riwayatnya dicatat di `CHANGELOG.md`, bukan menumpuk di buku aturan.
- "Selesai" baru berlaku setelah pemilik mencobanya.

## Ukuran pekerjaan dan ganti sesi

Berlaku sekarang, di folder ini maupun di project baru.

**KER-11. Setiap pekerjaan disebut ukurannya sebelum dimulai, dan pekerjaan besar
dipecah.**

| Ukuran | Tandanya | Cara mengerjakan |
|---|---|---|
| **Kecil** | Satu atau dua berkas, tidak ada keputusan baru | Langsung dikerjakan |
| **Sedang** | Beberapa berkas, selesai dalam satu sesi | Dikerjakan dalam satu sesi |
| **Besar** | Tidak selesai dalam satu sesi, atau menyentuh banyak modul | Dipecah menjadi bagian. Tiap bagian berukuran sedang dan dikerjakan dalam satu sesi tersendiri |

Claude menyebut ukurannya di awal. Untuk pekerjaan besar, Claude menuliskan daftar
bagiannya lebih dulu dan menunggu persetujuan pemilik sebelum mulai.

**KER-12. Setiap satu pekerjaan atau satu bagian selesai, Claude menutup sesi
dengan tiga langkah:**

1. **Simpan.** Hasil dan keputusan ditulis ke dokumen (WAJ-08), dan
   `docs/work/WIP.md` diperbarui: apa yang selesai, apa langkah berikutnya, dan apa
   yang masih menunggu jawaban pemilik. Hal yang berlaku lintas sesi dan tidak
   tertulis di dokumen disimpan ke memory.
2. **Minta ganti sesi.** Claude meminta pemilik mengetik `/clear`.
3. **Beri kata kunci** untuk ditempel di sesi berikutnya.

Kata kunci untuk project ini: **`lanjut v3`**

Sesi yang menerima kata kunci itu membaca `CLAUDE.md` dan `docs/work/WIP.md` di
folder ini, lalu mengerjakan langkah berikutnya yang tertulis di sana.

**KER-13. Setiap usulan dan pertanyaan ditanyakan di percakapan, bukan lewat
dokumen.** Claude mengetik usulannya lengkap di percakapan, dan pemilik menjawab
langsung di sana. Claude tidak meminta pemilik membuka file untuk membaca usulan
atau mengisi jawaban. Dokumen hanya menjadi tempat **mencatat** usulan dan
jawabannya setelah dibahas.

*Kenapa:* pemilik bekerja dari percakapan. Usulan yang hanya ditulis di dokumen
tidak terbaca dan tidak terjawab (keputusan pemilik, 11 Oktober 2026).

**KER-14. Setiap pertanyaan dijelaskan maksudnya untuk apa, kalau perlu dengan
contoh sederhana.** Tiap pertanyaan atau usulan memuat tiga hal: (1) apa yang
ditanyakan; (2) maksud dan tujuannya, yaitu masalah apa yang mau diselesaikan dan
apa akibatnya kalau dijawab ya atau tidak; (3) contoh sederhana dari kejadian
sehari-hari di toko atau gudang, kalau maksudnya belum jelas tanpa contoh.
Pertanyaan yang hanya berisi istilah atau nomor aturan tidak boleh diajukan.

Tiap pertanyaan juga diberi **tanda jenisnya**, supaya pemilik tahu seberapa
dalam harus memikirkannya:

- **Cukup setuju atau tidak.** Claude sudah punya saran yang diturunkan dari
  keputusan sebelumnya; pemilik hanya memastikan. Jawaban "ok" sudah cukup.
- **Butuh pandangan Bapak.** Menyangkut cara kerja di lapangan atau aturan
  bisnis yang hanya pemilik yang tahu. Claude tidak bisa memutuskan sendiri.

Pertanyaan jenis kedua ditaruh paling atas dan jumlahnya dibuat sesedikit
mungkin. Pertanyaan jenis pertama boleh dijawab sekaligus ("setuju semua").

*Kenapa:* pemilik hanya bisa memberi jawaban yang tepat kalau paham apa yang
sedang diputuskan. Kata pemilik: "agar hasilnya maksimal" (11 Oktober 2026).

Claude tidak meminta ganti sesi di tengah pekerjaan yang belum disimpan, dan tidak
melanjutkan ke pekerjaan berikutnya di sesi yang sama kecuali pemilik memintanya.

*Kenapa (permintaan pemilik, 11 Oktober 2026):* sesi yang panjang memakan banyak
token karena seluruh percakapan dibaca ulang setiap giliran. Kalau semua yang
penting sudah ada di dokumen, sesi baru bisa melanjutkan tanpa kehilangan apa pun.

## Branch, worktree, dan klaim

Berlaku di project baru, sejak kode mulai ditulis (Tahap 6). Di folder ini belum
ada kode, jadi yang sudah berjalan baru papan klaim.

**KER-01. Satu pekerjaan, satu branch.** Tidak ada pekerjaan yang dikerjakan
langsung di main. Nama branch: `fitur/<nama-singkat>` atau
`perbaikan/<nama-singkat>`.

**KER-02. Satu branch, satu worktree** (folder kerja terpisah) kalau ada lebih
dari satu pekerjaan yang berjalan bersamaan. Kalau hanya satu pekerjaan, branch
saja cukup.

**KER-03. Klaim dulu sebelum mulai.** Catat pekerjaan di `claims.md`, dan hapus
barisnya setelah selesai. Kalau pekerjaan atau filenya sudah diklaim, berhenti dan
tanya pemilik.

**KER-04. Klaim ditulis di main lebih dulu, baru membuat branch.**
*Kenapa:* klaim yang ditulis di branch sendiri tidak terlihat sesi lain sampai
digabung, yaitu saat tabrakannya sudah terjadi.

**KER-05. Perubahan database bergiliran.** Hanya satu pekerjaan yang boleh
mengubah database dalam satu waktu (lihat `claims.md`).

**KER-06. Tiap worktree memakai database percobaan sendiri**, tidak pernah
database yang dipakai karyawan.

**KER-07. Pekerjaan dibagi per modul, bukan per lapisan.** Satu pekerjaan memegang
tampilan, server, dan data satu modul. Membagi "semua tampilan" dan "semua server"
ke dua pekerjaan pasti bertabrakan.

**KER-08. Branch kecil dan cepat digabung.** Branch yang hidup lama akan
bertabrakan dengan semua pekerjaan lain.

**KER-09. Berkas magnet hanya ditambah seperlunya**, tidak sekalian dirapikan.
Berkas magnet adalah berkas yang disentuh hampir semua pekerjaan, seperti menu dan
daftar hak akses. Daftarnya ditulis di `claims.md`.

**KER-10. Changelog potongan.** Setelah ada lebih dari satu pekerjaan berjalan
bersamaan, tiap pekerjaan menulis changelog di berkas potongannya sendiri, dan
potongan digabung ke `CHANGELOG.md` saat rilis. Sebelum itu, satu `CHANGELOG.md`
cukup.
