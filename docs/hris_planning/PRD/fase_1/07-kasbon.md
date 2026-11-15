# 07 — Kasbon (Langkah L5)

Sumber v3: buku `05-gaji-driver-kasbon.md` bagian 3.9–3.14, 3.21–3.22 (DRV-54 s.d. 81, 121 s.d. 142),
spec `2026-10-14-gaji-driver-spec.md` bagian 4G-4a & 4G-4b.

## 1. Tujuan

Satu buku kasbon untuk semua orang: diajukan di HP, diperiksa Finance, diputuskan Pemilik/GM, uangnya
diserahkan, lalu dicicil otomatis lewat slip utama orang itu.

## 2. Lingkup

| Bagian | Layar | Fase 1 |
|---|---|---|
| 4G-4a: Kasbon Saya, ajukan, isikan atas nama, daftar kantor, periksa & putuskan, rincian, serahkan uang, batalkan, batal serah | DRV-L23 s.d. L31 | **Masuk** |
| 4G-4b: tunda cicilan, terima pelunasan, hapus utang, ubah jadwal cicilan, Kasbon Khusus, Kasbon Berjalan, batalkan pelunasan | DRV-L32 s.d. L39 | **Masuk** |

Aturan inti mengikuti v3 utuh: syarat masa kerja 6 bulan, batas sisa utang Rp250.000 per orang, dua
Dana Kasbon @ Rp1.000.000 (slip bulanan & mingguan), 1–3 kali potong, sisa dihitung (tidak
disimpan), "lunas" bukan tombol, tidak ada hapus (DRV-54 s.d. 79). Semua angka adalah pengaturan.

## 3. Penyimpangan dari v3

- **Serahkan uang, pelunasan tunai, dan hapus utang** di v3 menulis ke Buku Kas Keuangan (DRV-63,
  69, 70). Fase 1: dicatat di HRIS (tanggal server, siapa, sumber uang, bukti) dengan bentuk yang
  sama seperti pembayaran gaji (06 §3.3) ✅.
- **Sisa kasbon bawaan sistem lama** (SIS-28) dimuat di L9 sebagai satu angka sisa per orang,
  bertanda "bawaan sistem lama", dengan jadwal potong ditetapkan ulang paling banyak 3 kali.
- Sampai slip mingguan ada (L7), cicilan untuk orang berslip utama mingguan menunggu. 💡 Karena itu,
  kasbon untuk driver & kenek baru dibuka setelah L7 tayang.

## 4. Kriteria selesai

- Satu kasbon berjalan dari pengajuan sampai lunas lewat dua slip bulanan, termasuk tunda cicilan
  sekali dan sisa potongan yang terbawa.
- Pengajuan yang melewati batas orang atau sisa dana ditolak dengan pesan v3 (DRV-55, 58).
- Tidak ada yang bisa memutuskan kasbonnya sendiri (KAR-72).
- Uji banding sisa kasbon per orang dengan HRIS lama pada hari muat data.
