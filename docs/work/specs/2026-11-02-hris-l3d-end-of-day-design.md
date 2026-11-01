# Spec HRIS L3d — Laporan Pulang, Serah Terima, Lapor Masalah, dan Sudah Pindah Cabang

Tanggal: 2026-11-02 · Status: **draf, menunggu persetujuan owner (§9)**
Cakupan: bagian keempat L3, yaitu 4D-3 di [PRD 05](../../hris_planning/PRD/fase_1/05-kehadiran.md) tanpa Keadaan Mobil (KEH-L20 s.d. L24), ditambah KEH-L10 Sudah Pindah Cabang yang ditunda dari L3b.
Sumber: v3 `02-kehadiran` KEH-27, 89 s.d. 95, 125 s.d. 129; `kehadiran-spec` §3.2 (KEH-L10), §3.5, §4 (`laporan_pulang`, `serah_terima`, `laporan_masalah`).
Dasar kode: L3b (Absen, catatan absen hanya tambah), L3c (`effectiveDay`, rekap), L2f-1 (Mesin Pengajuan, lampiran tertutup, `notify()`), L2c (`recordPlacement`).
Aliran migrasi: **`hris` 0011**. Modul: `apps/hris/modules/attendance`.

## 1. Batas

**Dikerjakan:** Laporan Pulang berurutan (Serah terima → Ada masalah? → Kirim), status "Laporan Pulang menunggu" di layar Absen, jendela baca serah terima sesudah Masuk, Serah Terima Saya, Serah Terima Tim, Lapor Masalah, Laporan Masalah (rahasia), Sudah Pindah Cabang? beserta jenis pengajuan "Usulan pindah cabang".

**Tidak dikerjakan di L3d:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Keadaan Mobil, Bensin, laporan per trip (KEH-94, 100, 101, KEH-L25) | Absen lewat trip (L6) / Logistik | Driver dan Kenek belum diabsen QR, jadi tidak terdampak |
| "Ini lembur?" sesudah laporan (KEH-72) | Bagian Lembur (4D-5b) | Tidak muncul |
| Klarifikasi dan denda lupa absen pulang (KEH-91, 63, 64) | Bagian Perlu Dijelaskan (4D-5a) | Hari tanpa laporan terkirim bertanda "Laporan pulang tidak terkirim"; HR bisa membetulkan lewat Koreksi |

## 2. Data (`hris` 0011)

Semua tabel **hanya tambah** (trigger `reject_change`, KEH-95, PRI-02). Isi yang sudah terkirim tidak bisa diubah; yang ada hanya **Tambah keterangan**.

| Tabel | Isi | Kunci/pagar |
|---|---|---|
| `end_of_day_reports` | hari kerja, catatan absen pulang, isi serah terima, cara penerima (`TEAM`, `PEOPLE`), foto (boleh kosong), terkirim (jam server) | unik per hari kerja, sehingga tekan dua kali tercatat sekali |
| `handover_recipients` | laporan, orang | penerima dibekukan saat terkirim; "Tim saya" = orang aktif di cabang tempat ia absen hari itu (kantor: departemennya), tanpa dirinya (KEH-90) |
| `handover_reads` | laporan, orang, jam baca | unik laporan + orang |
| `problem_reports` | pelapor, isi, foto, menyangkut GM, asal (`END_OF_DAY`, `MENU`), terkirim | — |
| `problem_report_events` | laporan, status baru (`RECEIVED`, `IN_PROGRESS`, `DONE`), tanggapan satu kalimat, oleh, kapan | status berlaku = baris terbaru |
| `report_notes` | jenis (serah terima / masalah), laporan, isi, oleh, kapan | Tambah keterangan oleh pengirimnya sendiri (KEH-95) |
| `relocation_prompts` | orang, tanggal hari kerja, cabang, jawaban (`YES`, `NOT_YET`), pengajuan (bila Ya) | unik orang + tanggal |

**Pulang tercatat sesudah laporan (KEH-89).** Catatan absen Pulang L3b tetap ditulis saat Kirim foto, dengan jam foto. Jam ini tidak berubah walaupun laporan ditulis lama. Hari baru dihitung "pulang" bila laporannya terkirim. `effectiveDay` membaca jam pulang hanya dari Pulang yang sudah berlaporan, atau dari koreksi HR.

**Pengaturan baru (bertanggal berlaku):**

