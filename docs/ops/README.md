# Perawatan Server (catatan operasional)

Catatan singkat pekerjaan perawatan server yang pernah dilakukan, supaya bisa diulang tanpa
menebak. Repo ini publik — **jangan** menulis alamat server, kata sandi, atau data toko di sini.

## Disk penuh oleh paket (image) aplikasi lama

**Gejala:** `df -h /` di server menunjukkan pemakaian tinggi, padahal data toko kecil.
`docker system df` menunjukkan baris *Images* berukuran puluhan GB dengan sebagian besar *reclaimable*.

**Penyebab:** setiap rilis menarik tiga image baru (`backoffice`, `order-web`, `migrator`) bertanda
SHA commit. Langkah `docker image prune -f` di `.github/workflows/deploy-vps.yml` hanya membuang
image **tanpa tanda**, sehingga image bertanda versi lama menumpuk (±0,4–0,5 GB per rilis).

**Riwayat:**

| Tanggal | Sebelum | Sesudah | Yang dilakukan |
|---|---|---|---|
| 2026-10-11 | 83% terpakai (402 image, ±41,7 GB) | 27% terpakai (25 image, ±7,4 GB) | `bersih-image-lama.sh` — 379 image lama dihapus, 6 terbaru per aplikasi disimpan. Atas izin owner. Semua container tetap berjalan, tidak ada yang di-restart. |

**Cara mengulang** (butuh izin owner — menyentuh server):

1. Kirim [`bersih-image-lama.sh`](bersih-image-lama.sh) ke server lewat SSH dengan `MODE=cek`
   (hanya menghitung) dan baca hasilnya.
2. Bila angkanya masuk akal, jalankan lagi dengan `MODE=hapus`.
3. Periksa: `docker ps` (semua container tetap *Up/healthy*), halaman kasir & pesanan terbuka,
   `df -h /`.

**Batas aman skrip:** hanya menyentuh image `backoffice`, `order-web`, `migrator` milik sendiri;
menyimpan 6 image terbaru per aplikasi; memakai `docker rmi` **tanpa** `-f` sehingga image yang
sedang dipakai container ditolak oleh Docker sendiri. Image database, web server, dan WhatsApp,
semua volume (data toko, foto, sertifikat), dan container **tidak disentuh**. Sengaja **tidak**
memakai `docker image prune -a`, karena itu juga membuang image cadangan layanan lain.

**Akibat:** mundur ke versi yang sudah dihapus dari server perlu menarik ulang image-nya dari
registry (beberapa menit). Mundur ke 6 rilis terakhir tetap cepat.

**Perbaikan permanen:** langkah terakhir di `.github/workflows/deploy-vps.yml` kini membuang image
`backoffice`/`order-web`/`migrator` lama dan menyisakan 6 terbaru, dengan batas aman yang sama
(rilis 1.107.65, 2026-10-11, disetujui owner). Skrip manual di atas kini hanya cadangan; tetap
lihat `df -h /` sesekali.

## Yang belum dicadangkan

`backup-db.sh` hanya mencadangkan database (harian, disimpan di server yang sama). Berkas foto
(volume unggahan) **tidak** ikut, dan belum ada salinan backup di luar server.
