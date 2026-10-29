# Laporan pajak (dan laporan untuk akuntan dan bank)

Tanggal: 12 Oktober 2026

## Masalah

Laporan keuangan v3 dirancang untuk dibaca GM dan Owner dengan bahasa
sehari-hari (KEU-98, KEU-113). Laporan untuk pihak luar belum ada dan belum
pernah dibuat: pajak, akuntan, dan bank. Di sistem lama yang tersedia hanya
unduhan omzet per cabang.

## Yang diinginkan

Keputusan pemilik (12 Oktober 2026): **disimpan dulu untuk dibahas nanti**,
dengan **pajak dicatat khusus sebagai persiapan**. Tujuannya supaya saat
kewajiban atau permintaan pajak datang, bahannya sudah tersedia dan tidak
perlu disusun ulang dari nol.

## Yang sudah disiapkan aturan v3 (bahan yang kelak bisa dipakai)

- Omzet dan harga pokok per cabang per hari, dari sistem kasir (KEU-72).
- Bulan laporan = bulan kalender, sama dengan kasir (KEU-109).
- Tutup bulan: angka bulan yang sudah ditutup tidak berubah (KEU-112).
- Unduhan dibuat server (Excel dan PDF) dengan tanggal dan pembuatnya;
  versi beristilah akuntansi tersedia sebagai unduhan (KEU-113, KEU-116).
- Gaji per orang per bulan dari slip (GAJ-37, DRV-20).
- Daftar aset kantor dengan harga dan umur pakai (KEU-86).
- "Pajak" sudah menjadi salah satu jenis Tagihan Rutin (KEU-76), sehingga
  jatuh temponya bisa diingatkan dan pembayarannya tercatat.

## Catatan Claude (belum disetujui, belum dibahas)

Yang perlu ditanyakan saat topik ini dibuka; **jangan ditanyakan sebelum
pemilik membukanya**:

- Pajak apa saja yang sekarang dibayar atau dilaporkan, atas nama siapa
  (perorangan atau badan usaha), dan siapa yang mengurusnya.
- Apakah ada konsultan pajak atau akuntan, dan bentuk laporan apa yang
  mereka minta.
- Apakah penjualan perlu dirinci per jenis (misalnya yang kena pajak dan
  yang tidak), karena itu harus datang dari sistem kasir.
- Apakah pajak atas gaji karyawan dipotong, yang akan menyentuh buku Gaji.

Rancangan v3 tidak boleh menutup jalan ke laporan ini: data uang tidak
dihapus (PRI-02), bulan bisa ditutup, dan tiap angka bisa dibuka sampai
baris asalnya.

## Kapan dikerjakan

Belum ditentukan. Dibahas saat pemilik membukanya, paling lambat sebelum
spec modul Keuangan ditulis (Tahap 4).