| Kunci | Isi awal | Sumber |
|---|---|---|
| `attendance.handover_min_length` | 20 huruf | KEH-90 |
| `attendance.handover_popup_days` | 7 hari | KEH-126 |
| `attendance.relocation_prompt_workdays` | 7 hari kerja | KEH-27 |

## 3. Aturan

- **Urutan Laporan Pulang** (KEH-125): 1 Serah terima, 2 Ada masalah? (Lewati atau Isi laporan masalah), 3 Kirim (ringkasan). Satu layar satu tugas. Tidak ada tombol cepat "tidak ada serah terima". Panjang paling sedikit dihitung server, dan bayangan isian memberi contoh kalimat.
- **Sesudah Kirim foto Pulang,** layar langsung membuka Laporan Pulang. Bila ditutup atau sinyal putus, layar Absen menampilkan "Laporan Pulang menunggu" dengan tombol **Lanjutkan laporan** sampai batas 04.00 (KEH-91). Isian teks disimpan di HP dan dipulihkan; fotonya dipilih ulang.
- **Lewat batas 04.00 tanpa laporan:** hari itu dianggap belum pulang (jam pulang "-") dan bertanda "Laporan pulang tidak terkirim". Jam foto tetap tersimpan sebagai bukti untuk klarifikasi nanti.
- **Penerima kosong** (sendirian, atau semua yang dipilih sudah berhenti): laporan tetap terkirim dan berstatus **Tidak ada penerima** (KEH-127). Laporan ini tampil di Serah Terima Tim dan bukan tugas.
- **Jendela baca** sesudah absen Masuk berhasil: satu jendela per laporan, mulai yang paling lama, hanya untuk serah terima `handover_popup_days` terakhir yang belum dibaca. Tombol **Sudah saya baca** aktif sesudah 1 detik (KEH-92, 126). Yang lebih lama tetap ada di menu.
- **Laporan masalah rahasia** (KEH-93, 128): hanya GM dan Pemilik yang membaca, termasuk nama pelapor. Bila **menyangkut GM** dicentang, hanya Pemilik yang bisa membaca. Laporan itu tidak ada di daftar, hitungan, dan pencarian GM, dan server menolak bila GM membukanya langsung. Laporan ini tidak berakibat apa pun bagi pelapor.
- **Tanggapan** satu kalimat, opsional, tampil ke pelapor. Bila tanggapan memuat nama lengkap orang aktif, layar memperingatkan sebelum disimpan (KEH-129).
- **Sudah Pindah Cabang?** (KEH-27, KEH-L10): muncul **sesudah Laporan Pulang terkirim**, bila `relocation_prompt_workdays` hari kerja terakhirnya berturut-turut di satu cabang yang bukan cabang penempatannya. Hari kerja = hari ia absen; hari tanpa absen tidak memutus urutan. Jawaban **Ya** membuat pengajuan "Usulan pindah cabang" ke kotak Persetujuan HR, Pemilik, atau GM. Bila disetujui, pindahnya dicatat lewat `recordPlacement` (KAR-56). Jawaban **Belum** membuat pertanyaan muncul lagi di pulang berikutnya.
- **Tidak memutuskan pengajuan pindah sendiri:** aturan Mesin Pengajuan yang sudah ada (KAR-72) tetap berlaku.

## 4. Layar

| Layar | Alamat | Menu | Isi |
|---|---|---|---|
| Laporan Pulang (KEH-L20) | bagian `/absen` | — | 3 langkah; foto dari kamera atau galeri |
| Jendela Serah Terima (KEH-L21) | bagian `/absen` sesudah Masuk | — | Satu per laporan, Sudah saya baca |
| Serah Terima Saya (KEH-L21) | `/serah-terima` | Saya | Tab Diterima / Dikirim, siapa sudah membaca, Tambah keterangan |
| Serah Terima Tim (KEH-L22) | `/kehadiran/serah-terima` | Kehadiran | Per tanggal, cari dan saring (cabang, tanggal, belum dibaca, ada foto), tanda Tidak ada penerima |
| Lapor Masalah (KEH-L23) | `/lapor-masalah` | Saya | Kirim laporan baru; daftar laporan sendiri dengan status dan tanggapan; Tambah keterangan |
| Laporan Masalah (KEH-L24) | `/kehadiran/laporan-masalah` | Kehadiran | Daftar dan rincian, ubah status, tanggapan |
| Sudah Pindah Cabang? (KEH-L10) | bagian `/absen` sesudah laporan | — | Ya / Belum |

