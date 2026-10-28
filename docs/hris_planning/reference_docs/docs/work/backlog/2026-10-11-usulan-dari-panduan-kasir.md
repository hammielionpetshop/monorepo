# Usulan yang diambil dari panduan project kasir

Tanggal: 11 Oktober 2026
Status: **disetujui pemilik seluruhnya pada 11 Oktober 2026.** Semua sudah menjadi
aturan. File ini tinggal sebagai riwayat.

K1 menjadi PRI-28. K4 menjadi TAM-21. K2 dan K3 masuk WAJ-08. K5 sampai K9
menjadi KER-04 dan KER-07 s.d. KER-10 di `docs/work/aturan-kerja.md`. K10 dicatat
di `docs/teknis.md`.

Sumber: `D:\Kasir\monorepo\CLAUDE.md` (dibaca 11 Oktober 2026, 285 baris).
Pemilik meminta panduan itu ditinjau. Yang di bawah adalah aturan di sana yang
belum ada di v3 dan layak ditiru.

| No | Aturan di kasir | Usulan untuk v3 | Keputusan |
|---|---|---|---|
| K1 | Uang selalu disimpan sebagai bilangan bulat, dan dihitung dengan alat khusus yang tidak membulatkan sembarangan. | Semua nominal rupiah disimpan sebagai bilangan bulat rupiah, tanpa pecahan. Aturan pembulatan (misalnya upah borongan yang dibagi beberapa orang) ditulis di buku aturan modulnya. | |
| K2 | Status pekerjaan hanya ditulis di tiga tempat (WIP, papan klaim, changelog). Dilarang membuat dokumen status baru. Dokumen yang tidak dirawat diberi tanda "BASI" di baris pertama. | Sama: `docs/work/WIP.md`, `docs/work/claims.md`, `CHANGELOG.md`. | |
| K3 | Pekerjaan yang sudah tayang tetapi belum dicoba owner ditulis "tayang, menunggu uji coba owner", bukan "selesai". | Sama. "Selesai" hanya setelah pemilik mencoba di tempat uji atau di sistem asli. | |
| K4 | Fitur baru diberi tanda "Baru" tepat di tambahan barunya (kotak, kolom, tab, tombol), tampil 7 hari lalu hilang sendiri. | Sama. Ini permintaan pemilik sendiri di kasir, dan cocok untuk karyawan yang kemampuannya berbeda-beda. | |
| K5 | Klaim ditulis di main lebih dulu, baru membuat branch. | Sama. Klaim yang ditulis di branch sendiri tidak terlihat sesi lain sampai digabung. | |
| K6 | Pekerjaan dibagi per modul (tampilan, server, dan data satu modul dipegang satu pekerjaan), bukan per lapisan. | Sama. | |
| K7 | Branch kecil dan cepat digabung; branch yang hidup lama pasti bertabrakan. | Sama. | |
| K8 | "Berkas magnet" (berkas yang disentuh hampir semua pekerjaan, seperti menu dan daftar hak akses) hanya ditambah seperlunya, tidak sekalian dirapikan. | Sama, dan daftar berkas magnetnya ditulis di `docs/work/claims.md` setelah ada kode. | |
| K9 | Changelog ditulis sebagai potongan terpisah per pekerjaan, lalu digabung saat rilis, supaya pekerjaan paralel tidak bertabrakan di berkas yang sama. | Dipakai setelah v3 punya kode dan lebih dari satu pekerjaan berjalan bersamaan. Sebelum itu satu `CHANGELOG.md` cukup. | |
| K10 | Bentuk jawaban error dari server seragam, selalu dengan pesan Bahasa Indonesia. | Sama; ini pasangan dari TAM-03 dan TAM-04 di sisi server. Ditulis di bagian Teknis setelah alatnya dipilih. | |

Saran Claude: setujui semuanya. K1 yang paling penting karena menyangkut uang
dan memengaruhi rancangan tabel.
