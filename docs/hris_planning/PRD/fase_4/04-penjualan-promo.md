# 04 — Penjualan Promo (Langkah F4-5)

Sumber v3: KIN-19 s.d. 26, KIN-65 s.d. 71; GAJ-26, 28, 46, 50; spec Kinerja §3.3, KIN-L13 s.d. L19.

## 1. Tujuan

Mendorong karyawan toko menjual **produk promo** tertentu: tiap cabang punya target per periode, tiap
orang melaporkan penjualannya, dan mendapat **bonus per pcs** dengan dua tarif (target cabang
tercapai atau belum).

"Produk promo" di sini adalah **target jual untuk bonus karyawan**, berbeda dari **promo diskon** di
POS (beli X gratis Y, diskon kelompok). ✅ Keduanya terpisah (§6).

## 2. Aturan inti

- **Produk dipilih dari daftar produk POS**, tidak diketik (KIN-19, 65). HR membuat produk, cabang,
  target per cabang, jabatan yang boleh melapor; **Pemilik/GM mengisi dua tarif**. Tanpa tarif
  berstatus "Menunggu tarif" dan belum bisa dilapori. Perubahan berlaku periode berikutnya.
- **Bonus hanya per pcs, dua tarif** (KIN-20): tercapai dihitung dari penjualan **satu cabang**; tiap
  orang dibayar menurut pcs yang **ia laporkan sendiri**.
- **Melapor** (KIN-21, 67): jumlah, tanggal & nomor nota, foto struk. Batas **3 hari** kalender sampai
  23.59; lewat itu telat, bonus dipotong **50%**; paling lambat akhir periode berikutnya, lewat itu
  ditolak. Angkanya pengaturan.
- **Produk yang bisa dipilih** (KIN-66): yang berlaku pada tanggal nota, di cabang tempat pelapor
  bekerja hari itu, untuk jabatan yang boleh melapor.
- **Penjaga dobel** (KIN-23, 68): nomor nota + produk unik untuk semua pelapor.
- **Cocok dengan POS** (KIN-68): nota tidak ada, produk tidak ada di nota, atau jumlah semua laporan
  melebihi jumlah di nota → **ditandai** untuk pemeriksa, tidak ditolak otomatis.
- **Pemeriksaan** (KIN-69): di tab Promo Persetujuan Bonus: Setujui, Koreksi jumlah (klaim awal
  tersimpan), Tolak beralasan; tidak untuk laporannya sendiri; menunggu > 3 hari kerja ditandai;
  pelapor boleh membatalkan sebelum diperiksa. **Finance tidak melihat laporan per orang** (KIN-25).
- **Tercapai dipastikan saat rapor ditetapkan** (KIN-70) dan tidak berubah sesudahnya.
- **Ke Buku Bonus** (KIN-71): satu baris per laporan disetujui (pcs × tarif, × 50% bila telat), lahir
  sudah disahkan; laporan susulan ke slip berikutnya dengan keterangan periode asal.

## 3. Layar

| Layar | Menu | Siapa | Perangkat |
|---|---|---|---|
| Produk Promo (KIN-L13) + Capaian per Cabang (KIN-L19) | Kantor › Kinerja › Penjualan Promo | HR, Pemilik, GM; kepala cabang (baca) | PC |
| Produk Promo Baru / Ubah (KIN-L14) | dari L13 | HR (tanpa tarif), Pemilik, GM | PC |
| Isi Tarif Promo (KIN-L15) | dari L13 | Pemilik, GM | PC |
| Lapor Penjualan Promo (KIN-L16) | Kerja Harian › Laporan Promo | Yang boleh melapor | HP |
| Laporan Promo Saya (KIN-L17) | Kerja Harian › Laporan Promo | Pelapor | HP |
| Kartu Laporan Promo (KIN-L18) | tab Promo di Persetujuan Bonus | HR, Pemilik, GM | PC |

## 4. Penyesuaian monorepo

- **Nota dicocokkan langsung ke transaksi POS** di database yang sama, sejak hari pertama (00 §9).
- ✅ Owner 2026-11-15: karena nota bisa dicek langsung, **foto struk tidak wajib**: pelapor cukup memilih
  nota (nomor nota terisi, produk dan jumlah di nota tampil). Foto tetap bisa dilampirkan.
- Transaksi POS hanya mencatat **kasir**, bukan pramuniaga yang melayani; karena itu laporan dari
  karyawan tetap dibutuhkan (siapa yang menjual).

## 5. Kriteria selesai

- Tes aturan: batas 3 hari & potongan 50%, batas akhir periode berikutnya, nota+produk unik, tanda
  tidak cocok POS, tercapai dipastikan, satu baris Buku Bonus per laporan.
- Uji owner: satu produk promo contoh di satu cabang; pramuniaga uji melapor dari HP; HR memeriksa;
  rapor ditetapkan → baris bonus masuk Buku Bonus.

## 6. Pertanyaan terbuka

- ✅ **Hubungan dengan promo POS** (owner 2026-11-15): produk promo Kinerja dibuat **terpisah** (tujuannya
  berbeda: bonus karyawan vs diskon pelanggan); 💡 layar menampilkan bila produk itu juga sedang
  dipromo di POS.
- ✅ Foto struk tidak wajib (§4).