## 5. Hak

| Tindakan | HR | Admin HR | Kepala Toko | Kepala Gudang | Finance | Pemilik/GM |
|---|---|---|---|---|---|---|
| Laporan Pulang, Serah Terima Saya, Lapor Masalah | ikut `attendance.self.check` (semua yang absen QR) | | | | | tidak diabsen |
| `attendance.handover.view` (Serah Terima Tim) | S | — | C | C | — | S |
| `attendance.problem.read` (Laporan Masalah) · ownerOnly | — | — | — | — | — | GM tanpa laporan "menyangkut GM" |
| `relocation.decide` (Usulan pindah cabang) · selfForbidden | S | — | — | — | — | S |

## 6. Mesin terjadwal

Tidak ada mesin baru. Batas 04.00 dibaca saat layar dibuka.

## 7. Pemberitahuan

| Kejadian | Kepada |
|---|---|
| Serah terima terkirim | Para penerima (lonceng; jendela baca tetap muncul saat Masuk) |
| Laporan masalah baru | Pemilik dan GM; yang menyangkut GM hanya ke Pemilik |
| Status atau tanggapan laporan masalah berubah | Pelapor |
| Usulan pindah cabang | Lewat Mesin Pengajuan yang sudah ada |

## 8. Tes

**Unit:** urutan langkah; panjang minimum; penerima "Tim saya" (cabang tempat absen, kantor = departemen, tanpa dirinya); 7 hari kerja berturut-turut (hari tanpa absen tidak memutus, cabang asal memutus); jam pulang hanya dari Pulang berlaporan.

**Integrasi DB:** tabel tidak bisa diubah atau dihapus; laporan dua kali tercatat sekali; tanpa laporan sampai 04.00 dianggap belum pulang; Tidak ada penerima; jendela baca hanya 7 hari dan hilang sesudah dibaca; GM ditolak membuka laporan menyangkut GM (daftar, hitungan, buka langsung); Sudah Pindah Cabang → pengajuan → disetujui → penempatan pindah; HR tidak bisa memutuskan pindah dirinya.

**Uji owner di staging** dengan karyawan uji di HP: daftar langkah dikirim saat tayang.

**Syarat HRIS:** fragment `apps/hris/changelog.d` + tanda Baru untuk menu dan bagian baru.

## 9. Keputusan owner (menunggu jawaban)

1. **Satu paket atau dipecah?** Lapor Masalah adalah langkah 2 Laporan Pulang, jadi keduanya saling terkait. **Saran: satu paket** (satu kali uji). Konsekuensinya, bagian ini lebih besar dari L3c.
2. **Pulang baru dihitung sesudah laporan terkirim (KEH-89).** Ini mengganti keputusan sementara L3b §9 butir 8. **Saran: setuju.** Jam pulang tetap jam foto, jadi waktu menulis laporan tidak dihitung kerja.
3. **Laporan tidak terkirim sampai 04.00:** **saran: jam pulang dianggap kosong dan diberi tanda**, sampai bagian Perlu Dijelaskan dibangun. Sementara itu HR bisa membetulkan lewat Koreksi Absen.
4. **Isian tersimpan di HP saat sinyal putus (TAM-16):** **saran: teks disimpan, foto dipilih ulang**, karena foto berukuran besar di penyimpanan browser.
5. **Foto serah terima dan laporan masalah boleh dari galeri** (TAM-08, berbeda dari foto absen). **Saran: setuju.** Foto serah terima dibuka tanpa dicatat; foto laporan masalah hanya bisa dibuka Pemilik/GM.
6. **Penerima "Tim saya"** = semua orang aktif di cabang tempat ia absen hari itu, termasuk yang sedang perbantuan di sana. Untuk kantor = departemennya. **Saran: setuju.**
7. **Usulan pindah cabang disetujui:** **saran: pindah berlaku mulai tanggal disetujui**, bukan mundur ke hari pertama, supaya data hari lampau tidak berubah. Jabatan tetap; hanya cabang yang pindah.
8. **Peringatan nama di tanggapan:** **saran: cocokkan dengan nama lengkap orang aktif** (tidak peka huruf besar). Peringatannya bukan larangan, karena nama pendek seperti "Ani" bisa muncul sebagai kata biasa.
