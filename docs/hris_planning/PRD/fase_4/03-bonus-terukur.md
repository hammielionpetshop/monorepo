# 03 — Bonus Terukur (Langkah F4-4)

Sumber v3: KIN-13 s.d. 18, KIN-59 s.d. 64; GAJ-24 s.d. 29, 34, 50, 90; spec Kinerja §3.2, KIN-L10 s.d. L12.

## 1. Tujuan

Bonus yang **lahir dari aturan**: "kalau ukuran X memenuhi syarat dalam rentang tertentu, dapat
nominal Y". Mesin menilai dari data dan menyimpan angka buktinya; hasilnya masuk **Persetujuan Bonus**
dan **Buku Bonus** yang sudah ada di modul Gaji (L4d). Tidak ada syarat yang dicentang orang.

## 2. Aturan inti

- **Bentuk aturan** (KIN-59): ukuran (dari daftar 02 §2) dan angka mentahnya, pembanding & batas
  (selisih kasir dibaca lebih maupun kurang), **rentang** (per hari, per periode, N periode
  berturut-turut), nominal, penerima (jabatan + cabang), **sumber dana wajib sebelum aktif**, berlaku
  dari. Hanya Pemilik/GM; diumumkan lewat Papan (Fase 3). GM dan Pemilik tidak bisa menjadi penerima.
- **Contoh bentuk dari owner** (KIN-14, angkanya diisi di pengaturan): selisih kasir satu hari ≤ batas
  → bonus per hari; jumlah selisih satu periode ≤ batas → bonus per periode; tiga periode berturut-turut
  tanpa izin & sakit → bonus; satu periode tanpa telat → bonus.
- **Hari yang dinilai** (KIN-60): per hari hanya hari yang punya data ukuran itu bagi orang itu.
- **Berturut-turut** (KIN-61): per periode penuh yang memenuhi; periode tidak penuh memutus; pindah
  tidak memutus selama aturan yang sama berlaku; sesudah bonus diberikan, hitungan mulai dari nol.
- **Penilai** (KIN-16, 62): tiap malam sebagai **perkiraan** di Kinerja Saya; **resmi saat rapor
  ditetapkan**, satu baris per aturan per orang per periode lewat **pintu tulis Buku Bonus** (kunci
  sama mencegah dobel). Nominal resmi dihitung pintu tulis Gaji.
- **Pengesahan** (KIN-64): di Persetujuan Bonus per aturan per periode; sumber **Dana Disiplin** yang
  saldonya kurang menolak pengesahan (GAJ-34).
- **Koreksi** (KIN-63): menjadi terpenuhi → bonus susulan slip berikutnya; menjadi tidak terpenuhi →
  belum disahkan ditolak, disahkan & slip belum tutup dibatalkan, sudah di slip tertutup dipotong
  sebagai koreksi bonus di slip berikutnya.
- **Satu kesalahan mengenai dua kali** (KIN-17): telat/tidak hadir boleh (potongan + syarat bonus);
  selisih kasir boleh; kehilangan barang tidak.

## 3. Layar

| Layar | Menu | Siapa | Perangkat |
|---|---|---|---|
| Aturan Bonus Terukur (KIN-L10) | Pengaturan › Kinerja | Pemilik, GM ubah; HR lihat | PC |
| Aturan Bonus Baru / Ubah (KIN-L11, 5 langkah) | dari L10 | Pemilik, GM | PC |
| Hasil Penilaian Bonus Terukur (KIN-L12) | tab "Bonus Terukur" di Rapor | HR, Pemilik, GM | PC |
| Persetujuan Bonus (sudah ada, L4d) | Gaji | Sama seperti sekarang | PC |

## 4. Penyesuaian monorepo

- **Buku Bonus, jenis bonus, sumber dana, dan Persetujuan Bonus sudah ada** (L4d). Fase 4 hanya
  menambah **asal baris** "Bonus Terukur" lewat pintu tulis yang sudah ada; tidak membuat buku kedua.
- Ukuran selisih kasir dibaca dari **minus kas shift POS** yang sudah disalin Gaji (00 §9).

## 5. Kriteria selesai

- Tes aturan: per hari / per periode / berturut-turut, periode tidak penuh memutus, pindah tidak
  memutus, kunci anti-dobel, Dana Disiplin kurang ditolak, tiga jalur koreksi.
- Uji owner: satu aturan contoh ("satu periode tanpa telat → Rp …") dinilai di staging, terlihat
  sebagai perkiraan, lalu masuk Persetujuan Bonus saat rapor ditetapkan.

## 6. Pertanyaan terbuka

- Daftar aturan, angka, dan sumber dana **diisi owner saat menyiapkan tayang** (v3 bagian 6, butir 6).
