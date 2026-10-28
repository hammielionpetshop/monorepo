# Status Pekerjaan

Kata kunci untuk melanjutkan di sesi baru: **`lanjut v3`**

Diperbarui: 28 Oktober 2026 (**LANGKAH 6 (modul Keuangan 4H). Bagian 4H-3b-2b-iii-γ (Bensin "dibayar orang lain" → baris "belum dipasangkan" + pasang Catatan Cepat, KEU-18/149/4F-5c) SELESAI. Dengan ini 2b-iii (bensin) TUNTAS, dan karena 2b-i/ii/iii semua selesai, bagian 4H-3b-2b TUNTAS**).
Hijau `npm run cek` (**1188 tes**, migrasi sah **61**) + `npm run build`. CHANGELOG #308.
**2b-iii (bensin) dipecah 3 sub-sesi menurut asal uang (disetujui pemilik 28 Okt 2026):** **α** = "Dari tempat uang yang saya pegang"
(baris uang keluar baru, SELESAI PR #101); **β** = "Uang bensin yang sudah diberikan" (lengkapi baris "struk menyusul" 4H-2c, SELESAI PR #103); **γ** =
"Dibayar orang lain" (baris "belum dipasangkan" + pasang Catatan Cepat KEU-18/149, sesi ini). **SEMUA SELESAI.**
**Berikutnya: 4H-3c** (Masuk ke Brankas KEU-L30 + Hitung Kas KEU-L31/L32/L33 + keputusan selisih; KEU-35/36/37/49/96/126/133/151/152/153).
**4H-3b-2b-iii-γ:** Keputusan pemilik 28 Okt 2026 (DUA aturan): (1) **saldo kas nyata BELUM berkurang** saat baris "dibayar orang lain" lahir
(uang kantor belum keluar; biaya tetap langsung tercatat) — baris dititipkan di tempat **penampung sementara "Bensin dibayar orang lain"**
(bukan kas nyata) sampai diganti; saat dipasangkan baris PINDAH ke tempat uang Catatan Cepat & kas nyata di sana baru berkurang (tanpa baris
kedua, KEU-128); (2) **pemasangan dimulai dari SISI baris bensin** (bukan kotak Catatan Cepat; 9 kotak beku tak punya kotak bensin). Migrasi
**0061** (murni menambah): kolom `tempat_uang.peran_sementara` ('rekening_belum_dipilih' vs 'bensin_belum_diganti') supaya 2 penampung tak
tertukar (nama bukan kunci, WAJ-05); indeks calon pakai `baris_kas_pasangan_catatan_idx` (0060, TANPA indeks baru). TANPA hak baru, TANPA mesin
baru (**61 migrasi, 60 mesin**). Benih: +1 tempat penampung sementara; `peran_sementara` diisi utk kedua tempat sementara. Inti murni
`src/lib/keuangan-catatan-cepat.ts` +`kotakCalonBensin`/`kotakBolehPasangBensin` (Operasional & Lainnya), `validasiPasangBensin` (nominal
**sama persis**), `alasanDipasangkanBensin` (+2 tes **CC38–CC39**). Server `src/server/pintu/logistik-bensin.ts` `catatBensin` cabang
**`belum_dipasangkan`** (`catatDariModul` tempat uang=penampung; lahir Menunggu diperiksa; simpan `baris_buku_kas`); `batalkanCatatanBensin`
MENOLAK batal bila baris sudah dipasangkan (arah ke Keuangan, SEAM). `src/server/keuangan/catatan-cepat.ts` +`pasangkanKeBensin` (baris bensin
pindah ke tempat uang CC + tandai `pasangan_catatan`; CC dibatalkan, net nol). `src/server/pintu/keuangan-catatan-cepat.ts`
+`bensinBelumDipasangkan`/`calonCatatanCepatBensin`/`pasangkanKeBensinAksi`; `tempatRekeningSementara` kini pilih lewat `peran_sementara`.
Layar **KEU-L27** tombol "Bensin dibayar orang lain" → daftar → pilih baris → calon CC nominal sama → tahan 3 detik (TAM-15). Diuji end-to-end
di tempat uji (rollback): sebelum pasang kas nyata tak tersentuh; sesudah pasang Brankas turun SEKALI, penampung kembali 0, CC Dibatalkan.
**SEAM (aman, ditangguhkan):** batal γ SESUDAH dipasangkan (kini ditolak); pengingat Antrean finance "bensin belum dipasangkan lewat 3 hari"
(spec 3068) belum dibuat (mesin tetap 60, WAJ-13); "arah sebaliknya" di layar Catat Bensin. **Migrasi 0061 + benih SUDAH dijalankan ke tempat
uji** (28 Okt: "1 migrasi dijalankan" = 0061; benih "60 mesin tetap"; dicek DB: kolom `peran_sementara` + tempat "Bensin dibayar orang lain"
(sementara) ada). **DI-MERGE ke `main` (PR #105). TANPA migrasi/benih baru yang perlu dijalankan ulang** — migrasi 0061 + benih sudah
dijalankan ke tempat uji sesi ini.
**4H-3b-2b-iii-β:** Asal "sudah diberikan" → TIDAK baris baru; baris "struk menyusul" yang sudah ada (uang muka diberikan Finance lebih dulu,
4H-2c) DILENGKAPI jadi sebesar struk + foto lewat pintu tulis Keuangan `lengkapiStruk` (dipanggil langsung di transaksi Catat Bensin — hak
dijaga tombol Logistik `log.catat_bensin`, BUKAN `keu.catat_kas`). Kembalian/kekurangan mengikuti nominal yang berubah (tanpa baris kedua,
KEU-18/26); baris jadi **Menunggu diperiksa** (Pemeriksaan P/GM). TANPA migrasi (`catatan_bensin.baris_buku_kas` sejak 0041;
`struk_menyusul`/`nominal_diberikan`/`pembawa` sejak 0058), TANPA hak baru, TANPA mesin baru (**60**), TANPA benih baru (baris struk menyusul
bensin contoh Rp300rb/Kas Pegangan/24 Okt dari 4H-2c). Inti `src/lib/logistik-bensin.ts` `validasiCatatanBensin` dibedakan per asal
('tempat_saya' wajib tempat uang; **'sudah_diberikan' wajib pilih baris struk menyusul**; 'orang_lain' bebas) (+1 tes). Server
`src/server/pintu/logistik-bensin.ts`: `catatBensin` cabang **`lengkapi_struk`** (verifikasi baris status='menunggu_struk' + struk_menyusul +
kejadian ketik "Bensin atau solar", FOR UPDATE → `lengkapiStruk` → simpan `catatan_bensin.baris_buku_kas`); `opsiCatatBensin` + daftar
**calon struk menyusul** bensin (baris tak simpan mobil → pencatat pilih sendiri; sejalan Dashboard "Uang bensin belum ada struknya" → LOG-L73);
`pratinjauAkibatBensin` +`uangDiberikan`. **Batal β (WAJ-11):** baris itu milik Keuangan (`sumber='diketik'`), uang muka sudah keluar — jadi
batal catatan bensin TIDAK membatalkan baris; ia DIKEMBALIKAN ke 'menunggu_struk' (undo lengkapi: nominal→nominal_diberikan, foto/keputusan
dibersihkan) lewat **`kembalikanKeMenungguStruk`** (baru, `src/server/keuangan/struk.ts`) supaya bisa dicatat ulang. α/γ (`sumber='modul'`)
tetap lewat `batalDariModul`. Layar **LOG-L73** menampilkan pemilih daftar calon saat asal "sudah diberikan"; kalau daftar kosong, pilihan tak
bisa dipakai (diarahkan ke 2 asal lain). **SEAM (aman, ditangguhkan):** γ (orang_lain); batal β SETELAH baris 'diperiksa' (hanya P/GM; kini
ditolak dgn pesan arahkan ke Keuangan — undo baris terperiksa belum dibuat); "arah sebaliknya" di layar Catat Bensin (sejalan 2b-i/ii).
**DI-MERGE ke `main` (PR #103). TANPA migrasi/benih baru — TAK perlu dijalankan ulang ke tempat uji** (baris "struk menyusul" bensin
contoh sudah ada sejak benih 4H-2c; kolom & kejadian sudah ada sejak 0041/0058).
**4H-3b-2b-iii-α:** Modul **pertama** yang benar-benar memakai pintu `catatDariModul` (4H-2a). TANPA migrasi (`catatan_bensin.baris_buku_kas`
sejak 0041; kejadian modul "Bensin atau solar (dari catatan bensin)" dibenihi 4H-2a, `diperiksa_di_keuangan=true`), TANPA hak baru
(tombol di Logistik yang menjaga), TANPA mesin baru (**60**), TANPA benih baru. Inti murni `src/lib/logistik-bensin.ts`
+`rencanaBukuKasBensin` (asal→baris_baru/lengkapi_struk/belum_dipasangkan; α hanya baris_baru) & `uraianBarisBensin` (kendaraan+catatan
di satu baris, KEU-06) (+6 tes **W42–W43**). Server `src/server/pintu/logistik-bensin.ts`: `catatBensin` (asal 'tempat_saya' →
`catatDariModul` di transaksi yang sama: kejadian modul, tempat uang asal, cabang Gudang, nominal struk, tanggal isi, foto; simpan id di
`catatan_bensin.baris_buku_kas`; baris lahir **Menunggu diperiksa** → Pemeriksaan P/GM 4H-2b); `batalkanCatatanBensin` → `batalDariModul`
(baris ikut Dibatalkan, PRI-02). **"Sudah diperiksa Keuangan?" dibaca dari STATUS HIDUP baris** (bukan salinan kolom): pencatat boleh
batal selama baris belum 'diperiksa', sesudahnya hanya P/GM (LOG-86); `daftarBensin` (LOG-L72) ikut baca status hidup; kolom
`catatan_bensin.diperiksa_keuangan` tak lagi dipakai. Modul Pemeriksaan generik **tak disentuh** (guna `statusCatatanModul`). Idempoten
kunci (Logistik + id catatan + kejadian) → satu catatan satu baris, tak dobel. **SEAM (aman, ditangguhkan):** β & γ; "arah sebaliknya"
(tawarkan Catatan Cepat cocok di layar Catat Bensin) sejalan 2b-i/ii; penandaan balik `diperiksa_keuangan` tak dibuat (status hidup =
sumber kebenaran). **Dengan ini bagian 4H-3b-2b-ii (serah kasbon + bongkaran) TUNTAS** (riwayat di bawah).
**DI-MERGE ke `main` (PR #101). TANPA migrasi/benih baru — TAK perlu dijalankan ulang ke tempat uji** (baris Buku Kas bensin lahir
dari alur Logistik Catat Bensin, bukan benih; kolom & kejadian sudah ada sejak 0041/4H-2a).
**4H-3b-2b-ii-β:** kotak **Gaji/Upah** kini punya DUA tujuan pasang — slip (2b-i) dan **Laporan Bongkaran / susulan** (sesi ini).
TANPA migrasi (kolom `pembayaran_bongkaran.asal`/`catatan_cepat` sejak 0045; `baris_kas.modul_*` dari 0056; kejadian modul "Upah
bongkaran" sudah dibenihi 4H-2a), TANPA hak baru (`keu.lengkapi_catatan_cepat`; bayar atas pembayar = pemilik uang Pemilik/GM),
TANPA mesin baru (**60 tetap**). **Beda penting dari slip/kasbon:** uang keluar bongkaran = bagian peserta SETELAH dipotong lebih
bayar (B5), BUKAN jumlah bagian kotor; laporan "tanpa uang" (uang keluar nol) TAK bisa dipasangkan. Inti murni
`src/lib/keuangan-catatan-cepat.ts` +`kotakKeBongkaran` (kotak gaji_upah), `validasiPasangBongkaran` (uang keluar **sama persis**;
"tanpa uang" ditolak; selisih disebut) (+2 tes **CC36–CC37**). Server `src/server/keuangan/catatan-cepat.ts`: `jadikanBarisBongkaran`
(ubah baris CC di tempat → kejadian modul **"Upah bongkaran"** status `dari_modul`, modul_asal='Gaji Driver'/tabel=
'pembayaran_bongkaran'; arah/nominal/tempat uang/tanggal TETAP → saldo tak berubah KEU-128; cabang NULL = bukan biaya). Pintu
`src/server/pintu/keuangan-catatan-cepat.ts`: `pasangkanKeBongkaranAksi` (satu transaksi: `bayarSatuLaporan`/`bayarSatuSusulan`
asal='catatan_cepat' pembayar=pemilik uang → cek uang keluar sama persis, gagal/beda/"tanpa uang" → ROLLBACK → `jadikanBarisBongkaran`;
id pembayaran dibaca balik lewat `catatan_cepat`) + `pilihanPasang` diperluas (`keBongkaran`, `calonBongkaran` = laporan Berlaku +
susulan Menunggu, uang keluar setelah lebih bayar dihitung di SQL = nominal & > 0; `orangTitip` dipakai bersama kasbon). Layar
**KEU-L27** tombol **"Pasangkan ke Laporan Bongkaran"** berdampingan slip + `PanelBongkaran` (pilih satu laporan/susulan, "diserahkan
kepada" langsung/dititipkan, tahan 3 detik TAM-15). **Benih:** tidak ditambah (daftar calon kosong sampai ada Laporan Bongkaran
Berlaku dgn uang keluar sama — lahir dari alur Gaji Driver 4G-3b; CC "Gaji/Upah" contoh 4H-3b-1 sudah ada untuk mencoba layar).
**SEAM (aman, ditangguhkan):** pelepasan pasangan saat **batal bayar** bongkaran (pembayaran ber-`catatan_cepat`); "arah sebaliknya"
di layar bayar bongkaran; penurunan Kas Keluar Keuangan nanti harus MELEWATI pembayaran ber-`catatan_cepat`.
**DI-MERGE ke `main` (PR #99). TANPA migrasi/benih baru yang wajib dijalankan ulang** — benih tidak ditambah; daftar calon
bongkaran kosong sampai ada Laporan Bongkaran Berlaku (lahir dari alur Gaji Driver 4G-3b).
Riwayat 4H-3b-2b-ii-α (kasbon): **SELESAI & DI-MERGE (PR #97).** Hijau `npm run cek` (**1177 tes**, migrasi sah **60**) + build. CHANGELOG #304.
**Bagian 4H-3b-2b-ii dipecah 2 sub-sesi DISETUJUI pemilik 27 Okt 2026:** **2b-ii-α** = kotak **Kasbon** → serah kasbon (4G-4a)
MURNI pemasangan; **2b-ii-β** = kotak **Gaji/Upah** → **Laporan Bongkaran + susulan** (4G-3b, sesi ini). **"Arah
sebaliknya"** (tawarkan Catatan Cepat cocok di layar bayar modul) DITANGGUHKAN jadi langkah tersendiri (sejalan 2b-i; WAJ-13).
Dari spec (baris 1214–1215, 1296–1298): kotak Kasbon→kasbon; bongkaran dipasangkan dari kotak **Gaji/Upah** (bukan kotak Kasbon).
**4H-3b-2b-ii-α:** TANPA migrasi (`penyerahan_kasbon.asal`/`catatan_cepat`/`sebelum_disetujui`/`baris_kas` sudah disiapkan sejak
0049; `baris_kas.modul_*` dari 0056), TANPA hak baru (pakai `keu.lengkapi_catatan_cepat`; serah dijalankan atas penyerah = pemilik
uang Pemilik/GM), TANPA mesin baru (**60 tetap**). Spec: pemasangan kasbon (keuangan-spec baris 1215/1298), 4G-4a serah. Inti murni
`src/lib/keuangan-catatan-cepat.ts` +`kotakKeKasbon`, `validasiPasangKasbon` (nominal **sama persis** dgn nominal akhir; selisih
disebut), `uangKeluarSebelumDisetujui` (tanggal uang < disetujui, Y73) (+3 tes **CC33–CC35**). Server
`src/server/keuangan/catatan-cepat.ts`: `jadikanBarisKasbon` (ubah baris CC di tempat → kejadian modul **"Kasbon diberikan"**
status `dari_modul`, modul_asal='Gaji Driver'/tabel='penyerahan_kasbon'; arah/nominal/tempat uang/tanggal TETAP → saldo tak berubah
KEU-128; cabang NULL = bukan biaya, kelompok Piutang karyawan). `src/server/gaji/serah-kasbon.ts`: `OpsiSerahKasbon` +`asal`/
`catatanCepat`/`sebelumDisetujui`; INSERT `penyerahan_kasbon` isi kolom itu (tempat uang **NULL** saat dari catatan — uang diwakili
baris CC, tak dobel sumber); `HasilSerah` +`penyerahan` (id). Pintu `src/server/pintu/keuangan-catatan-cepat.ts`:
`pasangkanKeKasbonAksi` (satu transaksi: `serahkanKasbon` asal='catatan_cepat' penyerah=pemilik uang → `jadikanBarisKasbon`; gagal →
ROLLBACK) + `pilihanPasang` diperluas (`keKasbon`, `calonKasbon` = kasbon Disetujui belum diberikan, tak ada penyerahan Berlaku/
minta-batal menunggu, nominal akhir sama persis; `orangTitip` untuk titipan). Layar **KEU-L27** panel **Pasangkan ke kasbon** (pilih
satu kasbon, tanda "uang keluar sebelum disetujui", "diserahkan kepada" langsung/dititipkan, tahan 3 detik TAM-15). **Benih:** +1
Catatan Cepat kotak **Kasbon** contoh (Rp1.000.000 belum dilengkapi) untuk mencoba layar; daftar calon kosong sampai ada kasbon
Disetujui belum diberikan (lahir dari alur Gaji Driver 4G-4a). **SEAM (aman, ditangguhkan):** pelepasan pasangan saat **batal serah**
kasbon (penyerahan ber-`catatan_cepat`); "arah sebaliknya" di layar serah kasbon; penurunan Kas Keluar Keuangan nanti harus
MELEWATI penyerahan ber-`catatan_cepat`. **DI-MERGE ke `main` (PR #97). TANPA migrasi/benih baru yang wajib dijalankan ulang** —
benih idempoten; CC "Kasbon" contoh ikut saat benih dijalankan lagi (tidak wajib untuk kode berjalan).
**Berikutnya: bagian 4H-3b-2b-ii-β** (bongkaran 4G-3b): pasangkan Catatan Cepat kotak **Gaji/Upah** → Laporan Bongkaran + susulannya;
calon bongkaran (nominal = uang keluar setelah lebih bayar; "tanpa uang" tak bisa dipasangkan) di KEU-L27. Modul bongkaran SUDAH
siap (`OpsiBayarBongkaran.asal='catatan_cepat'` + kolom `pembayaran_bongkaran.catatan_cepat`). Pola 2b-ii-α bisa ditiru:
`jadikanBarisBongkaran` + `bayarSatuLaporan`/`bayarSatuSusulan` dalam satu transaksi. Sesudah itu **2b-iii** bensin (4F-5c, lintas-
modul: sambungkan `catatan_bensin`→`baris_kas`, SEAM `logistik-bensin.ts`), lalu **4H-3c** (Masuk ke Brankas KEU-L30 + Hitung Kas).
Riwayat 4H-3b-2b-i: **Pasangkan Catatan → slip gaji (KEU-18/Gaji Y3) SELESAI & DI-MERGE (PR #95/#96).** Hijau `npm run cek`
(**1174 tes**, migrasi sah **60** — TANPA migrasi baru) + `npm run build`. CHANGELOG #303.
**Bagian 4H-3b-2b dipecah 3 sub-sesi DISETUJUI pemilik 27 Okt 2026:** **2b-i** = slip gaji (4E-5b, Gaji Y3) MURNI pasangan di
Keuangan (sesi ini); **2b-ii** = serah kasbon (4G-4a) + bongkaran (4G-3b); **2b-iii** = bensin (4F-5c, lintas-modul: sambungkan
`catatan_bensin`→`baris_kas` dulu, SEAM `logistik-bensin.ts`). **Pemasangan Supplier DITUNDA** (disetujui 27 Okt): modul
pembelian/supplier belum ada, jadi belum ada "langkah bayar" untuk dipasangkan (WAJ-13).
**4H-3b-2b-i:** TANPA migrasi (kolom `baris_kas.modul_*` dari 0056, `pembayaran_slip.asal`/`catatan_cepat` sudah ada), TANPA hak
baru (pakai `keu.lengkapi_catatan_cepat`; langkah bayar dijalankan atas pembayar = pemilik uang catatan Pemilik/GM), TANPA mesin
baru (**60 tetap**). Spec: Gaji Y3 (`docs/work/specs/2026-10-13-gaji-bulanan-spec.md` baris 1496), KEU-18/24, keuangan-spec
baris 1034–1039. Inti murni `src/lib/keuangan-catatan-cepat.ts` +`kotakKeSlip`, `validasiPasangSlip` (≥1 slip; jumlah bersih slip
**sama persis** nominal catatan; selisih disebut, Y110) (+3 tes **CC30–CC32**, contoh Y109 Rp40jt & Y110 selisih Rp150rb). Server
`src/server/keuangan/catatan-cepat.ts`: `jadikanBarisSlip` (ubah baris CC di tempat → kejadian modul **"Bayar gaji"**, status
`dari_modul`, arah/nominal/tempat uang/tanggal TETAP → saldo tak berubah KEU-128; cabang NULL = bukan baris biaya). Pintu
`src/server/pintu/keuangan-catatan-cepat.ts`: `pasangkanKeSlipAksi` (gerbang pemilik uang Pemilik/GM KEU-18/H48; slip bertanda
hanya akses penuh GAJ-100; **satu transaksi**, gagal satu slip → ROLLBACK semua; buat 1 `kelompok_bayar`, tiap slip lewat
`bayarSlipSatu` asal='catatan_cepat' pembayar=pemilik uang, lalu `jadikanBarisSlip`) + `pilihanPasang` diperluas (`keSlip`,
`calonSlip` = slip tertutup belum dibayar bersih>0). Layar **KEU-L27** panel **Pasangkan ke slip gaji** (centang slip, jumlah
berjalan vs nominal "sama persis/kurang/lebih", tahan 3 detik TAM-15). `keadaanKata` +`dari_modul`="sudah dipasangkan". **Benih:**
tidak ditambah (slip tertutup lahir dari alur Gaji — tutup periode dulu; CC "Gaji/Upah" contoh Rp3jt dari 4H-3b-1 sudah ada untuk
mencoba layar; daftar calon kosong sampai ada slip tertutup). **SEAM (aman, ditangguhkan):** pelepasan pasangan saat **batal
bayar** slip (spec `bayar-slip.ts` menandainya seam; kasus 1-catatan-banyak-slip belum dipastikan spec; TANPA risiko dobel-hitung
karena bayar slip biasa belum menulis `baris_kas`). **DI-MERGE ke `main` (PR #95). TANPA migrasi/benih baru — tak perlu dijalankan
ulang ke tempat uji** (benih idempoten; slip tertutup untuk mencoba pemasangan lahir dari alur modul Gaji, bukan benih).
**Bagian 4H-3b-2 dipecah 2 sub-sesi DISETUJUI pemilik 27 Okt 2026:** **4H-3b-2a** = memasangkan Isi Kas Finance/
Setor Bank → **Pindah Dana (KEU-34)** MURNI di dalam modul Keuangan (tanpa menyentuh modul lain) + daftar calon
pasangan di KEU-L27 + arah sebaliknya di KEU-L06 — **SELESAI (sesi ini)**; **4H-3b-2b** = slip (4E-5b) + bongkaran (4G-3b) +
serah kasbon (4G-4a) + **bensin** (4F-5c, lintas-modul: sambungkan Logistik ke Buku Kas dulu) + arah sebaliknya di layar bayar
modul. **Alasan bensin geser ke 2b (disetujui 27 Okt):** bensin butuh menyambungkan `catatan_bensin` ke `baris_kas`
(SEAM 4H dari pintu `logistik-bensin.ts`), jadi lintas-modul — sama beratnya dengan slip/kasbon, bukan ringan.
**4H-3b-2a:** Migrasi **0060** (murni menambah): kolom `baris_kas.pasangan_catatan` (baris Pindah Dana/—kelak—modul mencatat
Catatan Cepat mana yang dipasangkan ke sana) + indeks parsial penyaring calon. TANPA hak baru (pakai `keu.lengkapi_catatan_cepat`
+ `keu.catat_kas`), TANPA mesin baru (**60 tetap**; `penanda_catatan_cepat` sudah menandai yang lewat batas, WAJ-13). Inti murni
`src/lib/keuangan-catatan-cepat.ts` +`kotakKePindahDana`, `bolehPasangPindah` (Pindah Dana, belum dipasang, asal sama, **nominal
sama persis** KEU-34), `validasiJadikanPindah` (kejadian pindah, tujuan≠asal), `alasanDipasangkan` (+5 tes **CC25–CC29**). Server
`src/server/keuangan/catatan-cepat.ts`: `pasangkanKePindah` (tandai Pindah Dana + batalkan catatan, net nol KEU-128) +
`jadikanPindahDana` (ubah catatan sendiri jadi Pindah Dana di tempat — jalan keluar WAJ-11). Pintu
`src/server/pintu/keuangan-catatan-cepat.ts`: `pasangkanKePindahAksi`, `jadikanPindahAksi`, `pilihanPasang` diperluas (calon
Pindah Dana + kejadian pindah + tempat tujuan). Pintu `src/server/pintu/keuangan.ts`: `pindahDana` +param `pasangkanCatatan`
(catat+pasang **satu transaksi**, gagal pasang → ROLLBACK) + `calonCatatanCepatPindah` (arah sebaliknya). Layar **KEU-L27**
(panel Pasangkan ke Pindah Dana: daftar calon tahan 3 detik / Jadikan Pindah Dana pilih kejadian+tujuan tahan 3 detik) +
**KEU-L06** (langkah 3 tawarkan memasangkan Catatan Cepat yang cocok). Benih: +1 Catatan Cepat "Isi Kas Finance" Rp5.000.000
(belum dilengkapi) + 1 Pindah Dana "Isi Kas Pegangan" Rp5.000.000 (belum dipasangkan) utk dicoba. **SEAM:** slip/bongkaran/
kasbon/bensin + arah sebaliknya di layar bayar modul = **4H-3b-2b**; pemberitahuan pemegang Brankas + "menunggu diterima" =
**4H-3c (KEU-L30)**. **DI-MERGE ke `main` (PR #93). Migrasi 0060 + benih SUDAH dijalankan ke tempat uji** (27 Okt: "1 migrasi
dijalankan" = 0060; benih "60 mesin tetap", Keuangan idempoten; dicek DB: kolom `pasangan_catatan` ada, CC "Isi Kas Finance"
Rp5.000.000 belum_dilengkapi (id 4) + Pindah Dana "Isi Kas Pegangan" Brankas→Kas Pegangan Rp5.000.000 menunggu, belum
dipasangkan (id 5); tanpa hak/mesin baru).
**Bagian 4H-3b (Memasangkan) dipecah 2 sub-sesi DISETUJUI pemilik 27 Okt 2026:** **4H-3b-1** = mesin sisi Catatan Cepat MURNI
(tak menyentuh modul lain) — Pecah (KEU-150) + dobel catat (KEU-18/130) + "bukan gaji" (Pribadi/Bantuan) + kerangka KEU-L27
(sesi ini); **4H-3b-2** = pemasangan yang menjalankan langkah bayar modul (slip 4E-5b, bongkaran 4G-3b, serah kasbon 4G-4a,
bensin 4F-5c, Isi Kas Finance/Setor Bank → Pindah Dana KEU-34) + daftar calon pasangan + "arah sebaliknya". Alasan geser:
bensin & Isi Kas Finance ternyata menyentuh modul/alur lain (Logistik; KEU-34 ↔ "Masuk ke Brankas" 4H-3c), bukan "ringan".
**4H-3b-1:** TANPA migrasi (`induk_catatan` sudah ada sejak 0059), TANPA hak baru, TANPA mesin baru (60). Inti murni
`src/lib/keuangan-catatan-cepat.ts` +`validasiPecah` (≥2 bagian, tiap bulat>0 PRI-28, jumlah tetap sama), `KELOMPOK_BUKAN_GAJI`/
`kelompokBukanGaji`, alasan baku (ALASAN_UANG_KEMBALI/ALASAN_DOBEL/alasanDipecah) (+4 tes CC21–CC24, contoh spec Rp5jt=4,8jt+200rb).
Server `src/server/keuangan/catatan-cepat.ts`: `pecahCatatanCepat` (tiap bagian baris_kas baru menunjuk induk; sisa "uang
kembali ke Brankas" dibatalkan; induk dibatalkan → net nol KEU-128) + `ParamBuatCatatanCepat.indukCatatan`. Pintu
`src/server/pintu/keuangan-catatan-cepat.ts`: `pilihanPasang` (rincian + peringatan dobel KEU-130 + kejadian bukan-gaji +
cabang/rekening), `pecahCatatanCepatAksi`, `batalDobelAksi`, `bukanGajiAksi`; `lengkapiAksi` dirapikan jadi helper bersama
`jalankanLengkapi` (kotak pasangan kini diarahkan ke layar Pasangkan, bukan galat seam). Layar **KEU-L27** di
`/keuangan/lengkapi-catatan-cepat` (kotak pasangan → tombol "Pasangkan" buka FormPasang: panel Pecah tahan 3 detik, Batalkan
dobel tahan 3 detik, Bukan gaji pilih Pribadi/Bantuan tahan 3 detik, Tanyakan). Pribadi (kelompok diambil_owner) hanya
Pemilik/GM (aksesPenuh, ditegaskan KEU-18). Benih: +1 Catatan Cepat contoh kotak **Gaji/Upah** (Rp3.000.000 belum dilengkapi)
supaya Pecah/dobel/bukan-gaji bisa dicoba. **SEAM (dalam batas 4H-3b-2/4H-3c yang disetujui):** pemasangan nyata ke slip/
kasbon/bongkaran/Pindah Dana/bensin + daftar calon pasangan + "arah sebaliknya" = **4H-3b-2**; pemberitahuan pemegang Brankas +
"Tidak benar" atas sisa kembali ke Brankas = **4H-3c (KEU-L30)** (di sini sisa sudah dibatalkan dengan alasan + jejak benar).
**DI-MERGE ke `main` (PR #91). Benih SUDAH dijalankan ke tempat uji** (27 Okt: TANPA migrasi baru — "59 migrasi sudah jalan";
benih "60 mesin tetap", Keuangan idempoten; dicek DB: 2 Catatan Cepat contoh belum_dilengkapi — Gaji/Upah Rp3.000.000 +
Supplier Rp2.500.000; tanpa hak/mesin baru).
**Berikutnya: bagian 4H-3b-2b-ii** (serah kasbon 4G-4a + bongkaran 4G-3b: pasangkan Catatan Cepat kotak Kasbon → serah kasbon,
dan ke pembayaran bongkaran; + daftar calon pasangan di KEU-L27). Sesudah itu **2b-iii** bensin (4F-5c, lintas-modul: sambungkan
`catatan_bensin`→`baris_kas` dulu, SEAM `logistik-bensin.ts`), lalu **4H-3c** (Masuk ke Brankas KEU-L30 + Hitung Kas). Pola slip
2b-i bisa ditiru: baris CC diubah di tempat jadi kejadian modul lewat fungsi tulis di `keuangan/catatan-cepat.ts`, langkah modul
dijalankan dari pintu dalam satu transaksi.
Riwayat: **4H-3a (Catatan Cepat, inti) SELESAI & DI-MERGE** (PR #88/#89). Hijau `npm run cek` (**1162 tes**, migrasi sah **59**) + `npm run build`. CHANGELOG #300.
**Pembagian 4H-3 jadi 3 sesi DISETUJUI pemilik 26 Okt 2026:** 4H-3a Catatan Cepat inti (sesi ini); **4H-3b** Memasangkan
(KEU-L27) + pecah + dobel catat (menyentuh modul lain); **4H-3c** Masuk ke Brankas (KEU-L30) + Hitung Kas (KEU-L31/L32/L33)
+ keputusan selisih.
**4H-3a:** Catatan Cepat = satu `baris_kas` (sumber 'catatan_cepat') status baru **'belum_dilengkapi'** (pola 'menunggu_struk':
langsung masuk saldo KEU-128, TIDAK masuk Pemeriksaan; finance lengkapi → 'menunggu' + `dikirim_pada`=now()). Migrasi **0059**
(murni menambah): status += 'belum_dilengkapi'; kolom `catatan_cepat`/`kotak`/`pemilik_uang`/`pos_sementara`/`transfer`/
`dari_pribadi`/`lampiran`/`perlu_ditanyakan`+`pertanyaan`+`ditanyakan_*`/`jawaban`+`dijawab_*`/`dilengkapi_*`/`induk_catatan`
(disiapkan utk pecah 4H-3b) + CHECK kotak&pemilik uang wajib + indeks parsial; ALTER `tempat_uang` +`sementara` (tempat
**"rekening belum dipilih"** KEU-146); tabel baru **`kotak_catatan_cepat`**. Inti murni `src/lib/keuangan-catatan-cepat.ts`:
9 `KOTAK_BAKU` (perilaku di kode WAJ-05: arah/pos/perluPasangan/kelompokLengkap/uangMasuk), `perilakuKotak`, `posCatatan`
(Lainnya/Uang Masuk/ditanyakan → belum_dipilah KEU-147), **`terbilang`** (KEU-30), `umurHari`/`lewatBatasLengkapi`, validasi,
`kalimatPeriksaLengkapi` (+20 tes CC1–CC20). **SATU pintu tulis (WAJ-04)** `src/server/keuangan/catatan-cepat.ts`:
`buatCatatanCepat`/`lengkapiCatatanCepat` (nominal&arah TIDAK diubah KEU-33)/`tandaiPerluDitanyakan`/`jawabPerluDitanyakan`/
`bukanCatatanSaya`/`betulkanAngkaCatatanCepat` + jejak KEU-17. Pintu `src/server/pintu/keuangan-catatan-cepat.ts`:
`pilihanKotak`/`pilihanAtasNama`, `buatCatatanCepatAksi`/`catatAtasNamaAksi` (lampiran wajib), `catatanSaya`, `perluDitanyakan`/
`jawabAksi`/`bukanCatatanSayaAksi`/`betulkanAngkaAksi`/`batalCatatanCepatAksi`, `dataBelumLengkap` (3 tab)/`pilihanLengkapi`/
`lengkapiAksi` (tolak kotak pasangan = seam 4H-3b)/`tanyakanAksi`. Layar **KEU-L22/L23/L24/L29** `/keuangan/catatan-cepat`
(pemilik uang, HP: kotak-kotak, Isi Kotak nominal besar+terbilang, "OK, catat" TIDAK ditahan 3 detik [KEU-30]+Batalkan 1 menit,
Catatan Saya, jawab Perlu Ditanyakan) + **KEU-L25/L26/L28** `/keuangan/lengkapi-catatan-cepat` (finance, PC: daftar 3 tab +
umur/lewat batas, Melengkapi 2 langkah, Tanyakan, Catat atas nama 2 langkah tahan 3 detik). Kartu Beranda "Catatan Cepat" &
"Catatan Cepat Belum Lengkap". **+2 hak** `keu.catat_catatan_cepat` (Pemilik/GM batas keras, lingkupBoleh []) &
`keu.lengkapi_catatan_cepat` (Finance+P/GM; +3 tes HK13–HK15). **+1 mesin** `penanda_catatan_cepat` (07.00; **60 total**) + jenis
tanda `keu_catatan_cepat_perhatian` (belum dilengkapi lewat batas → kartu P/GM; perlu ditanyakan > 3 hari → Antrean pemilik uang;
berhenti sendiri TAM-25; +1 tes mesin). Benih: 9 kotak awal + tempat "Rekening belum dipilih" + 1 Catatan Cepat contoh
(Rp2.500.000 Supplier, belum dilengkapi). Aturan 06 (KEU-27 s.d. 33, 145 s.d. 148) sudah ada & **beku, tidak diubah**.
**SEAM (dalam batas 4H-3 yang disetujui):** Memasangkan L27 + pecah + dobel catat = **4H-3b** (kotak pasangan — Supplier/Gaji/
Kasbon/Isi Kas Finance/Setor Bank — boleh dicatat & ditanyakan, tetapi Lengkapi-nya menolak dgn pesan seam); Masuk ke Brankas +
Hitung Kas = **4H-3c**; batas "hari kerja finance" dihitung hari KALENDER dulu (libur finance menyusul bersama N4, sejajar 4H-2c).
(4H-3b dipecah 2 sub-sesi — lihat blok teratas; 4H-3b-1 sedang dikerjakan di sesi 27 Okt.) **DI-MERGE ke `main` (PR #88;
perbaikan impor benih relatif PR #89). Migrasi 0059 +
benih SUDAH dijalankan ke tempat uji** (26 Okt: "1 migrasi dijalankan"; benih "Mesin otomatis: 1 baru, 60 total" =
`penanda_catatan_cepat`; dicek DB: 9 kotak, tempat "Rekening belum dipilih" (sementara), 1 Catatan Cepat contoh
(supplier Rp2.500.000 belum_dilengkapi), jenis tanda `keu_catatan_cepat_perhatian`; hak `keu.lengkapi_catatan_cepat` ke Finance).
Riwayat: **4H-2c (Struk menyusul) SELESAI & DI-MERGE ke `main` (PR #86).** Hijau `npm run cek` (**1137 tes**, migrasi sah **58**)
+ `npm run build`. CHANGELOG #299. **Dengan ini bagian 4H-2 (Pemeriksaan & Pintu dari Modul Lain) TUNTAS SELURUHNYA.**
**4H-2c:** Uang diberikan DULU sebelum belanja (centang "struk menyusul" di KEU-L05; pembawa wajib) → baris 'menunggu_struk',
langsung kurangi saldo, belum diperiksa. Struk datang (KEU-L20 3 langkah): nominal baris YANG SAMA jadi sebesar struk
(kembalian turun / kekurangan naik, tanpa baris kedua) → 'menunggu' (diperiksa). Struk tak datang (P3, hanya Pemilik/GM):
"Terima tanpa struk" (bukti tidak ada) / "Tagih ke pembawa" (diteruskan HR = bahan Potongan Lain GAJ-80, hanya ditandai
`struk_diteruskan_hr` + beri tahu; usulan tetap dibuat HR). Migrasi **0058** (murni menambah): status += 'menunggu_struk';
kolom `struk_menyusul`/`pembawa`/`nominal_diberikan`/`struk_dilengkapi_pada`/`struk_keputusan`/`struk_alasan`/
`struk_diputus_oleh`/`struk_diputus_pada`/`struk_diteruskan_hr` + CHECK pembawa&nominal_diberikan wajib bila struk_menyusul +
indeks parsial. Inti murni `src/lib/keuangan-struk.ts`: `selisihStruk` (kembalian/kekurangan/pas), `validasiLengkapiStruk`
(nominal bulat>0 PRI-28; foto struk wajib / bukti tidak ada + alasan KEU-11), `validasiKeputusanStruk`, `kalimatPeneguhStruk`
(+15 tes SM1–SM15, angka contoh spec Rp300rb→285rb kembalian 15rb / →320rb kekurangan 20rb). **SATU pintu tulis (WAJ-04)**
`src/server/keuangan/struk.ts`: `lengkapiStruk`/`putuskanStruk` (hanya baris 'menunggu_struk'; `dikirim_pada`=now() → batas 3
hari pemeriksaan dihitung sejak siap; jejak KEU-17). Pintu `src/server/pintu/keuangan-struk.ts`: `dataBelumBerstruk` (L19),
`rincianStruk`/`pratinjauSelisih` (L20), `lengkapiStrukAksi` (keu.catat_kas), `putuskanStrukAksi` (hanya akses penuh P/GM).
`catatBaris` (buku-kas.ts) + `catatMasukKeluar`/`pilihanCatat` (keuangan.ts) diperluas: strukMenyusul/pembawa + daftar pembawa.
Layar **KEU-L19** `/keuangan/uang-belum-berstruk` + **KEU-L20** (3 langkah, tahan 3 detik) + centang "struk menyusul"+pembawa di
**KEU-L05** + penunjuk/tautan di **KEU-L07** rincian + tombol tab di Buku Kas. **TANPA hak baru** (Lengkapi=keu.catat_kas;
keputusan P3=akses penuh). **+1 mesin** `penanda_struk_menyusul` (07.00; **59 total**) + jenis tanda `keu_struk_menyusul_lewat`
(uang menunggu_struk lewat 3 hari → kartu P/GM + Antrean pembawa; berhenti sendiri TAM-25; +1 tes mesin). Benih: +1 baris
"struk menyusul" contoh (bensin Rp300rb, Kas Pegangan). Aturan 06 (KEU-26/140/141) sudah ada & **beku, tidak diubah**.
**SEAM (keputusan pemilik 26 Okt):** batas "3 hari kerja finance" (KEU-26/56) pakai HARI KALENDER dulu; kurangi libur finance
menyusul bersama **N4** saat Kehadiran disambung (penanda hanya menandai, tak memutus). Bensin dilengkapi lewat catatan bensin
Logistik (LOG-83/86) = seam penyambungan modul. **DI-MERGE ke `main` (PR #86). Migrasi 0058 + benih SUDAH dijalankan ke tempat
uji** (26 Okt: "1 migrasi dijalankan"; benih "Mesin otomatis: 1 baru, 59 total" = `penanda_struk_menyusul`; jenis tanda
`keu_struk_menyusul_lewat` + 1 baris "struk menyusul" contoh tersisip; tanpa hak baru = batas keras).
Riwayat: **4H-2b (Pemeriksaan Buku Kas + Perlu Diperbaiki) SELESAI & DI-MERGE ke `main` (PR #84)**. Hijau (**1120 tes**, migrasi
sah **57**) + `npm run build`. CHANGELOG #298.
**4H-2b:** Pemilik/GM memeriksa catatan yang **diketik** (+ bensin yang "diperiksa di Keuangan") — Setujui/Tolak/Setujui banyak.
Migrasi **0057** (murni menambah): ALTER `baris_kas` (+`dikirim_pada` = kapan catatan terakhir dikirim; diisi dari `jam_catat`
untuk baris lama; `koreksiBaris` menyetelnya ulang → batas 3 hari dihitung dari koreksi, W8); tabel baru **`pemeriksaan_buku_kas`**
(baris, keputusan disetujui/ditolak, pemeriksa, jam server, alasan, cara satu/banyak + nomor kelompok, nomor versi jejak; satu
baris bisa ditolak lalu disetujui, PRI-02). Inti murni `src/lib/keuangan-pemeriksaan.ts`: `alasanTakBolehMemeriksa`/`bolehMemeriksa`
(gerbang KEU-120/142: bukan pencatatnya; bukan yang dicatat atas namanya bila ia pemilik uang=pemegang Brankas),
`tandaPemblok`/`adaTandaPemblok` (tanda yang memblok Setujui Banyak KEU-144: tanpa bukti/bukti tidak ada/tanggal mundur/ditandai
untuk GM/atas nama Ibu — "saldo minus"/"mungkin dobel" seam 4H-1), `lewatTigaHari`/`selisihHariKalender` (KEU-143) (+13 tes
PR1–PR13 termasuk W8/H12/H16, WAJ-06 hak+waktu). **SATU pintu tulis (WAJ-04)** `src/server/keuangan/pemeriksaan.ts`:
`setujuiBaris`/`tolakBaris` (hanya baris 'menunggu'; tulis `pemeriksaan_buku_kas` + jejak KEU-17). Pintu
`src/server/pintu/keuangan-pemeriksaan.ts`: `dataPemeriksaan` (tab Menunggu/Lewat 3 hari/Sudah saya periksa 30 hari),
`rincianPeriksa` (+ catatan lain tempat uang/nominal/tanggal sama, tolak sebelumnya, riwayat), `setujui`/`tolak`/`setujuiBanyak`
(banyak hanya tanpa tanda, H16; nomor kelompok), `dataPerluDiperbaiki` (catatan saya Ditolak, tanpa batas periode).
Layar **KEU-L15/L16/L17** `/keuangan/pemeriksaan` (Setujui tahan 3 detik bila bertanda; Tolak alasan wajib ≥15 huruf; Berikutnya;
Setujui Banyak 2 langkah tahan 3 detik) + **KEU-L18 tab "Perlu Diperbaiki" di Buku Kas** (Koreksi/Batalkan lewat rincian yang ada;
angka di tombol tab = `perluDiperbaikiSaya` pada `dataBukuKas`) + kartu Beranda "Pemeriksaan". **+1 hak** `keu.periksa_buku_kas`
(Pemilik/GM batas keras; Finance ditolak H13; +2 tes HK11/HK12). **+3 mesin** (07.00; **58 total**) + 3 jenis tanda:
`penanda_lewat_3_hari` (`keu_pemeriksaan_lewat`), `pengingat_pemeriksaan` (Antrean per Pemilik/GM, `keu_pemeriksaan_menunggu`),
`penanda_perlu_diperbaiki` (`keu_perlu_diperbaiki_lewat`) — semua berhenti sendiri (TAM-25); +2 tes mesin. Aturan 06
(KEU-09/13/14/15/120/142/143/144) sudah ada & **beku, tidak diubah**. **SEAM (ditangguhkan):** struk menyusul L19/L20 + mesin
Penanda struk menyusul = **4H-2c**; UI "Finance catat Pribadi ATAS NAMA Ibu" (pembuatan baris `atas_nama`) = seam (gerbang
pemeriksaannya sudah dijaga); tanda "saldo minus"/"mungkin dobel" menunggu mesin Penanda saldo minus (4H-1). **DI-MERGE ke
`main` (PR #84).** **Migrasi 0057 + benih SUDAH dijalankan ke tempat uji** (26 Okt: "1 migrasi dijalankan"; benih "Mesin
otomatis: 3 baru, 55 sudah ada = **58 total**" = `penanda_lewat_3_hari`/`pengingat_pemeriksaan`/`penanda_perlu_diperbaiki` +
3 jenis tanda tersisip; tanpa hak baru dibenihi = batas keras).
Bagian 4H-2 TUNTAS; bagian 4H-3 (Catatan Cepat, Brankas, Hitung Kas — KEU-145 s.d. 154; spec bagian 3.3) dimulai di 4H-3a (lihat atas).
Riwayat: **4H-2a (Pintu "catat uang dari modul" + Catatan Tanpa Uang) SELESAI & DI-MERGE ke `main` (PR #81)**; hijau (1103 tes,
migrasi 56); CHANGELOG #296.
**4H-2a:** Membuka bagian **4H-2**, dipecah 3 sesi (pola 4H-1; lihat daftar di bawah). Migrasi **0056** (murni menambah):
ALTER `kejadian_kas` (+`modul_pemilik`/`diperiksa_di_keuangan`/`wajib_dipasangkan`); ALTER `baris_kas`
(+`modul_tabel`/`modul_nomor_asal`) + **indeks unik parsial** kunci asal (cegah dobel di DB); tabel baru **`catatan_tanpa_uang`**
(nomor TU-, kejadian, cabang, nominal, bulan laporan, kunci asal, status) + indeks unik kunci. Inti murni
`src/lib/keuangan-pintu-modul.ts`: `statusBarisModul` (status lahir dari KEJADIAN: diperiksa di Keuangan→'menunggu'; selain
itu→'dari_modul'), `nomorCatatanTanpaUang`, `kalimatPenolakanKetik` (KEU-137), `validasiCatatModul` (nominal bulat>0 PRI-28,
tak masa depan, tujuan wajib utk Pindah) + `validasiBetulkanModul` (+12 tes PM1–PM12, WAJ-06). **SATU pintu tulis (WAJ-04)**
`src/server/keuangan/pintu-modul.ts`: `catatDariModul` (idempoten kunci **modul+nomor asal+kejadian**, KEU-136; snapshot
kategori dari `versi_kejadian` pd tanggal uang), `batalDariModul`, `betulkanNominalModul` (hanya belum diperiksa),
`statusCatatanModul` (dibaca modul, LOG-86), `catatTanpaUang`/`batalTanpaUang` (KEU-138) + jejak KEU-17. Hak dijaga TOMBOL di
modul pemanggil, bukan pintu ini. Penolakan ketikan (KEU-23/137) di `pintu/keuangan.ts` `ambilKejadian` kini sebut modul
pemilik. Layar **KEU-L21** `/keuangan/catatan-tanpa-uang` (baca saja, Muat lagi) + kartu Beranda "Catatan Tanpa Uang". **+1
hak** `keu.lihat_catatan_tanpa_uang` (Pemilik/GM batas keras; +2 tes HK9/HK10). **+1 mesin** `pemeriksa_pintu_modul` (10 menit;
**55 total**) + jenis tanda `keu_pintu_modul_perhatian` (jaring pengaman kunci dobel; +2 tes mesin). **Benih:** +4 kategori
modul + **12 kejadian milik modul** (`siapa_mencatat='modul'`, tak muncul di KEU-L05) + 1 Catatan Tanpa Uang contoh ("Barang
reject"). Tanpa hak baru dibenihi (batas keras). Buku aturan 06 (KEU-136 s.d. 139) beku, tidak diubah. **SEAM (ditangguhkan):**
MENYAMBUNGKAN modul yang sudah ada (Gaji/Gaji Driver/Logistik) agar memanggil pintu ini = saat tiap modul disentuh berikutnya
(di 4H-2a hanya pintu + tesnya); pembalikan bulan-tutup sbg koreksi = 4H-11 (`bulan_tutup_keuangan` masih kosong); pemeriksaan
"asal modul dibatalkan tapi baris belum" (pasangan per modul) = saat modul disambung. **DI-MERGE ke `main` (PR #81). Migrasi
0056 + benih SUDAH dijalankan ke tempat uji** (26 Okt: "1 migrasi dijalankan"; benih "Mesin otomatis: 1 baru, 55 total" =
`pemeriksa_pintu_modul`; 12 kejadian milik modul — Gaji 2, Gaji Driver 4, Logistik 5, Keuangan 1; Bensin `diperiksa_di_keuangan`;
`TU-1 Barang reject` Rp150.000; jenis tanda `keu_pintu_modul_perhatian`; tanpa hak baru dibenihi = batas keras).
**Berikutnya: bagian 4H-2b** (Pemeriksaan KEU-L15/L16/L17 + Perlu Diperbaiki L18 + tabel `pemeriksaan_buku_kas` + 3 mesin).
Riwayat: **4H-1b-2b (Jadikan Pribadi, KEU-L14) SELESAI & DI-MERGE ke `main` (PR #79).** Hijau (**1087 tes**, migrasi sah **55**
— TANPA migrasi baru) + `npm run build`. CHANGELOG #295.
**4H-1b-2b:** TANPA migrasi (kolom `baris_kas.atas_nama`/`taut_diambil_owner` siap sejak 0053; hak baru cukup di kode). Tombol
**"Jadikan Pribadi"** di rincian baris **"Diambil Owner"** (Pindah Dana Laci → Brankas): Pemilik/GM menulis **satu baris baru
uang keluar "Pribadi" dari Brankas** (tempat tujuan baris asal), bertaut `taut_diambil_owner`, boleh sebagian; baris asal tak
berubah; Buku Ibu berkurang (dibaca 4H-8). Baris Diambil Owner tampilkan sudah/sisa. Inti murni `src/lib/keuangan-saldo.ts`
`sisaBisaPribadi` + `validasiJadikanPribadi` (+3 tes U101–U103, contoh spec U10). Server `jadikanPribadi` di
`src/server/keuangan/buku-kas.ts` (SATU tempat tulis + jejak KEU-17; `atas_nama` false). Pintu `jadikanPribadi` di
`keuangan.ts` (periksa pindah+kelompok `diambil_owner`+belum batal; cari kejadian "Pribadi" dari KELOMPOK diambil_owner arah
keluar, WAJ-05 bukan nama; snapshot kategori pada tanggal uang baris asal; cabang ikut Brankas); `rincianBaris` +4 medan
(`adalahDiambilOwner`/`sudahPribadi`/`sisaPribadi`/`bolehJadikanPribadi`). Baris Pribadi lahir 'menunggu' (diperiksa 4H-2),
bisa dibatalkan (KEU-L09) → Buku Ibu kembali. Layar KEU-L14 (2 langkah, tahan 3 detik) + tombol di KEU-L07. **+1 hak**
`keu.jadikan_pribadi` (Pemilik/GM batas keras; +2 tes HK7/HK8). **Benih:** kejadian "Diambil Owner" (Pindah, kelompok
diambil_owner) + **1 baris Diambil Owner contoh** (Laci→Brankas Rp3jt, 14 Okt, Diperiksa; idempoten) supaya tombol bisa
dicoba sebelum Laporan Kasir (4H-5). **SEAM (ditangguhkan):** "Finance catat Pribadi ATAS NAMA Ibu + diperiksa GM" (bagian
kedua KEU-135, kolom `atas_nama`) = **4H-2 (Pemeriksaan)**. **DI-MERGE ke `main` (PR #79). Benih (tanpa migrasi) SUDAH
dijalankan ke tempat uji** (26 Okt: "1 kejadian" = Diambil Owner + "1 baris Diambil Owner contoh"; mesin tetap 54; tanpa hak
baru dibenihi = batas keras). **Dengan ini 4H-1b TUNTAS; 4H-1 (Tempat Uang & Buku Kas) SELESAI SELURUHNYA.**
**Pembagian 4H-2** (Pemeriksaan & Pintu dari Modul Lain — KEU-136 s.d. 144; termasuk Finance "Pribadi atas nama"). **DIPECAH
3 SESI (disetujui pemilik 26 Okt 2026; pola 4H-1):**
**4H-2a** = Pintu server "catat uang dari modul" + kejadian milik modul + penolakan ketikan (KEU-23) + Catatan Tanpa Uang (L21)
+ migrasi `0056` + mesin Pemeriksa pintu modul — **SELESAI (sesi ini)**. (Tabel `pemeriksaan_buku_kas` dibuat di 4H-2b.)
**4H-2b** = Pemeriksaan L15/L16/L17 + Perlu Diperbaiki L18 (KEU-09/13/14/15/120; siapa periksa siapa P1, batas 3 hari P2,
setujui banyak P4) + tabel `pemeriksaan_buku_kas` + 3 mesin (Penanda lewat 3 hari, Pengingat Pemeriksaan, Penanda Perlu
Diperbaiki) — **SELESAI (sesi ini); migrasi 0057; 58 mesin; CHANGELOG #298**.
**4H-2c** = Struk menyusul L19/L20 (KEU-26; betulkan nominal, kembalian/kekurangan, terima tanpa struk/tagih ke pembawa P3) +
mesin Penanda struk menyusul + centang "struk menyusul" di L05/L07 — **SELESAI (sesi ini); migrasi 0058; 59 mesin; CHANGELOG
#299**. **Bagian 4H-2 TUNTAS SELURUHNYA.**
Riwayat: **4H-1b-2a (Kejadian & Kategori bertanggal) SELESAI & DI-MERGE ke `main` (PR #77).** CHANGELOG #294.
**4H-1b-2a:** Migrasi 0055 (murni menambah): ALTER `jenis_kategori_kas` (+`dibatalkan`/siapa/kapan/alasan supaya perubahan
jenis Terjadwal bisa dibatalkan sebelum berlaku); tabel baru **`versi_kejadian`** (peta kejadian→kategori + foto bukti
BERTANGGAL; backfill 1 versi/kejadian dari kolom cermin `kejadian_kas`). **Status Terjadwal/Berlaku/Dibatalkan DITURUNKAN di
kode** (dibatalkan→Dibatalkan; mulai>hari ini→Terjadwal; else Berlaku — tak perlu mesin pembalik). Inti murni
`src/lib/keuangan-kejadian.ts` (8 jenis+info laba KEU-20, 8 kelompok KEU-107, `statusVersi`/`bolehBatalVersi`/`pilihVersiPada`
KEU-129, `validasiTanggalBerlaku` tak mundur/tak di bulan tutup, `validasiKategoriBaru`/`validasiKejadian`, `akibatUbahJenis`;
+19 tes KK + 2 tes hak HK5/HK6, WAJ-06). Server `src/server/keuangan/kejadian-kategori.ts` (SATU tempat tulis + jejak KEU-17 +
`segarkanCerminKejadian`); pintu `src/server/pintu/keuangan-kejadian.ts`. **JALUR BACA UANG jadi bertanggal:** `ambilKejadian`
(catat/Pindah Dana), tanda "tanpa bukti" `dataBukuKas`, & koreksi kini baca kategori/foto dari `versi_kejadian` pada TANGGAL
UANG (baris snapshot kategori; jenis dibaca dari kategori pada tanggal uang saat laporan 4H-11). 3 layar
`/pengaturan/keuangan/kejadian` (L11 daftar 3 tab, L12 kejadian 4 langkah, L13 kategori/ubah jenis 3 langkah + akibat angka +
batal terjadwal; tahan 3 detik). Kartu menu Beranda "Kejadian & Kategori". **+1 hak** `keu.kelola_kejadian` (Pemilik/GM batas
keras; Finance lihat lewat `keu.lihat_buku_kas`). Benih: versi kejadian awal (idempoten; tanpa hak baru = batas keras). **TANPA
mesin otomatis baru.** **SEAM (ditangguhkan):** Jadikan Pribadi (L14) = 4H-1b-2b; kejadian "hanya dari modul" tak bisa
diubah di sini (4H-2). **DI-MERGE ke `main` (PR #77).** **Migrasi 0055 + benih SUDAH dijalankan ke tempat uji** (26 Okt:
"1 migrasi dijalankan"; versi_kejadian di-backfill oleh migrasi 0055 + benih idempoten; mesin tetap 54; tanpa hak baru
dibenihi = batas keras).
Riwayat: **4H-1b-1 (Tempat Uang & Saldo Awal) SELESAI & DI-MERGE ke `main` (PR #74; perbaikan pemegang-rekening PR #75)**;
hijau (1061 tes, migrasi 54); CHANGELOG #293.
**MODUL 5 (Gaji Driver/Bongkaran/Kasbon, 4G) TUNTAS SELURUHNYA.** Bagian 4H-1a (Buku Kas inti) SELESAI & DI-MERGE (PR #72).
**Keputusan pemilik 26 Okt 2026:** mulai modul Keuangan sesudah 4G tuntas; **bagian 4H-1 dipecah 2 sesi** (pola 3-e/5-f):
4H-1a inti uang + 7 layar diketik (L04–L10) **SELESAI**; **4H-1b dipecah lagi 2 sub-sesi (disetujui pemilik 26 Okt 2026,
pola 5-d/5-e/5-f):** **4H-1b-1** = Tempat Uang & Saldo Awal (L01–L03 + lima jenis + pemegang + penyaring N1) **SELESAI**;
**4H-1b-2** = Kejadian/Kategori + Jadikan Pribadi (L11–L14) **DIPECAH LAGI 2 sesi (disetujui pemilik 26 Okt 2026):** **4H-1b-2a**
= Kejadian & Kategori L11–L13 + tabel versi + ubah cara baca jalur uang (sesi ini); **4H-1b-2b** = Jadikan Pribadi L14 (berikutnya).
**4H-1b-1:** Migrasi 0054 (murni menambah): ALTER `tempat_uang` (+`jenis_kas` lima jenis tetap di kode; `urutan`; rincian
rekening bank/nomor/atas_nama/dicocokkan_oleh; jejak nonaktif) — kolom lama `jenis` (cara bayar tunai/transfer) DIBIARKAN &
diisi dari `jenis_kas` supaya modul Gaji tak berubah. Tabel baru **`pemegang_tempat_uang`** (bertanggal; ganti = baris baru;
Laci `penutup_shift` pemegang NULL). `saldo_awal_tempat_uang` (0053) hanya DIPAKAI. Inti murni `src/lib/keuangan-tempat-uang.ts`
(lima jenis + validasi + `bolehNonaktif` saldo Rp0 + `bolehGantiPemegangLangsung` + `bolehMengesahkan` ≠ pengisi; +14 tes TU,
+4 tes hak HK, WAJ-06). Server `src/server/keuangan/tempat-uang.ts` + `saldo-awal.ts` (SATU tempat tulis + jejak KEU-17);
pintu `src/server/pintu/keuangan-tempat-uang.ts`. **Penyaring N1 PENUH** (Finance tak lihat saldo Brankas) disambung di
`dataBukuKas` (`saldoSemua` baca `jenis_kas`) — melengkapi yang ditangguhkan 4H-1a. 3 layar `/pengaturan/keuangan/tempat-uang`
(L01 daftar, L02 Baru/Ubah 3 langkah + Ganti pemegang + Nonaktif, L03 Saldo Awal isi/sahkan/kembalikan). Kartu menu Beranda
"Tempat Uang". **+3 hak `keu.*`** (kelola_tempat_uang & sahkan_saldo_awal Pemilik/GM batas keras; isi_saldo_awal Finance+P/GM).
Benih: lima jenis tempat uang contoh + pemegang awal + `keu.isi_saldo_awal` ke Finance. **SEAM (ditangguhkan):** ganti pemegang
Brankas/Kas Pegangan yang BERISI lewat Hitung Kas serah terima = 4H-3. **Migrasi 0054 + benih SUDAH dijalankan ke tempat uji**
(26 Okt: "1 migrasi dijalankan"; benih "1 baris hak" = `keu.isi_saldo_awal` Finance, "lima jenis tempat uang + pemegang";
mesin tetap 54). **Perbaikan sesudah benih pertama (PR #75):** rekening bank tak menulis baris pemegang (CHECK
`pemegang_tempat_uang`); rekening dilacak lewat `dicocokkan_oleh`.
Riwayat **4H-1a:** Migrasi 0053 (murni menambah): `kategori_kas`, `jenis_kategori_kas` (8 jenis bertanggal), `kejadian_kas`,
`saldo_awal_tempat_uang`, `bulan_tutup_keuangan` (kosong, dipakai bulan laporan; diisi 4H-11), dan **`baris_kas`** = SATU Buku
Kas (nama dipilih supaya kolom seam `baris_kas` di 0045/0049/0051/0052 menautnya saat 4H-2). `tempat_uang` (0032) dipakai apa
adanya — perluasan 5 jenis + pemegang = 4H-1b. Inti uang murni `src/lib/keuangan-saldo.ts`: `hitungSaldo` (KEU-128),
`bulanLaporan` (KEU-134), `selisihPenyesuaian`, validasi (+21 tes U, WAJ-06). Server `src/server/keuangan/saldo.ts` +
`buku-kas.ts` (SATU tempat tulis + jejak KEU-17); pintu `src/server/pintu/keuangan.ts`. 7 layar `/keuangan/buku-kas`
(L04 daftar+saldo, L05 catat 4 langkah, L06 Pindah Dana, L07 rincian+riwayat, L08 koreksi, L09 batal, L10 penyesuaian;
tahan 3 detik pada tulis uang). **+4 hak `keu.*`** (lihat_buku_kas & catat_kas Finance+P/GM; batalkan_kas & penyesuaian_saldo
P/GM batas keras). **+1 pengaturan** `keu_tanggal_uang_mundur_hari` (7). Benih kategori+kejadian awal (KEU-123) + saldo awal
contoh. Kartu menu Beranda. **TANPA mesin baru (54).** **SEAM (ditangguhkan):** baris dari modul + halaman Pemeriksaan +
struk menyusul = 4H-2 (baris diketik lahir & tetap 'menunggu'); penyaring N1 penuh (saldo Brankas per jenis) + N4 (libur
finance perpanjang batas mundur) = 4H-1b/Kehadiran. **Migrasi 0053 + benih SUDAH dijalankan ke tempat uji** (26 Okt:
"1 migrasi dijalankan"; benih "2 baris hak" = `keu.lihat_buku_kas`+`keu.catat_kas` Finance, "1 nilai awal" =
`keu_tanggal_uang_mundur_hari`, "6 kategori, 20 kejadian, saldo awal contoh"; mesin tetap 54 — tanpa mesin baru).
Riwayat: **LANGKAH 5 BAGIAN 5-f-3b (Gaji Driver 4G-4b: orang berhenti→Piutang Lain + Kasbon Khusus
DRV-L37 + bawaan + mesin Pemeriksa kasbon) SELESAI & DI-MERGE ke `main` (PR #70)**. Hijau `npm run cek` (**1022 tes**, migrasi sah
**52**) + `npm run build`. CHANGELOG #291. **MODUL KASBON 4G-4b SELESAI SELURUHNYA.**
**Migrasi 0052 + benih SUDAH dijalankan ke tempat uji** (26 Okt: "1 migrasi dijalankan"; benih "Mesin otomatis: 1 baru,
54 total" = `pemeriksa_kasbon`; "2 nilai awal" = pengaturan kejadian + kali potong maks Khusus; jenis tanda `drv_kasbon_perlu_perhatian`).
**5-f-3b:** Migrasi 0052 (ALTER `kasbon` +kejadian_khusus/alasan; `penyerahan_kasbon.asal` += 'bawaan'). Desain:
Kasbon Khusus & bawaan tetap punya baris `pengajuan` 'disetujui' (pembuat=penyetuju, tanpa antrean) supaya mesin kasbon
dipakai apa adanya. **Kasbon Khusus** (`buatKasbonKhusus` + pintu + layar DRV-L37 4 langkah + tombol DRV-L26): Pemilik/GM
bukan diri, langsung disetujui, lewati 6 bulan/batas/dana (dana NULL, tak dihitung terpakai), nominal kelipatan tanpa batas
atas, kali potong 1–12; "Buat dan serahkan sekarang" → DRV-L29. **+1 hak** `drv.buat_kasbon_khusus` + **2 pengaturan**
(daftar kejadian, kali potong maks khusus 12). **Bawaan** (`buatKasbonBawaan`, pintu server + tes saja, TANPA layar — entri
Finance = Tahap 5): sisa, kali potong ≤3, penyerahan `asal='bawaan'` tanpa Buku Kas, pasang jadwal, **dihitung di terpakai**
(query `jenis_kasbon IN ('biasa','bawaan')`). **+1 hak** `drv.buat_kasbon_bawaan`. **Orang berhenti→Piutang Lain** (DRV-73):
`tutup-slip` langkah 9 tulis mutasi `'dialihkan'` per kasbon (sisa→0, Dialihkan; slip=slipId utk buka-kembali; piutang_lain
NULL = 4H). Helper `tanggalBerhentiTercatat` → pelapis DRV-121 (tolak pengajuan baru), tolak serah sesudah hari terakhir,
tolak tunda, `hitungSlotCicilan` tak lewat slip terakhir. **Mesin `pemeriksa_kasbon`** (10 mnt; **54 total**) + jenis tanda
`drv_kasbon_perlu_perhatian`: jaring sisa≠jadwal, cicilan tertinggal, berhenti belum dialihkan, dll → perlu perhatian GM
(cek "tanpa baris Buku Kas" ditangguhkan ke 4H). Inti uang murni +`validasiNominalKhusus`/`validasiKasbonKhusus`/
`validasiKasbonBawaan` (+9 tes U96–U98, H54/H55, 2 mesin). **Migrasi 0052 + benih BELUM dijalankan ke tempat uji** (sesudah merge).
Riwayat: **5-f-3a (Gaji Driver 4G-4b: Ubah jadwal cicilan DRV-L36 + Pindah slip
utama mesin) SELESAI & DI-MERGE ke `main` (PR #68)**. Hijau `npm run cek` (**1012 tes**, migrasi sah **51** — TANPA migrasi baru) + `npm run build`. CHANGELOG #290.
**Benih SUDAH dijalankan ke tempat uji** (26 Okt: tanpa migrasi baru; benih "Mesin otomatis: 1 baru, 53 total" = `pindah_slip_utama_kasbon`).
**5-f-3 DITATA ULANG jadi 2 sesi, DISETUJUI pemilik 26 Okt 2026** (jumlah sesi tetap 2, sesuai pilihan "pecah 2"): **5-f-3a**
= ubah jadwal + pindah slip utama (sesi ini); **5-f-3b** = orang berhenti→Piutang Lain + Kasbon Khusus + bawaan + mesin
Pemeriksa kasbon. Alasan tata ulang: bawaan & Khusus sama-sama "kasbon tanpa pengajuan biasa"/"dianggap diberikan" dan
menyentuh 20+ query inti + seam `tutup-slip`; disatukan di 5-f-3b supaya tidak menyebar perubahan jalur uang ke dua sesi.
**5-f-3a:** TANPA migrasi (pakai ulang jadwal berversi 0050: `tulisVersiJadwal`/`cicilanTerjadwalKini`/`hitungSlotCicilan`;
sebab 'ubah_jadwal'/'pindah_slip_utama' sudah ada). Pustaka murni `gaji-kasbon.ts` +`validasiUbahJadwal`/`batasKaliPotongUbah`
(3 biasa-bawaan / 12 Khusus)/`samaJadwalPeriode` (+8 tes U92–U95 dkk). Server `ubah-jadwal-kasbon.ts` (ubahJadwalKasbon
jumlah rupiah TETAP, bukan kasbon sendiri C2, slip mulai ≤3 slip; calonSlipMulai) + `pindah-slip-utama-kasbon.ts`
(pindahSlipUtamaKasbon idempoten: tata ulang Terjadwal ke slip utama kini, banyak & nominal tetap). Pintu
`gaji-driver-ubah-jadwal-kasbon.ts` + layar DRV-L36 (3 langkah, tahan 3 detik). **+1 hak** `drv.ubah_jadwal_kasbon`
(P/GM batas keras akses penuh). **+1 mesin** `pindah_slip_utama_kasbon` (10 menit; **53 total**) + 2 tes mesin. Tombol
"Ubah jadwal" di DRV-L28; label "Jadwal diubah" di DRV-L38. Buku aturan TIDAK diubah (DRV-135/142 + pengaturan sudah ada,
BEKU). **Benih idempoten (hanya +1 mesin) BELUM dijalankan ke tempat uji** (dijalankan sesudah merge; tanpa migrasi).
**Berikutnya: bagian 5-f-3b (orang berhenti→Piutang Lain + Kasbon Khusus DRV-L37 + bawaan + mesin Pemeriksa kasbon).**
Riwayat: **5-f-2 (Kasbon 4G-4b pelunasan tunai + hapus utang + batal + tunda cicilan) SELESAI & DI-MERGE ke `main` (PR #66)**. CHANGELOG #289.
**5-f-2:** Migrasi 0051 (`pelunasan_kasbon` uang masuk, `hapus_kasbon` tanpa uang; FK mutasi.pelunasan/.hapus; maksud `tunda`).
Inti uang murni `kurangiBerurutan` (urutan C3) + `validasiNominalPelunasan` + `kembalikanKeJadwal` (+18 tes). Server
`src/server/gaji/pelunasan-kasbon.ts` (terimaPelunasanKasbon K3/H44, hapusUtangKasbon DRV-70, batalPelunasanAtauHapus) &
`tunda-kasbon.ts` (syaratTunda, terapkanTundaCicilan H42, gugurkanTundaLewat C1). Helper versi jadwal `tulisVersiJadwal`/
`cicilanTerjadwalKini`/`sisaDibawaKasbon` di `cicilan-kasbon.ts`; penghitung slot `hitungSlotCicilan` diekstrak di `serah-kasbon.ts`.
Efek pengajuan `drv_tunda_cicilan` (Persetujuan umum = DRV-L33). **+4 hak** (terima_pelunasan Finance; hapus_utang & batal_pelunasan_atau_hapus
P/GM batas keras; minta_tunda lantai diri + HR/Admin HR atas nama). **+1 jenis pengajuan** `drv_tunda_cicilan`. **+2 mesin**
`penggugur_tunda_cicilan` (10 mnt) & `pengingat_tunda_cicilan` (07.00; **52 total**) + jenis tanda `drv_tunda_menunggu`. 4 layar
DRV-L34/L35/L39/L32 + tombol DRV-L28/L23. **SEAM 4H:** Buku Kas uang masuk "Pelunasan kasbon" & biaya "Utang kasbon dihapus"
diturunkan Keuangan (`baris_kas`/`baris_biaya` NULL). Migrasi 0051 + benih **SUDAH dijalankan ke tempat uji** (26 Okt: "1 migrasi
dijalankan"; benih "1 jenis + jenis tanda" = `drv_tunda_cicilan`/`drv_tunda_menunggu`, "3 baris hak" = terima_pelunasan Finance +
minta_tunda HR/Admin HR, "Mesin otomatis: 2 baru, 52 total").
Riwayat: **5-f-1 (Gaji Driver 4G-4b INTI UANG cicilan di slip + pondasi DB) SELESAI & DI-MERGE ke `main` (PR #64)**; CHANGELOG #288.
**Bagian 5-f (4G-4b) DIPECAH 3 SESI, DISETUJUI pemilik 25 Okt 2026:** 5-f-1 inti uang + pondasi; 5-f-2 pelunasan/hapus/
batal/tunda; 5-f-3 ubah jadwal/Kasbon Khusus/berhenti→Piutang Lain/pindah slip utama/bawaan.
**5-f-1:** Migrasi 0050 (`mutasi_kasbon`, `riwayat_jadwal_kasbon` + ALTER `sisa_potongan` kasbon/cicilan; unik 1 Terjadwal
per cicilan). Inti uang murni `sisaDariMutasi` (DRV-67) + `statusCicilanSesudahTandai` (+7 tes). Server
`src/server/gaji/cicilan-kasbon.ts` (`sisaKasbon`, `cicilanJatuhTempo`, `tandaiCicilanSlip`, `tandaiSisaKasbon`,
`balikTandaKasbonSlip`). Seam Gaji: `hitung-potongan` R14 kel.(d), `hitung-slip` tautan `cicilan_kasbon`, `tutup-slip`
langkah 7b/8 (kasbon per-cicilan, BUKAN sisa dibawa generik), `buka-kembali-slip` balik. **Dana Kasbon terisi = `terpakai`
kini dari SISA** (mutasi), bukan nominal akhir, untuk kasbon "Sudah diberikan" (`src/server/gaji/kasbon.ts`, DRV-57). +1 hak
`drv.lihat_kasbon_berjalan`. Layar DRV-L38 `/gaji/kasbon/berjalan` + bagian Cicilan berjalan di DRV-L23/L28. **Tanpa mesin
baru (50).** **Migrasi 0050 + benih SUDAH dijalankan ke tempat uji** (25 Okt: "1 migrasi dijalankan"; benih "2 baris hak" =
`drv.lihat_kasbon_berjalan` HR+Finance; 50 mesin tetap).
**Seam 5-f-1 (sesi berikut):** jadwal berversi ditulis-ulang (tunda/ubah/pindah = 5-f-2/5-f-3; `riwayat_jadwal_kasbon`
siap); pelunasan/hapus/batal/tunda (5-f-2); berhenti→Piutang Lain, Kasbon Khusus, pindah slip utama, bawaan (5-f-3);
mesin "Pemeriksa kasbon" 10-menit (basis belum pernah dibangun di 5-e — dibuat bersama 5-f berikut; bukan jalur uang).
Riwayat: **5-e-2 (Gaji Driver 4G-4a Kasbon serah uang dsb — INTI UANG) SELESAI & DI-MERGE ke `main` (PR #62)**; CHANGELOG
#287. **MODUL 4G-4a (Kasbon sampai uang diberikan) SELESAI.**
**Migrasi 0049** (`penyerahan_kasbon` — satu cair per kasbon; `kasbon_pengajuan_terkait`) + **+1 mesin** `pengingat_kasbon`
(07.00; **50 total**) + **+3 hak `drv.*`** (serahkan_uang_kasbon Finance+P/GM batas keras; minta_batal_kasbon & lapor_kasbon_belum_diterima
lantai 'diri') + **+2 jenis pengajuan** (drv_minta_batal_kasbon, drv_kasbon_belum_diterima 3 hari) + **+2 jenis tanda**
(drv_kasbon_lewat_2hari, drv_kasbon_belum_diberikan). Inti uang: `src/lib/gaji-kasbon.ts` +`tanggalUangKasbonSah` (K4) +
`pilihSlotCicilan` (DRV-65, lewati slip ditutup) + `validasiAlasanBatalSerah` (**+15 tes, 66 U**). Server `serah-kasbon.ts`
(serahkanKasbon satu transaksi + pasangJadwalKasbon + batalkanKasbon + batalSerahKasbon) & `kasbon-saya.ts` (mintaBatal +
laporBelumDiterima). Pintu `gaji-driver-serah-kasbon.ts`; `gaji-driver-kasbon.ts` diperluas (keadaan "Sudah diberikan",
penyerahan di rincian, tombol serah/batal). Efek pengajuan `drv_minta_batal_kasbon` (disetujui=batalkanKasbon) &
`drv_kasbon_belum_diterima` (hanya kabar). 3 layar DRV-L29/L30/L31 + perbaruan DRV-L23/L28. **"Minta dibatalkan" (DRV-72)
IKUT (disetujui pemilik 25 Okt 2026).** **SEAM Keuangan 4H:** baris Buku Kas uang keluar "Kasbon diberikan" diturunkan Keuangan
dari `penyerahan_kasbon` (`baris_kas` NULL). Migrasi 0049 + benih **SUDAH dijalankan ke tempat uji** (25 Okt: "1 migrasi
dijalankan"; benih "1 baris hak" Finance serahkan + "2 jenis + jenis tanda" + "Mesin otomatis: 1 baru, 50 total").
Berikutnya: **bagian 5-f-2 (4G-4b: pelunasan tunai + hapus utang + batal pelunasan/hapus + tunda cicilan; tabel
`pelunasan_kasbon`, `hapus_kasbon`; DRV-L32/L33/L34/L35/L39; seam Buku Kas 4H; Penggugur tunda + Pengingat tunda).**
Sebelumnya 25 Okt: **5-d-2b-2 (Gaji Driver 4G-3b sisa: Bongkaran per Orang DRV-L22 + Excel, seam Pendapatan Saya + Total
Diterima GAJ-114, DRV-L11 susulan + Jadwal Bayar jalur bongkaran, centang berat) SELESAI & DI-MERGE ke `main` (PR #58)**;
CHANGELOG #285; migrasi 0047; 4G-3b (Bayar Bongkaran) TUNTAS.
Sebelumnya 25 Okt: **5-d-2b-1 (4G-3b Lebih Bayar DRV-L21 + mesin penanda 30 hari + "Tanyakan dulu") SELESAI & DI-MERGE ke
`main` (PR #56)** (915 tes, migrasi 46 tanpa migrasi baru; CHANGELOG #284; +1 mesin `penanda_lebih_bayar_lewat` 49 total).
Benih SUDAH dijalankan ke tempat uji.
Sebelumnya 25 Okt: **5-d-2a (4G-3b Koreksi/Batalkan + "selisih bongkaran" + susulan + bayar susulan) SELESAI & DI-MERGE ke
`main` (PR #54)** (903 tes, migrasi 46; CHANGELOG #283; tanpa mesin baru 48). Migrasi 0046 + benih SUDAH dijalankan ke tempat uji.
Sebelumnya 25 Okt: **5-d-1 (4G-3b Bayar & Batal Bayar) SELESAI & DI-MERGE ke `main` (PR #52)** (889 tes, migrasi 45;
CHANGELOG #282; +1 mesin `pengingat_bongkaran_belum_dibayar`, 48 total). Migrasi 0045 + benih SUDAH dijalankan ke tempat uji.
Sebelumnya 25 Okt: **5-c (4G-3a Laporan Bongkaran) SELESAI & DI-MERGE** (869 tes, migrasi 44; CHANGELOG #281). Migrasi 0044
+ benih SUDAH dijalankan ke tempat uji (25 Okt: 8 baris hak, jenis pengajuan `drv_laporan_bongkaran_terlambat`, pengaturan
`drv_tarif_bongkaran` Rp20, 3 produk kasir contoh).
**Next.js SUDAH di-upgrade 16.4.0 → 16.4.3** (advisory keamanan, PR #50 di-merge; `experimental.agentUpgrade="security"`
di next.config.ts; build kini bersih tanpa SecurityFatalError).
Riwayat: bagian 5-b (Slip Mingguan & Denda) SELESAI & DI-MERGE ke `main` (PR #47); CHANGELOG #280.
Pembagian **6 bagian 5-a s.d. 5-f DISETUJUI pemilik 22 Okt 2026** (satu sub-bagian spec = satu sesi, pola 4E/4F).
Bagian 5-a (4G-1 Tarif & Ritase) SELESAI & DI-MERGE ke `main` (PR #45); CHANGELOG #279. Riwayat modul sebelumnya di bawah.
**Modul Gaji Bulanan 4E SELESAI**. **MODUL 4 LOGISTIK (4F) SELESAI SELURUHNYA** — 4-a s.d. 4-h di `main`.
Pembagian **8 bagian (4-a s.d. 4-h) DISETUJUI pemilik 21 Okt 2026**, mengikuti sub-bagian spec,
satu bagian satu sesi. **Bagian 4-a (4F-1) SELESAI & DI-MERGE ke `main` (PR #34); CHANGELOG #271.**
**Bagian 4-b (4F-2 Rencana & Trip Truk) SELESAI & DI-MERGE ke `main` (PR #36); CHANGELOG #272.**
**Bagian 4-c (4F-3 Laporan Muat Cabang, Paket, Antar Sendiri) SELESAI & DI-MERGE ke `main`
(PR #38) — 13 layar LOG-L25–L37; CHANGELOG #273.**
**Bagian 4-d (4F-4a Kirim & Uang) SELESAI & DI-MERGE ke `main` — 9 layar LOG-L38–L46, INTI UANG
"bagi uang kunjungan" LOG-112 (tes WAJ-06); CHANGELOG #274.**
**Bagian 4-e (4F-4b Tidak Terkirim & Retur) SELESAI & DI-MERGE ke `main` — 11 layar LOG-L47–L57,
UANG "nilai retur per cabang" LOG-124 (tes WAJ-06); CHANGELOG #275.**
**Bagian 4-f (4F-5a Pemeriksaan Uang) SELESAI & DI-MERGE ke `main` — 6 layar LOG-L58–L63, INTI UANG
serah tunai + selisih serah + Kas Masuk LOG-62/64/129 (tes WAJ-06); CHANGELOG #276.**
**Bagian 4-g (4F-5b Kiriman ke Kasir & Daftar Tagih) SELESAI & DI-MERGE ke `main` — 7 layar LOG-L64–L70, INTI
UANG satu daftar "Catat di Kasir" + kunci nota + koreksi + Daftar Tagih (tes WAJ-06); CHANGELOG #277.**
**Bagian 4-h (4F-5c Dashboard, Laporan, Bensin) SELESAI — 7 layar LOG-L71–L77, ada UANG bensin (tes WAJ-06);
CHANGELOG #278. BAGIAN TERAKHIR — MODUL LOGISTIK SELESAI.**
Hijau `npm run cek` (**796 tes**, migrasi sah **41**) + `npm run build`. Migrasi 0041 + benih **SUDAH dijalankan ke tempat uji** (22 Okt: "1 migrasi dijalankan"; benih "2 mesin baru, 46 total"; 16 baris hak; 1 permintaan bensin).)

> **Kerja git & deploy (keputusan pemilik 20 Okt 2026) — WAJIB diikuti:**
> 1. **Claude push & merge MANDIRI** saat satu bagian selesai & hijau — tidak menunggu
>    pemilik mengingatkan. Alurnya: cabang → `npm run cek` → **`npm run build`** →
>    push → `gh pr create` → `gh pr merge`.
> 2. **Pagar build di `.githooks/pre-push`**: `npm run build` dijalankan tiap push;
>    build gagal = push ditolak (cegah deploy Vercel error seperti 20 Okt; CHANGELOG #262, #266).
>    **Selalu jalankan `npm run build`, bukan hanya `npm run cek`, sebelum push.**
> 3. **Urutan ke tempat uji SELALU: `npm run migrasi` dulu, baru `BENIH_TEMPAT_UJI=ya
>    npm run benih`.** Benih duluan padahal ada tabel baru = "relation ... does not exist".
> 4. Sesudah `/clear`, `core.hooksPath` bisa kosong → hidupkan: `git config core.hooksPath .githooks`.

> **Riwayat detail per sesi (bagian 1-a s.d. 1-k) dipindah ke `WIP-arsip.md`.**
> WIP ini sengaja dibuat ramping supaya hemat token dibaca tiap sesi. Kalau perlu
> tahu cara sebuah bagian lama dikerjakan, buka arsip itu.

## Status sekarang (ringkas)

- **Paket BEKU.** Aturan & spec tidak diubah; perbaikan kesalahan boleh kalau pemilik
  setuju + dicatat di CHANGELOG bertanda "diperbaiki sesudah beku".
- **Tahap 6 (Pembangunan). Pondasi utuh.**
- **Langkah 1 (Karyawan dan Akses + Perlengkapan Bersama) SELESAI dan sudah di `main`.**
  Dipecah 11 bagian 1-a s.d. 1-k; semua selesai, diuji, dan digabung lewat PR #13–#17.
  Database tempat uji (Supabase) sudah terpasang penuh (migrasi 0001–0020 + benih:
  8 akun contoh, 8 mesin otomatis, 79 baris daftar periksa uji).
- **Perbaikan sesudah beku terakhir:** skrip `migrasi`/`benih` memuat `.env.local`
  sendiri (CHANGELOG 253, PR #18). Jalankan cukup `npm run migrasi` /
  `BENIH_TEMPAT_UJI=ya npm run benih`.
- **Langkah 2 = modul Kehadiran (4D) SELESAI & SELURUHNYA di `main`.** Bagian 2-a..2-e
  (PR #19, #20, #21; 2-c/2-d/2-e digabung lewat PR #21 `kehadiran-sisa-langkah2`, merge
  `c37cb5a`). 431 tes saat akhir Langkah 2. Migrasi 0021–0025 **SUDAH dijalankan ke tempat uji**
  (dikonfirmasi 21 Okt: `npm run migrasi` melapor 33 migrasi semua jalan, tidak ada tertunda).
  Catatan: `core.hooksPath` bisa kosong sesudah `/clear` (pagar `pre-push` mati); hidupkan
  dengan `git config core.hooksPath .githooks` (sudah dijalankan sesi ini).
- **Langkah 3 = Gaji Bulanan (4E).** Pembagian 6 bagian **DISETUJUI pemilik 20 Okt 2026**.
  - **Bagian 3-a (4E-1 Komponen & Pengaturan Gaji) SELESAI (lokal), belum di-push**
    (push oleh pemilik). Hijau (`npm run cek`, 463 tes, 34 berkas; migrasi sah 26).
    8 layar (GAJ-L01 s.d. L08) + migrasi 0026 (6 tabel) + 3 mesin baru (25 total) +
    13 tindakan `gaj.*` + 8 pengaturan gaji didaftarkan ke kerangka 4B. Lengkap di CHANGELOG #260.
  - **Bagian 3-b (4E-2 Hitungan dari Kehadiran) SELESAI (lokal), belum di-push** di cabang
    `gaji-3b-hitungan-kehadiran` (dari `gaji-3a-komponen-pengaturan`). Hijau (`npm run cek`,
    **494 tes**, 36 berkas; migrasi sah **27**). **Inti uang:** SATU fungsi server
    `hitungKehadiran` (`src/server/gaji/hitung-kehadiran.ts`, WAJ-04) merangkai baris R1–R9
    dari seam Kehadiran (`hari_kerja`, `tanggal_tidak_masuk.jenis_hitungan`, lembur disahkan,
    kompensasi) + gaji (3-a) + aturan. Rumus rupiah di pustaka murni `gaji-hitung.ts` &
    `gaji-denda.ts` → **tes WAJ-06** (U9–U26). Migrasi 0027 (3 tabel: denda_kehadiran,
    peniadaan_potongan, koreksi_periode_lalu) + 2 mesin baru (**27 total**) + 4 tindakan `gaj.*`
    + 15 pengaturan rumus uang + 3 layar (GAJ-L09/L10/L11). GAJ-L07 kini menampilkan contoh
    dihitung. Migrasi 0027 + benih **BELUM dijalankan ke tempat uji** (dijalankan pemilik saat
    push). Lengkap di CHANGELOG #261.
  - **Bagian 3-c (4E-3 Potongan di Luar Kehadiran) SELESAI & DI-MERGE ke `main` (20 Okt)** (dulu cabang
    `gaji-3c-potongan-luar`). Hijau (`npm run cek`, **514 tes**,
    38 berkas; migrasi sah **28**). **Inti uang:** SATU fungsi server `hitungPotongan`
    (`src/server/gaji/hitung-potongan.ts`, WAJ-04) merangkai R10–R15 + **urutan pengambilan & sisa
    potongan** (GAJ-75), memanggil `hitungKehadiran` untuk pendapatan & kelompok (a). Rumus rupiah di
    pustaka murni `gaji-potongan.ts` (bagiKehilangan/bagiMinusKasTanpaNama/jadwalCicilan/urutanPotongan)
    → **tes WAJ-06** (U31–U48, 17 tes). Migrasi 0028 (9 tabel) + perangkai `pembagian.ts` + 3 mesin
    baru (**30 total**: penghitung_pembagian, pemeriksa_tanggungan, penutup_keberatan_potongan) +
    15 tindakan `gaj.*` + 4 pengaturan (persen/bobot bersasaran, kali potong maks, masa keberatan) +
    3 jenis pengajuan (usulan/keberatan/usul_pengaturan_umum) + 8 layar (GAJ-L12 s.d. L19). Migrasi
    0028 + benih **SUDAH dijalankan ke tempat uji** (20 Okt). **DI-MERGE ke `main` 20 Okt.** Lengkap di CHANGELOG #263.
  - **Bagian 3-d (4E-4 Buku Bonus & Dua Dana) SELESAI & DI-MERGE ke `main` (20 Okt)** (dulu cabang
    `gaji-3d-bonus-dana` dari `gaji-3c-potongan-luar`). Hijau (`npm run cek`, **530 tes**, 39 berkas;
    migrasi sah **29**). **Inti uang:** SATU pintu tulis `catatBonus` (`src/server/gaji/bonus.ts`, WAJ-04)
    menghitung nominal dari pengaturan jenis bonus pada tanggal kejadian, menolak penerima tak berhak
    (→ Ditahan), cegah dobel lewat kunci asal; Dua Dana (saldo **dihitung** dari `mutasi_dana`). Rumus
    rupiah di pustaka murni `gaji-bonus.ts` (bonus persen, Saldo/Terpesan/Tersedia, ringkas tidak hadir)
    → **tes WAJ-06** (U49–U60, 12 tes). Migrasi 0029 (6 tabel) + 1 mesin (`pemeriksa_bonus_ditahan`,
    **31 total**) + efek pengajuan `gaj_usulan_bonus` + 9 tindakan `gaj.*` + 8 layar (GAJ-L20 s.d. L27).
    Migrasi 0029 + benih **SUDAH dijalankan ke tempat uji** (20 Okt). Lengkap di CHANGELOG #264.
  - **Perbaikan sesudah beku (20 Okt):** build Vercel gagal (pg ke bundel peramban) → diperbaiki
    (`src/lib/hari-label.ts`, PR #24, CHANGELOG #262); pagar build dipasang (CHANGELOG #266); catatan
    rilis #2 "Apa yang Baru" (CHANGELOG #265).
  - **Bagian 3-e dipecah dua sesi (keputusan pemilik 21 Okt 2026):** inti uang 14 langkah paling aman
    diselesaikan & diuji utuh dalam satu sesi; cetakan PDF pakai cetak peramban (tanpa pustaka baru).
    - **Bagian 3-e-1 (4E-5a inti Tutup Slip) SELESAI & DI-MERGE ke `main` (21 Okt, PR #26)** (dulu cabang
      `gaji-3e-tutup-slip`). Hijau (`npm run cek`, **545 tes**, 40 berkas; migrasi sah **30**)
      + `npm run build`. **Inti uang:** `hitung-slip.ts` (SATU fungsi "hitung slip" merangkai 4E-2+4E-3+4E-4
      → bentuk slip), `penahan-slip.ts` (6 penahan, 1–4 di 3-e-1), `tutup-slip.ts` (langkah tutup 14
      sub-langkah SATU transaksi: baris slip, tandai sumber masuk_slip/terpotong, **mutasi dua dana**
      GAJ-87/88, bonus→masuk_slip, **kunci `hari_kerja.terkunci_pada`**, jejak). Pustaka murni
      `src/lib/gaji-slip.ts` (nomor slip, rute dana, prorata komponen, masa keberatan) → **tes WAJ-06**
      (U61–U73, 13 tes). Migrasi 0030 (3 tabel: slip, baris_slip, slip_nomor, langkah_slip) + mesin
      `pembuat_slip` (05.30, **32 mesin**) + 2 hak `gaj.*` + 3 layar (GAJ-L28/L29/L30). Seam bonus 3-d→3-e
      ditutup (`bonusMasukSlip` mengisi pendapatan bonus di `hitungPotongan`). Migrasi 0030 + benih
      **SUDAH dijalankan ke tempat uji** (dikonfirmasi 21 Okt: 33 migrasi semua jalan). Lengkap di CHANGELOG #267.
    - **Bagian 3-e-2 (4E-5a sisa) SELESAI & DI-MERGE ke `main` (21 Okt, PR #28)** (dulu cabang
      `gaji-3e2-sisa-tutup-slip`). Hijau (`npm run cek`, **549 tes**, 41 berkas; migrasi sah **31**) + `npm run build`.
      Yang dibangun (lengkap di CHANGELOG #268): Migrasi 0031 (`cetak_slip`, `minta_buka_slip`, status
      `dibatalkan` di `sisa_potongan`); **slip terakhir** (flag `slipTerakhir` dialirkan ke urutan potongan
      yang sudah teruji → Piutang Lain kel. b/c/d ditandai `menjadi_piutang`); **GAJ-58** (denda berhenti
      tanpa pemberitahuan = seluruh sisa bersih → Dana Disiplin, bonus hangus; pustaka murni +
      tes U74–U76); **penahan 5 & 6**; **Tutup lebih cepat** (GAJ-96); **buka kembali** (pembalikan
      langkah 3–13 dalam satu transaksi, syarat a/b/c, nomor sama versi+1); **Minta buka kembali** (antrean
      HR→Pemilik/GM); pemberitahuan karyawan (ditutup + "sedang dibetulkan"); **cetakan GAJ-L32** (baris
      tersimpan, cetak peramban, dicatat); mesin `pengingat_tutup_slip` (07.00, **33 mesin**). Hak baru
      `gaj.buka_kembali_slip` (Pemilik/GM) + `gaj.minta_buka_slip` (HR). Migrasi 0031 + benih **SUDAH
      dijalankan ke tempat uji** (dikonfirmasi 21 Okt).
  - **Bagian 3-f DIPECAH DUA SESI (keputusan pemilik 21 Okt 2026, ikut batas spec):** 3-f terlalu besar
    untuk satu sesi (11 layar + migrasi + 4 mesin + tes uang), pola sama dengan 3-e-1/3-e-2.
    - **Bagian 3-f-1 (4E-5b Bayar) SELESAI & DI-MERGE ke `main` (21 Okt, PR #30)** (dulu cabang `gaji-3f1-bayar`). Hijau
      (`npm run cek`, **573 tes**, 41 berkas; migrasi sah **32**) + `npm run build`. 6 layar (GAJ-L33–L38):
      langkah bayar (satu per slip, banyak slip sekaligus dari satu tempat uang), batal bayar (GAJ-L35 di
      GAJ-L29), slip Rp0 "tanpa uang" (GAJ-102, di `tutup-slip.ts`; buka kembali membalik), bayar di luar
      slip + potong Piutang Lain (GAJ-106), Jadwal Bayar, Daftar Transfer, fungsi server **Ringkasan Gaji**
      (3 sudut pandang penuh/HR/Finance). **Inti uang (WAJ-06):** pustaka murni `src/lib/gaji-bayar.ts`
      (jatuh bayar, kelompok jadwal, tanggal uang sah GAJ-99, bagi bayar luar Y5, imbang GAJ-105; 22 tes).
      Server: `bayar-slip.ts`, `bayar-luar-slip.ts`, `ringkasan-gaji.ts`. Migrasi 0032: `tempat_uang` (SEAM
      Keuangan KEU-02, tipis), `kelompok_bayar`, `pembayaran_slip`, `bayar_luar_slip` + ALTER langkah_slip/
      baris_bonus. 2 mesin (pengingat_belum_dibayar 07.00, pembuat_tagihan_luar_slip 05.40; **35 mesin**).
      4 hak `gaj.*` (bayar_slip lingkup []; lihat_jadwal_bayar/daftar_transfer→Finance; lihat_ringkasan_gaji
      →HR+Finance). **SEAM Buku Kas / cicilan Piutang Lain = Keuangan 4H** (baca `pembayaran_slip`/
      `bayar_luar_slip`; pola sama `sisa_potongan` 'menjadi_piutang'). Lengkap di CHANGELOG #269. Migrasi
      0032 + benih **SUDAH dijalankan ke tempat uji** (21 Okt; 35 mesin, 3 tempat uang contoh).
    - **Bagian 3-f-2 (4E-5c Sisi Karyawan) SELESAI & DI-MERGE ke `main` (21 Okt, PR #32)** (dulu cabang `gaji-3f2-sisi-karyawan`).
      Hijau (`npm run cek`, **590 tes**, 42 berkas; migrasi sah **33**) + `npm run build`. 5 layar (GAJ-L39–L43):
      Pendapatan Saya (satu halaman per periode, tiga angka kepala, tab Ringkasan/Upah/Bonus/Potongan/Hitungan),
      Slip Saya (+ ajukan keberatan 3 langkah + unduh/cetak PDF), Keberatan Slip (ajukan GAJ-L41 + putuskan
      GAJ-L42 dengan gerbang H51/H52/H53 + Tautkan pembetulan + Pembetulan gaji periode lalu GAJ-112),
      Total Diterima per Orang (GAJ-L43). **Inti uang (WAJ-06):** pustaka murni `src/lib/gaji-pendapatan.ts`
      (tiga angka kepala, prorata R1 pembetulan, total diterima, penempatan slip mingguan, jendela keberatan;
      U84–U89 + W43–W45, 12 tes) + 5 tes hak. Server: `urusan-gaji-saya.ts`, `slip-saya.ts`, `pendapatan-saya.ts`,
      `keberatan-slip.ts`, `total-diterima.ts`. Migrasi 0033: tabel `keberatan_slip` (pondasi perubahan_gaji
      'pembetulan' + koreksi R1 sudah ada sejak 0026/0027). 1 mesin baru `pengingat_pembetulan_keberatan`
      (07.00; **36 mesin**); `penghitung_koreksi_periode_lalu` kini hitung ulang R1 juga. Keputusan keberatan
      slip TIDAK lewat Persetujuan umum (`jalankanAksi` menolak jenis `keberatan_slip`; `/persetujuan/[id]`
      mengarahkan ke `/gaji/keberatan-slip/[id]`). Lengkap di CHANGELOG #270. **SEAM:** login akses-terbatas
      mantan karyawan (C4) menunggu inti Karyawan KAR-07 (fungsi `masihPunyaUrusanUang` + gerbang sudah siap);
      bongkaran & slip mingguan = 4G (struktur siap, data kosong). Migrasi 0033 + benih **SUDAH dijalankan ke
      tempat uji** (dikonfirmasi 21 Okt: 33 migrasi semua jalan, 36 mesin).
    - **Modul Gaji Bulanan (4E) SELESAI.**

## Langkah 5 — modul Gaji Driver/Bongkaran/Kasbon (4G): pembagian (DISETUJUI pemilik 22 Okt 2026)

Spec: `docs/work/specs/2026-10-14-gaji-driver-spec.md` (3.642 baris, 39 layar DRV-L01–L39).
Buku aturan: `docs/aturan/05-gaji-driver-kasbon.md`. Spec terbagi **6 sub-bagian semua "disetujui penuh"**
(4G-1 s.d. 4G-4b). **Ukuran: BESAR.** Pola sama 4E/4F: **satu sub-bagian = satu sesi**, urut dari pondasi.
Bergantung pada modul 1, 3, 4 (semua selesai). Migrasi 4G mulai **0042**.

| Bagian | Sub-spec | Isi | Layar | Status |
|---|---|---|---|---|
| 5-a | 4G-1 | Tarif & Ritase + **pondasi DB modul** — **uang WAJ-06** | 5 (L01–L05) | **SELESAI & di `main` (PR #45)** |
| 5-b | 4G-2 | Slip Mingguan & Denda Driver/Kenek | 5 (L06–L10) | **SELESAI & di `main` (PR #47); CHANGELOG #280** |
| 5-c | 4G-3a | Laporan Bongkaran (dibuat→Berlaku) — **uang** | 6 (L11–L16) | **SELESAI; CHANGELOG #281** |
| 5-d-1 | 4G-3b | Bayar & Batal Bayar + pondasi DB — **uang** | 2 (L17, L20) | **SELESAI & di `main` (PR #52); CHANGELOG #282** |
| 5-d-2a | 4G-3b | Koreksi/Batalkan laporan + "selisih bongkaran" + susulan + bayar susulan — **uang** | 2 (L18, L19) | **SELESAI & di `main` (PR #54); CHANGELOG #283** |
| 5-d-2b-1 | 4G-3b | Lebih Bayar (L21: Tagih/Hapus/Terima) + mesin penanda 30 hari + Tanyakan dulu — **uang** | 1 (L21) | **SELESAI & di `main` (PR #56); CHANGELOG #284** |
| 5-d-2b-2 | 4G-3b | Per Orang (L22) + Excel, seam Pendapatan Saya + Total Diterima, DRV-L11 susulan + Jadwal Bayar, centang berat | 1 (L22) | **SELESAI & di `main` (PR #58); CHANGELOG #285 — 4G-3b TUNTAS** |
| 5-e | 4G-4a | Kasbon: diajukan→uang diberikan — **uang** | 9 (L23–L31) | **DIPECAH 2 sesi (disetujui pemilik 25 Okt)** |
| 5-e-1 | 4G-4a | Inti uang (periksa kasbon 3 syarat + terpakai + bagi cicilan) + pengajuan→disetujui + pondasi DB — **uang** | 6 (L23–L28) | **SELESAI & DI-MERGE ke `main` (PR #60); CHANGELOG #286** |
| 5-e-2 | 4G-4a | Serah uang (seam Buku Kas 4H + pasang jadwal 4G-4b) + Batalkan + Batal serah + Minta dibatalkan + Uang belum diterima + tanda 2 hari | 3 (L29–L31) | **SELESAI; CHANGELOG #287 — 4G-4a TUNTAS** |
| 5-f | 4G-4b | Kasbon: cicilan→lunas — **uang** | 8 (L32–L39) | **DIPECAH 3 sesi (disetujui pemilik 25 Okt)** |
| 5-f-1 | 4G-4b | Inti uang cicilan di slip (sisa, cicilan jatuh tempo, tandai/balik — seam tutup/buka slip) + pondasi DB + DRV-L38 — **uang** | 1 (L38) | **SELESAI & DI-MERGE ke `main` (PR #64); CHANGELOG #288** |
| 5-f-2 | 4G-4b | Pelunasan tunai + hapus utang + batal + tunda cicilan — **uang** | 5 (L32–L35, L39) | **SELESAI & di `main` (PR #66); CHANGELOG #289** |
| 5-f-3 | 4G-4b | **DITATA ULANG jadi 2 sesi (pemilik 26 Okt 2026)** → 5-f-3a + 5-f-3b di bawah | 2 (L36, L37) | — |
| 5-f-3a | 4G-4b | Ubah jadwal (DRV-L36) + Pindah slip utama (mesin) — **uang** | 1 (L36) | **SELESAI & di `main` (PR #68); CHANGELOG #290** |
| 5-f-3b | 4G-4b | Orang berhenti→Piutang Lain + Kasbon Khusus (DRV-L37) + bawaan + mesin Pemeriksa kasbon — **uang** | 1 (L37) | **SELESAI & di `main` (PR #70); CHANGELOG #291 — 4G-4b & MODUL KASBON TUNTAS** |

### Bagian 5-a (4G-1 Tarif & Ritase) — SELESAI & DI-MERGE ke `main` (PR #45)

Hijau `npm run cek` (**821 tes**, 59 berkas; migrasi sah **42**) + `npm run build`. Lengkap di CHANGELOG #279.
Lingkup: Kejadian 1–29, tes U1–U18, W1/W3/W4/W5, H1–H5; aturan DRV-86 s.d. 92 (beku, tidak diubah).
- **INTI UANG (WAJ-06):** `src/lib/gaji-driver-tarif.ts` (tarif berlaku pada tanggal, jarak pengumuman 1/7/0 hari,
  tidak mundur, validasi bulat + kenek Rp0, angka per peran) + `src/lib/gaji-driver-ritase.ts` (nilai ritase: slip
  mingguan per-ritase vs slip bulanan menurut status hari; penilaian ulang ganti/koreksi plus/potongan koreksi).
  SATU fungsi server `src/server/gaji/nilai-ritase.ts` (tarifPasanganPada, keadaanOrangPada, nilaiRitaseBaris,
  nilaiUlangRitase). **+18 tes uang/waktu + 5 tes hak.**
- Migrasi `0042`: `jenis_upah`, `tarif_ritase`, `tinjau_upah`, `penilaian_ulang` + ALTER `buku_upah` (tarif_asal,
  keterangan, status_hari_dibaca, status belum_bertarif, kunci asal ritase). 2 pintu (`gaji-driver-tarif`,
  `gaji-driver-upah`) + 5 layar (DRV-L01–L05) di `/pengaturan/gaji-driver`(+`/tarif`) & `/gaji/upah-ritase`.
  **+6 hak `drv.*`** (buat/betulkan tarif = batas keras Pemilik/GM). 1 mesin `penilai_ritase` (10 menit; **47 total**).
- **Seam Logistik disambung:** ritase tangan ditolak tanpa tarif (DRV-92) + nilai inline; trip Selesai menilai inline;
  batal ritase → penilai ulang. Migrasi 0042 + benih **SUDAH dijalankan ke tempat uji** (22 Okt: 6 jenis upah, 3 tarif).

**Seam & susulan 5-a (kerjakan saat bagian/modul terkait):**
- **Slip mingguan + penahan "Belum bertarif" (penahan 7) + potongan "koreksi upah ritase" kelompok (a) = 4G-2/4E.**
  Baris Buku Upah ditulis dengan periode minggu upah; penempatan ke slip + potongan koreksi dibaca fungsi hitung slip.
- **Penilai ulang dari perubahan status hari Kehadiran & "sekali sebelum tutup slip" = 4G-2** (fungsi `nilaiUlangRitase`
  siap; hook ke Kehadiran + langkah tutup disambung di sana).
- **Papan Perubahan Aturan** (pengumuman tarif) = modul Pengumuman (niat disimpan di `tarif_ritase`; pola TITIPAN 1-i).
- **Siap Kirim hard-block semua pasangan kurang tarif** tetap seperti 4-b (menandai); pagar terakhir "Belum bertarif"
  (DRV-92) menjaring yang lolos. **23 tarif sistem lama** = Tahap 5 (benih contoh 3 tarif demo).

### Bagian 5-b (4G-2 Slip Mingguan & Denda) — SELESAI & DI-MERGE ke `main` (PR #47)

Hijau `npm run cek` (**842 tes**, migrasi sah **43**) + `npm run build`. Lengkap di CHANGELOG #280. DRV-93 s.d. 100 (beku).
- **Slip mingguan = slip biasa 4E-5** periode minggu upah (WAJ-04): income ritase/upah belanja/koreksi plus dari Buku Upah
  dibaca `src/server/gaji/upah-mingguan.ts` (dipakai `hitung-slip` & `hitung-potongan`). Kelompok (a) += denda driver +
  potongan koreksi ritase. `hitungSlip` punya `tanpaPotongan` untuk slip di luar slip utama (DRV-05). Penahan 7 "Belum
  bertarif" umum. Pembuat slip & tutup slip diperluas (DRV-94/97); tutup → Dana Disiplin denda (DRV-30).
- **INTI UANG (WAJ-06):** `src/lib/gaji-driver-denda.ts` (nominal bertanggal, jarak naik 7/turun 1, jendela ajukan 7 hari,
  keberatan 3 hari) +16 tes; +5 tes hak (H6–H10). Denda: inti `denda-driver.ts` + pintu `gaji-driver-denda.ts`; usulan
  Kepala Gudang lewat `drv_usulan_denda` (Persetujuan umum = DRV-L08) / Pemilik-GM langsung; keberatan lewat GAJ-L18.
- Migrasi `0043`: `jenis_denda_driver`, `pengaturan_jenis_denda_driver`, `denda_driver`; ALTER `slip.slip_utama`;
  `keberatan_potongan.sasaran_jenis` += `denda_driver`. +5 hak `drv.*`. 5 layar: `/gaji/denda-driver` (L06+L07),
  `/pengaturan/gaji-driver/denda` (L09), kartu Beranda (L10), L08 = Persetujuan. Migrasi 0043 + benih SUDAH dijalankan.

**Seam & susulan 5-b (tidak menghalangi):**
- **Kasbon kelompok (d)** = 4G-4 (5-e/5-f); cicilan jatuh tempo dibaca fungsi hitung slip saat ada.
- **Pengembalian uang denda ditiadakan sesudah slip ditutup** (koreksi plus + Dana Disiplin keluar) = seam Keuangan 4H,
  pola SAMA Potongan Lain (GAJ-81); kini hanya menandai status `ditiadakan`.
- **Foto denda** = komponen susulan (`denda_driver.foto` kolom siap; UI unggah menyusul). **Pengumuman Papan nominal
  denda** = modul Pengumuman (pola TITIPAN; `pengaturan_jenis_denda_driver.pengumuman` NULL). **Jam tutup Jumat 10.00 /
  pengingat 15.00** = pengaturan; pengingat tutup/bayar slip GAJ yang ada menjaringnya (tak ada mesin baru).

### Bagian 5-c (4G-3a Laporan Bongkaran) — SELESAI (lokal), siap push/merge

Hijau `npm run cek` (**869 tes**, migrasi sah **44**) + `npm run build`. Lengkap di CHANGELOG #281. DRV-101 s.d. 110 (beku).
- **INTI UANG (WAJ-06):** `src/lib/gaji-driver-bongkaran.ts` (kg baris/total 3 desimal, total upah bulat, bagi rata + sisa
  Rp1 abjad DRV-43, pagar berat >0/3 desimal/>100 kg/beda >10%, tanggal kerja biasa/terlambat/tolak, nomor LB) +22 tes;
  +5 tes hak (H11–H15). **SATU fungsi server** `src/server/gaji/hitung-bongkaran.ts` (`hitungBongkaran` + `tarifBongkaranPada`
  TANPA cadangan di kode, B3 + `beratSatuanSekarang`). Tulis SATU transaksi `src/server/gaji/laporan-bongkaran.ts`
  (`tulisLaporanBongkaran` + `setujuiLaporanTerlambat`/`tolakLaporanTerlambat`): laporan+barang+berat+peserta+Buku Upah.
- Tarif bongkaran = pengaturan `drv_tarif_bongkaran` (Rp20 bertanggal, dibaca menurut tanggal kerja). Baris Buku Upah jenis
  `bongkaran` per peserta, periode bulanan, tidak pernah masuk slip (DRV-48). Peserta izin/sakit/cuti → "Perlu dilihat" HR.
- Migrasi `0044`: `kasir_produk` (SEAM 4C tipis), `berat_satuan`, `laporan_bongkaran`, `barang_bongkaran`,
  `peserta_bongkaran` + unik parsial `buku_upah` bongkaran. +10 hak `drv.*` + jenis pengajuan
  `drv_laporan_bongkaran_terlambat` (Persetujuan umum = DRV-L16). **Tidak ada mesin baru (47).** 6 layar: `/gaji/bongkaran`
  (L11 + tab Barang lain L15), `/gaji/bongkaran/baru` (L12 5 langkah), `/gaji/bongkaran/[id]` (L13 + Setujui/Tolak L16),
  `/gaji/bongkaran/berat` (L14). Kartu Beranda.
- **Migrasi 0044 + benih BELUM dijalankan ke tempat uji** (jalankan sesudah merge; benih idempoten: 3 produk + berat,
  tarif Rp20, jenis pengajuan, hak bongkaran Kepala Gudang/Finance/HR).

**Seam & susulan 5-c (tidak menghalangi):**
- **Bayar/koreksi/batalkan laporan (Berlaku→Dibayar) = 4G-3b (5-d).**
- **`kasir_produk`/`kasir_po` (purchase order DRV-39/106)** diisi & dinyalakan Tarik Data Kasir **4C** (kolom
  `purchase_order`/`jumlah_po`/`selisih_po` disiapkan; UI PO menyusul saat sambungan menyala).
- **Cabang penanggung** = Gudang (pengaturan DRV-51 picker = susulan kecil). **Konfirmasi >100 kg & simpan luring (TAM-16)**
  = susulan UI. **Foto** = data URL (penyimpanan berkas tersendiri menyusul). **Pengumuman Papan tarif** (naik 1/turun 7)
  = kerangka Papan saat disambung.

### Bagian 5-d (4G-3b Bayar Bongkaran) — DIPECAH DUA SESI (persetujuan pemilik 25 Okt 2026)

5-d besar (6 layar + 7 tabel + inti uang berlapis). Pola sama 3-e/3-f: satu sesi inti uang yang paling aman diselesaikan utuh.

- **Bagian 5-d-1 (pondasi + langkah Bayar & Batal Bayar) SELESAI & DI-MERGE ke `main` (PR #52).** Hijau `npm run cek`
  (**889 tes**, migrasi sah **45**) + `npm run build`. Lengkap di CHANGELOG #282. DRV-47 s.d. 53, 111 s.d. 120 (beku).
  - **INTI UANG (WAJ-06):** `src/lib/gaji-driver-bayar-bongkaran.ts` (`tanggalUangBongkaranSah` B1/DRV-112; `sisaLebihBayar`
    DRV-118; `alokasiLebihBayar` B5 terlama dulu sampai habis/bagian Rp0; `uangKeluar`) +18 tes; +2 tes hak (H16/H17).
  - **SATU pintu tulis** `src/server/gaji/bayar-bongkaran.ts`: `bayarSatuLaporan` (satu transaksi per laporan, DRV-111;
    diterima = bagian − lebih bayar yang diperhitungkan; pembayar bukan peserta/pembuat B3; uang keluar Rp0 → "tanpa uang"),
    `batalBayarBongkaran` (membalik perhitungan lebih bayar; tolak bila laporan sudah melahirkan lebih bayar). Pintu
    `src/server/pintu/gaji-driver-bayar-bongkaran.ts` (bayar banyak sekaligus dari satu tempat uang lewat `kelompok_bayar`).
  - Migrasi `0045`: `pembayaran_bongkaran` (unik 1 Berlaku per laporan + per susulan), `rincian_bayar_bongkaran`,
    `lebih_bayar_bongkaran`, `mutasi_lebih_bayar` (dibuat SEKARANG supaya bayar bisa memperhitungkan; baris lahir di 5-d-2),
    ALTER `laporan_bongkaran` (versi_sekarang, jumlah_koreksi, dibatalkan_*). **+2 hak** (`drv.bayar_bongkaran` Finance+P/GM;
    `drv.batal_bayar_bongkaran` P/GM batas keras). **1 mesin** `pengingat_bongkaran_belum_dibayar` (07.00; **48 total**) +
    jenis tanda `drv_bongkaran_belum_dibayar`. 2 layar: `/gaji/bongkaran/bayar` (DRV-L17), `/gaji/bongkaran/batal-bayar/[id]`
    (DRV-L20); centang "Bayar terpilih" di DRV-L11 + tombol di DRV-L13. Migrasi 0045 + benih **SUDAH dijalankan ke tempat uji**
    (25 Okt: 1 migrasi; 1 hak `drv.bayar_bongkaran` Finance, 1 mesin 48 total, jenis tanda `drv_bongkaran_belum_dibayar`).
  - **SEAM Keuangan 4H:** baris Buku Kas uang keluar diturunkan dari `pembayaran_bongkaran` Berlaku (kolom `baris_kas`
    disiapkan); mesin "Pemeriksa pembayaran bongkaran" (cek pembayaran tanpa baris Buku Kas) = 4H, BELUM didaftar/dibenihi.

- **Bagian 5-d-2 BESAR (lebih berat dari 5-d-1) → DIPECAH DUA SESI (persetujuan pemilik 25 Okt 2026, pola 3-e/3-f).**

  - **Bagian 5-d-2a (Koreksi/Batalkan + "selisih bongkaran" + susulan + bayar susulan) SELESAI & DI-MERGE ke `main` (PR #54).**
    Hijau `npm run cek` (**903 tes**, migrasi sah **46**) + `npm run build`. CHANGELOG #283. DRV-49, 115 s.d. 118 (beku).
    - **INTI UANG (WAJ-06):** `src/lib/gaji-driver-selisih-bongkaran.ts` (`selisihBongkaran`/`selisihSatuOrang` DRV-116:
      plus → kurangi sisa lebih bayar laporan sama dulu lalu susulan; minus → kurangi susulan Menunggu laporan sama dulu
      lalu lebih bayar; batal = semua bagian baru Rp0; `totalSusulan`, `totalLebihBayarBaru`) **+14 tes; +2 tes hak (H18/H19)**.
    - **SATU tempat tulis** `src/server/gaji/koreksi-bongkaran.ts`: `koreksiLaporanBongkaran` (versi lama →
      `versi_laporan_bongkaran`, hitung ulang tarif tanggal kerja, Buku Upah lama Dibatalkan diganti baru; bila sudah dibayar
      `terapkanSelisih` → susulan/lebih bayar), `batalkanLaporanBongkaran`, `hitungSelisihPratinjau` (read-only DRV-L18
      langkah 2). **Bayar susulan** `bayarSatuSusulan` di `bayar-bongkaran.ts` (DRV-117, langkah bayar sama, B5); pintu
      `bayarBongkaran`/`pratinjauBayar` diperluas terima `susulanIds`; DRV-L17 pakai `?susulan=`.
    - Migrasi `0046`: `versi_laporan_bongkaran`, `susulan_bongkaran` + `rincian_susulan_bongkaran`, `tanya_bongkaran`
      (SEAM 5-d-2b, pola 0045), FK `pembayaran_bongkaran.susulan`. **+2 hak** (`drv.koreksi_laporan_bongkaran` Kepala
      Gudang/P/GM sebelum dibayar; `drv.koreksi_bongkaran_dibayar` P/GM batas keras). **Tanpa mesin baru (48).** 2 layar:
      `/gaji/bongkaran/[id]/koreksi` (DRV-L18, pakai ulang form DRV-L12 + pratinjau akibat per orang), `/gaji/bongkaran/[id]/batalkan`
      (DRV-L19). Tombol Koreksi/Batalkan + daftar Susulan menunggu (tombol "Bayar susulan") di DRV-L13.
    - Migrasi 0046 + benih **SUDAH dijalankan ke tempat uji** (25 Okt: "1 migrasi dijalankan"; benih "1 baris hak
      `drv.koreksi_laporan_bongkaran` Kepala Gudang", 48 mesin).

  - **Bagian 5-d-2b BESAR → DIPECAH DUA SESI (persetujuan pemilik 25 Okt 2026, pola 5-d-1/5-d-2a):** sesi 1 inti uang
    Lebih Bayar + Tanyakan dulu; sesi 2 sisa layar baca/tampil.

    - **Bagian 5-d-2b-1 (Lebih Bayar DRV-L21 + mesin penanda 30 hari + Tanyakan dulu) SELESAI & DI-MERGE ke `main` (PR #56).**
      Hijau `npm run cek` (**915 tes**, migrasi sah **46** — **tanpa migrasi baru**; tabel sudah ada sejak 0045/0046) +
      `npm run build`. Lengkap di CHANGELOG #284. DRV-114, 118, DRV-85 (beku).
      - **INTI UANG (WAJ-06):** `src/lib/gaji-driver-lebih-bayar.ts` (`umurHari`, `lewatAmbang`, `validasiTerimaPengembalian`
        nominal ≤ sisa, `validasiAlasanLebihBayar`) **+12 tes**. Sisa tetap dihitung, tidak disimpan (DRV-118).
      - **SATU tempat tulis** `src/server/gaji/lebih-bayar-bongkaran.ts`: `tagihTunaiLebihBayar` (status 'ditagih_tunai';
        perhitungan otomatis tetap jalan), `hapusLebihBayar` (mutasi 'dihapus'; tak ada uang/ Buku Kas baru),
        `terimaPengembalianLebihBayar` (uang MASUK, mutasi 'dikembalikan_tunai' ≤ sisa; habis → 'lunas'). **SEAM 4H:** baris
        Buku Kas uang masuk diturunkan Keuangan dari mutasi 'dikembalikan_tunai' (`baris_kas` NULL).
      - **Pintu** `src/server/pintu/gaji-driver-lebih-bayar.ts` (`daftarLebihBayar` DRV-L21 + saring status/lewat/orang;
        `tempatUangPengembalian`; `tagihTunai`/`hapus`/`terimaPengembalian`). **"Tanyakan dulu"** di `gaji-driver-bongkaran.ts`
        (`tanyakanBongkaran`/`jawabTanyaBongkaran`; tanda "Ditanyakan Finance", BUKAN penahan; padam saat koreksi/batal).
      - **+5 hak `drv.*`** (`lihat_lebih_bayar` Finance/Kepala Gudang baca/P/GM; `tagih_atau_hapus_lebih_bayar` P/GM batas
        keras; `terima_pengembalian_bongkaran` Finance/P/GM; `tanya_bongkaran` Finance/P/GM; `jawab_tanya_bongkaran` pembuat/
        Kepala Gudang). **1 mesin** `penanda_lebih_bayar_lewat` (07.00; **49 total**) + jenis tanda `drv_lebih_bayar_lewat` +
        pengaturan `drv_hari_lebih_bayar_lewat` (DRV-85, isi awal 30). **1 layar** `/gaji/bongkaran/lebih-bayar` (DRV-L21) +
        tab di DRV-L11 + Tanyakan dulu/Jawab di DRV-L13.
      - **Benih SUDAH dijalankan ke tempat uji** (25 Okt: tanpa migrasi baru; benih idempoten melapor "Mesin otomatis: 0 baru,
        49 sudah ada (49 total)" — mesin `penanda_lebih_bayar_lewat` + 3 hak Finance + 2 hak Kepala Gudang + jenis tanda `drv_lebih_bayar_lewat` ada).

    - **Bagian 5-d-2b-2 (sisa 4G-3b) SELESAI** (CHANGELOG #285). Hijau `npm run cek` (**924 tes**, migrasi sah **47**) +
      `npm run build`. DRV-53, 113, DRV-L22 (beku). **Migrasi 0047** (satu-satunya DB baru): ALTER `rincian_bayar_bongkaran`
      ADD `pengajuan` (laporan "Uang belum saya terima" TIDAK punya tabel sendiri — menunjuk baris rincian; spec 5.3).
      **Tanpa mesin baru (49).**
      - **INTI UANG (WAJ-06):** `src/lib/gaji-driver-per-orang.ts` (`agregatOrang` + INVARIAN U63; `masihBisaLapor` 3 hari) +8 tes; +H26.
      - **DRV-L22** `/gaji/bongkaran/per-orang` (pintu `gaji-driver-per-orang.ts`: `bongkaranPerOrang` + `laporanOrang` drill-down;
        rentang bawaan 26–25; saring karyawan/lepas + cabang + Cari; **Unduh Excel** = CSV klien bertanggal + nama pembuat).
        Hak dipakai ulang `drv.lihat_laporan_bongkaran` (bukan HR). Tombol "Per orang" di DRV-L11.
      - **Seam Pendapatan Saya (DRV-53/113):** kartu bongkaran per laporan + sisa lebih bayar + tombol "Uang belum saya terima"
        (3 hari) → pengajuan `drv_upah_belum_diterima` (P/GM; atas nama pekerja lepas; efek keputusan di `efek-pengajuan.ts`;
        **+1 hak** lantai dasar 'diri' `drv.lapor_upah_belum_diterima`).
      - **Total Diterima (GAJ-114):** kolom `bongkaran` diisi dari `rincian_bayar_bongkaran` (baca, tidak hitung ulang).
      - **DRV-L11:** label Dikoreksi/Susulan/Belum diterima; susulan Menunggu ikut di tab belum-dibayar (`?susulan=`);
        **Jadwal Bayar (GAJ-L33)** jalur bongkaran → DRV-L17. **Centang berat** (DRV-L18) → Ubah berat DRV-105.
      - **Migrasi 0047 + benih SUDAH dijalankan ke tempat uji** (25 Okt: "1 migrasi dijalankan"; benih idempoten "1 jenis" =
        `drv_upah_belum_diterima`; 49 mesin tetap).
    - **Modul 4G-3b (Bayar Bongkaran) SELESAI SELURUHNYA.** Kasbon 4G-4a (5-e-1 + 5-e-2) juga SELESAI (CHANGELOG #286, #287).
      Berikutnya: **bagian 5-f (4G-4b Kasbon: cicilan→lunas, 8 layar DRV-L32–L39, uang).**

## Langkah 4 — modul Logistik (4F): pembagian (DISETUJUI pemilik 21 Okt 2026)

Spec: `docs/work/specs/2026-10-13-logistik-spec.md` (4.167 baris, 77 layar LOG-L01–L77, 89 aturan LOG).
Buku aturan: `docs/aturan/04-logistik.md`. Spec sudah dibagi jadi **8 sub-bagian yang semua "disetujui
penuh"** (4F-1 s.d. 4F-5c). **Ukuran: BESAR.** Pola sama Gaji/Kehadiran: **satu sub-bagian = satu sesi**,
urut dari pondasi; dua bagian 13-layar (4-b, 4-c) **tidak dipecah di muka** — baru dipecah kalau tak muat.

| Bagian | Sub-spec | Isi | Layar | Status |
|---|---|---|---|---|
| 4-a | 4F-1 | Toko, Mobil & Rute, Surat Jalan & Nota + **pondasi DB Logistik** | 11 (L01–L11) | **SELESAI & di `main` (PR #34)** |
| 4-b | 4F-2 | Rencana & Trip Truk (driver/kenek, ritase) | 13 (L12–L24) | **SELESAI & di `main` (PR #36)** |
| 4-c | 4F-3 | Laporan Muat Cabang, Paket, Antar Sendiri | 13 (L25–L37) | **SELESAI & di `main` (PR #38)** |
| 4-d | 4F-4a | Kirim & Uang (cara bayar, bagi ke nota, potong nota) — **uang WAJ-06** | 9 (L38–L46) | **SELESAI & di `main`** |
| 4-e | 4F-4b | Tidak Terkirim & Retur | 11 (L47–L57) | **SELESAI & di `main`** |
| 4-f | 4F-5a | Pemeriksaan Uang (tunai, transfer, deposit, Kas Masuk) — **uang WAJ-06** | 6 (L58–L63) | **SELESAI & di `main`** |
| 4-g | 4F-5b | Kiriman ke Kasir & Daftar Tagih | 7 (L64–L70) | **SELESAI & di `main`** |
| 4-h | 4F-5c | Dashboard, Laporan, Bensin | 7 (L71–L77) | **SELESAI (PR berikut); TERAKHIR** |

Logistik menumpang pondasi Langkah 1–3 (Mesin Pengajuan, hak akses, komponen baku, mesin terjadwal,
jam server, tempat uji, pemasang titik lokasi KAR-25). **Saat mulai 4-a:** cabang baru dari `main`
(migrasi Logistik mulai **0034**).

### Bagian 4-a (4F-1) — SELESAI & DI-MERGE ke `main` (PR #34)

Hijau `npm run cek` (**606 tes**, 43 berkas; migrasi sah **34**) + `npm run build`. Lengkap di CHANGELOG #271.
- **Penyelarasan sesudah beku (disetujui pemilik 21 Okt):** kolom **`cabang.jenis`** (gudang/toko/kantor)
  ditambah (LOG-13; tabel cabang modul Karyawan belum punya). Additif; benih isi cabang contoh (idempoten).
- Migrasi `0034`: ALTER cabang + 9 tabel (mobil, rute, toko, gabung_toko, pindah_gabung, titik_toko,
  surat_jalan, perubahan_surat_jalan, nota). Pustaka murni `src/lib/logistik-toko.ts` (+16 tes U1/U2/U4,
  W4/W5, nama pembanding, titik, jarak). 4 pintu (`logistik-toko/-titik/-mobil-rute/-surat-jalan`).
  12 tindakan `log.*` (benih: Kepala Gudang kelola, Finance lihat). 11 layar di `/logistik/*` +
  `/pengaturan/logistik`. Benih contoh: 2 mobil + 3 rute + jenis cabang.

**Seam & susulan 4-a (tidak menghalangi; kerjakan saat bagian/modul terkait):**
- **3 mesin 4F-1 (Pembuat surat jalan dari kasir, Penyalin toko dari kasir, Pemeriksa surat jalan
  manual) = Tarik Data Kasir 4C.** Semua dipicu/digerbang tarikan kasir + antrean "Perlu Diperiksa"
  yang belum ada; TIDAK didaftar/dibenihi di 4-a. Jalur "sebelum sambungan menyala" (catat manual)
  dibangun penuh. Kolom `surat_jalan.sumber='kasir'` / `cocok_kasir` / `transaksi_kasir` & toko
  `sumber='kasir'`/`nonaktif_di_kasir` disiapkan, diisi saat 4C menyala.
- **Nota cabang** (jenis 'cabang', asal laporan_muat) = 4F-3 (tabel `nota` sudah menampungnya).
- **Titik dari lapangan** (driver/kenek trip = 4F-2; pengantar antar sendiri = 4F-3): pintu
  `pasangTitikUsulan`/`laporkanTitikSalah` + hak bawaan 'diri' (`log.pasang_titik_usulan`,
  `log.laporkan_titik_salah`) **sudah ada**, disambung ke layar trip/antar saat 4F-2/4F-3.
- **Jabatan Marketing & Driver** belum ada di benih contoh → hak `log.*` mereka didaftar di hak.ts,
  dibenihi saat jabatan dibuat (KAR). Nonaktif mobil/rute "dipakai rencana berjalan" ditegakkan 4F-2.
- **Komponen peta/GPS/kamera HP** = susulan (titik: lintang/bujur/akurasi/foto kini data, pola sama
  Kehadiran). **Tarif pasangan mobil×rute** = 4G (LOG-L07 menandai "belum ada tarif").
- Migrasi **0034 + benih** perlu dijalankan ke tempat uji (`npm run migrasi` lalu
  `BENIH_TEMPAT_UJI=ya npm run benih`; idempoten).

### Bagian 4-b (4F-2 Rencana & Trip Truk) — SELESAI & DI-MERGE ke `main` (PR #36)

Hijau `npm run cek` (**629 tes**, 43 berkas; migrasi sah **35**) + `npm run build`. Lengkap di CHANGELOG #272.
Migrasi 0035 + benih **SUDAH dijalankan ke tempat uji** (21 Okt: "1 migrasi dijalankan"; benih "2 supplier,
2 izin lapangan"; 5 baris hak baru).
- **Daur hidup trip lewat SATU pintu server (LOG-21):** draft → siap_kirim → berjalan → menuju_garasi →
  selesai; atau dibatalkan (dari draft/siap_kirim). Kejadian mengalir ke modul lain: Berangkat → absen
  masuk (KEH-97), lapor garasi/tutup kantor → absen pulang (KEH-98/100/101), trip Selesai → ritase & upah
  belanja sekali (LOG-33–35, nominal 4G).
- Migrasi `0035`: `supplier` (SEAM Keuangan KEU-57) + `trip`, `awak_trip`, `kunjungan`,
  `kunjungan_surat_jalan`, `tugas_belanja`, `ritase` (unik server cegah dobel), `pagar_dimatikan`.
- Pustaka murni `src/lib/logistik-trip.ts` (+23 tes): transisi status, syarat Siap Kirim/Menuju Garasi,
  ritase berhak/berkenek, di luar titik 100 m, jendela ritase tangan 14 hari & pagar 24 jam.
- 5 pintu: `logistik-trip-seam.ts` (absen + ritase, WAJ-04), `logistik-rencana.ts` (kantor),
  `logistik-trip-saya.ts` (driver/kenek), `logistik-ritase.ts`, `logistik-pagar.ts`.
- +7 hak `log.*` (4 ke Kepala Gudang, lihat_trip ke Finance; 3 akses-penuh: ritase_tangan, batal_ritase,
  kelola_pagar_uji). 5 route/13 layar: `/logistik/rencana-trip`(+buat+[id]), `/saya/trip`,
  `/pengaturan/pagar-trip`.

### Bagian 4-c (4F-3 Laporan Muat, Paket, Antar Sendiri) — SELESAI & DI-MERGE ke `main` (PR #38)

Hijau `npm run cek` (**670 tes**, 48 berkas; migrasi sah **36**) + `npm run build`. Lengkap di CHANGELOG #273.
- Migrasi `0036`: 9 tabel (laporan_muat, foto_laporan_muat, ambil_paket, perubahan_laporan_muat,
  perjalanan_antar, tujuan_perjalanan, kiriman_perjalanan, pengalihan_pj, asal_bonus_ongkir).
- Pustaka murni `src/lib/logistik-laporan-muat.ts` + `logistik-antar.ts` (+ tes; **batas tanda ⚠ ongkir
  23.59 hari berikutnya = uang WAJ-06**). 3 pintu (`logistik-laporan-muat`/`-jemput-paket`/`-antar`) +
  seam trip batal di `logistik-rencana.ts`. +9 hak `log.*`. 2 mesin (penanda_laporan_muat 15 menit,
  penanda_perjalanan_belum_kembali 23.59; **38 mesin**). 6 route/13 layar (`/logistik/laporan-muat`(+buat+[id]),
  `/saya/jemput-paket/[trip]`, `/saya/antar`(+[id])).

**Seam & susulan 4-c (tidak menghalangi; kerjakan saat bagian/modul terkait):**
- **Isi Kirim/Kirim Besok/Gagal tiap tujuan + UANG per nota (K5/LOG-117) = 4F-4** (4-d/4-e): Foto 2
  mencatat sampai+lokasi; `tujuan_perjalanan.hasil` NULL sampai 4F-4. Foto 3 wajar butuh semua tujuan
  berhasil; jalan keluar sebelum 4F-4 = **Tutup perjalanan** (kantor) → sisa Kirim Besok.
- **BONUS ONGKIR = 4C/Gaji:** pintu tulis Buku Bonus sudah ada (3-d); baris ongkir lahir dari tarikan
  kasir (4C). Mesin **Penulis bonus ongkir**, **Pemasang tanda ⚠**, **Pencocok nota cabang** TIDAK
  didaftar/dibenihi (pola seam kasir 4-a). `asal_bonus_ongkir` disiapkan; ambang ⚠ 23.59 teruji; Foto 3
  mengisi `warning_dicabut` (nominal baris bonus menyusul 4C).
- **Nota cabang DIPILIH dari kasir & Perlu Diperiksa nota cabang = 4C:** jalur DIKETIK penuh; hak
  `log.putuskan_nota_cabang` didaftar (layar Perlu Diperiksa menyusul 4C).
- **Tambah cepat toko dari laporan muat (F2) & Dashboard ringkasan/penanda = 4F-5** (4-h).
- **Peta/GPS/kamera HP = komponen susulan** (lokasi/foto kini data).
- Migrasi **0036 + benih SUDAH dijalankan ke tempat uji** (22 Okt: "1 migrasi dijalankan"; benih
  "2 mesin baru, 38 total"; 9 baris hak) — benih menambah 2 mesin + hak `log.*` 4F-3 ke
  Kepala Toko/Kepala Gudang/Finance (idempoten).

### Bagian 4-d (4F-4a Kirim & Uang) — SELESAI & DI-MERGE ke `main`

Hijau `npm run cek` (**696 tes**, 49 berkas; migrasi sah **37**) + `npm run build`. Lengkap di CHANGELOG #274.
- **INTI UANG (WAJ-06):** pustaka murni `src/lib/logistik-kirim.ts` — `bagiUangKunjungan` (LOG-112: urutan
  tagihan terbesar→Gudang→nomor kecil; cash dulu per nota; lebih bayar = titipan; kurang wajib janji di luar
  potongan menunggu K1), `tagihanPerNota`, `potonganMelebihiNota`, `validasiCaraBayar`, tanggal tempo/janji
  (besok..60 hari), jendela ubah, batas 3 hari. **+26 tes (U18–U34, W18–W22).**
- Migrasi `0037`: 7 tabel (hasil_kirim, pembayaran, bagian_nota, potong_nota, barang_kejadian, barang_kembali,
  koreksi_kasir). 3 pintu (`logistik-kirim` Simpan Kirim SATU transaksi LOG-47 + ubah pembayaran LOG-48 +
  `jalankanBagiUang` bersama; `logistik-potong-nota` putuskan L43 jalankan ulang bagi uang; `logistik-barang-
  kembali` serahkan/terima/alihkan/koreksi kasir). +9 hak `log.*` (putuskan_potong_nota batas keras [] → Finance
  via benih). 1 mesin `penanda_barang_kembali` (06.00; **39 mesin**). 4 route/9 layar (`/saya/kirim/[jenis]/[id]`,
  `/logistik/ubah-pembayaran/[jenis]/[id]`, `/logistik/potong-nota`, `/logistik/barang-kembali`).

**Seam & susulan 4-d (tidak menghalangi; kerjakan saat bagian/modul terkait):**
- **Pemeriksaan finance (Cocok/Tidak Cocok, Kas Masuk, serah tunai) = 4F-5a** (4-f): `pembayaran`/`bagian_nota`
  siap dibaca; gerbang **pembayaran terkunci** (nota `terkunci`) sudah menolak ubah, ditegakkan penuh saat 4F-5
  menulis `terkunci`. Bagian cash/transfer dipisah untuk pencocokan uang fisik (LOG-112 butir 6).
- **Kirim Besok / Gagal / retur = 4F-4b** (4-e): `barang_kembali.sumber` menerima 'retur'; kunjungan/tujuan di
  4-d hanya bisa Terkirim. Daftar & layar Barang Kembali dipakai ulang 4F-4b.
- **"Perlu nota di kasir" & koreksi stok (K6) = 4C:** `koreksi_kasir` disiapkan; jalur DIKETIK dibangun penuh.
- **Peta/GPS/kamera HP = komponen susulan** (lintang/bujur/foto kini data).
- Migrasi **0037 + benih SUDAH dijalankan ke tempat uji** (22 Okt: "1 migrasi dijalankan"; benih "1 mesin baru,
  39 total"; 10 baris hak baru = Finance 2 + Kepala Gudang 5 + Kepala Toko 3).

### Bagian 4-e (4F-4b Tidak Terkirim & Retur) — SELESAI & DI-MERGE ke `main`

Hijau `npm run cek` (**714 tes**, 50 berkas; migrasi sah **38**) + `npm run build`. Lengkap di CHANGELOG #275.
- Migrasi `0038`: 6 tabel (tidak_terkirim, tertunda, retur, barang_retur, riwayat_retur, kiriman_kasir
  [SEAM 4F-5 tipis]) + ALTER `barang_kembali` (sumber terima 'tidak_terkirim' + kolom tinjau).
- **INTI UANG (WAJ-06):** pustaka murni `src/lib/logistik-retur.ts` — `nilaiReturPerCabang` (nilai retur per
  cabang pemilik → kiriman ke kasir "kurangi tagihan", LOG-124), `validasiNilaiBarang` (Rp0 wajib alasan),
  `tertundaMerah`/`tidakSesuaiLewat3Hari`, `alasanSahUntukHasil`. +18 tes (U35–U48, W23–W26).
- 4 pintu baru + 5 disambung: `logistik-tidak-terkirim.ts` (`catatTidakTerkirim` pintu bersama + Kirim Besok/
  Gagal + Coba lagi + Diturunkan di Gudang), `logistik-tertunda.ts` (daftar+Putuskan [Batal→kiriman_kasir]+
  Tutup), `logistik-retur.ts` (Tandai/Tugaskan/Lepas/Batalkan/Ambil/**Nilai**/rincian + `majukanReturKeNilai`
  + `lepasReturTripSeam`), `logistik-tinjau.ts` (Tinjau L57 + teruskan HR). **Seam trip disambung:**
  selesaiLebihAwal/tutupTripKantor/tutupPerjalanan → `catatTidakTerkirim`; batalTrip → retur Menunggu
  ditugaskan; terimaBarang (4F-4a) → `majukanReturKeNilai`.
- +9 hak `log.*` (`nilai_retur` batas keras [] → Finance; `ambil_retur` 'diri'; sisanya ke Kepala Gudang/
  Finance/Kepala Toko via benih). **Tidak ada mesin baru** (merah/umur dihitung saat baca; Dashboard = 4F-5).
- 6 route/11 layar: `/saya/tidak-terkirim/[jenis]/[id]`, `/logistik/tertunda`, `/logistik/retur`(+[id]),
  `/saya/ambil-retur/[id]`, `/logistik/tinjau`. Tombol Kirim Besok/Gagal/Coba lagi di Trip Saya & Antar;
  kartu tugas retur di Trip Saya; menu Beranda Tertunda/Retur/Tinjau digerbang hak.

**Seam & susulan 4-e (tidak menghalangi; kerjakan saat bagian/modul terkait):**
- **Isi daftar Kiriman ke Kasir (batalkan penjualan, kurangi tagihan retur), tanda tercatat, Dashboard,
  Laporan = 4F-5** (4-f/4-g/4-h): `kiriman_kasir` ditulis 'menunggu'; 4F-5 menampilkan & menandai 'tercatat'.
- **"Teruskan ke HR sebagai kehilangan barang" (GAJ-75):** Logistik hanya menandai `barang_kembali.
  diteruskan_hr`; usulan kehilangan dibuat HR di modul Gaji (WAJ-03).
- **Patokan harga nota kasir 60 hari (L56) & pembatalan dicocokkan sendiri = 4C** saat menyala; nilai diketik
  tangan sekarang. **"Toko mau retur" (kabari kantor) = susulan kecil.**
- **Barang di Gudang + jadwal ulang antar sendiri:** barang jadi barang kembali ke cabang asal (sumber
  'tidak_terkirim'); gate "baru bisa Mulai antar sesudah Diterima" belum ditegakkan di `mulaiAntar` (susulan).
- **Peta/GPS/kamera HP = komponen susulan** (lintang/bujur/foto kini data).
- Migrasi **0038 + benih SUDAH dijalankan ke tempat uji** (22 Okt; lihat konfirmasi di bawah).

### Bagian 4-f (4F-5a Pemeriksaan Uang) — SELESAI & DI-MERGE ke `main`

Hijau `npm run cek` (**746 tes**, 51 berkas; migrasi sah **39**) + `npm run build`. Lengkap di CHANGELOG #276.
- Migrasi `0039`: 3 tabel (`serah_tunai`, `pemeriksaan_uang`, `selisih_serah`). **Tidak ada tabel Buku Kas**
  (pola seam 0030/0031/0032): baris Kas Masuk diturunkan Keuangan 4H dari `pemeriksaan_uang` Berlaku +
  `bagian_nota` (WAJ-03).
- **INTI UANG (WAJ-06):** pustaka murni `src/lib/logistik-periksa.ts` — `jumlahSerahTunai` (harus diserahkan
  per trip, rincian per toko & pembawa), `hitungSelisihSerah` (koreksi per toko dulu → sisa kurang/lebih serah;
  V3/LOG-129), `bagiSelisihPembawa` (dua pembawa tak jelas → bagi rata bertanda), `tanggalMasukDepositSah`
  (KEU-12), `barisKasMasuk` (turunan per nota LOG-64), `bolehBatalPemeriksaan` (V5/LOG-132). **+29 tes (U49–U63,
  W27–W40).**
- 1 pintu baru `logistik-periksa.ts`: `terimaUangTunai` (L59, truk & antar sendiri; koreksi per toko memakai
  `jalankanBagiUang` 4F-4a), `periksaTransfer` (L60, Cocok sekaligus), `periksaDeposit` (L61, Masuk/Belum masuk),
  `batalkanPemeriksaan` (L63), + reads daftar/rincian. `logistik-kirim.ts` `pembayaranTerkunci` kini mengunci bila
  ada pemeriksaan Berlaku (LOG-116). **KEU-120** pemeriksa ≠ pengubah terakhir ditegakkan pintu.
- +5 hak `log.*` (`terima_tunai_trip`/`periksa_uang`/`batalkan_pemeriksaan` batas keras [] → Finance;
  `terima_tunai_antar` cabang → Kepala Toko; `lihat_pemeriksaan_uang` → Finance + Kepala Gudang [tab Tunai trip]).
- 2 mesin baru (**41 total**): `penanda_uang_belum_diperiksa` (06.00), `penanda_uang_tunai_belum_diserahkan`
  (12.00 & 23.59). 3 route/6 layar (`/logistik/pemeriksaan-uang`(+terima/[jenis]/[id] + [pembayaran])).

**Seam & susulan 4-f (tidak menghalangi; kerjakan saat bagian/modul terkait):**
- **Pengikut setoran kasir (V2):** tunai antar sendiri "ikut setoran Laporan Kasir Cocok" = mesin Keuangan 4H
  (butuh Laporan Kasir). Jalur diketik penuh (teman cabang menerima → laci cabang asal); `lewat_setoran` menandai.
- **Kas Masuk / Buku Kas = Keuangan 4H** membaca `pemeriksaan_uang` + `bagian_nota`.
- **Kurang serah → Potongan Lain (GAJ-21, 80):** Logistik hanya menandai `selisih_serah.diteruskan_hr`; usulan HR.
- **Daftar "Catat di Kasir" / ringkasan nota siap dicatat = 4F-5b (4-g); Dashboard = 4F-5c (4-h).**
- **Peta/GPS/kamera HP = komponen susulan.** Marketing (pemberitahuan deposit belum masuk) sementara ke Pemilik/GM
  (jabatan Marketing belum ada di benih contoh).
- Migrasi **0039 + benih SUDAH dijalankan ke tempat uji** (22 Okt; lihat konfirmasi di bawah).

### Bagian 4-g (4F-5b Kiriman ke Kasir & Daftar Tagih) — SELESAI & DI-MERGE ke `main`

Hijau `npm run cek` (**774 tes**, 52 berkas; migrasi sah **40**) + `npm run build`. Lengkap di CHANGELOG #277.
- **Penyelarasan sesudah beku (disetujui pemilik 22 Okt):** tabel tipis `kiriman_kasir` (0038) **diganti nama →
  `catat_kasir`** & dilengkapi jadi daftar induk 7 jenis (D2 "satu daftar"). Penulis lama (retur, tertunda)
  dialihkan lewat pintu tulis bersama `tulisBarisKasir`.
- Migrasi `0040`: RENAME+perluas `catat_kasir` (isi jsonb, versi, siap_sejak, nomor bukti, sumber+jenis unik);
  tabel baru `koreksi_nota`, `cocok_piutang`, `catatan_tagih`; seam `unggah_piutang` + `kasir_piutang`.
- **INTI UANG (WAJ-06):** pustaka murni `src/lib/logistik-catat-kasir.ts` — `notaSiapDicatat`, `isiRingkasanNota`
  (sisa tak pernah negatif), `warnaTagih`, `piutangPerluDiperiksa` (kasir>HRIS & >1 hari), `filePiutangKedaluwarsa`,
  `janjiTagihLewat`. +23 tes (U50–U63) + 5 tes hak (H53–H58).
- Pintu: `logistik-catat-kasir.ts` (**`segarkanCatatKasir`** penulis otomatis LOG-133; tandai/tandai sekaligus/
  batal tanda; pintu tulis `tulisBarisKasir`/`tulisBarisKeuangan`), `logistik-koreksi-nota.ts` (uang/tempat uang/
  potongan/nilai retur → ganti pembayaran+bagi ulang LOG-112 + baris koreksi), `logistik-daftar-tagih.ts`
  (daftar/rincian/catat hasil tagih/unggah file/biarkan beda piutang/kotak minta ditagih).
- **Seam penulis Catat di Kasir disambung ke 6 sumber:** pemeriksaan uang (terima/transfer/deposit/batal), keputusan
  potong nota, keputusan Batal (tertunda), nilai retur, trip Selesai (rencana + trip saya), Foto 3 (antar).
- +9 hak `log.*` (lihat_catat_kasir/lihat_daftar_tagih/catat_hasil_tagih 'semua'; tandai_tercatat/koreksi_nota/
  putuskan_beda_piutang/unggah_piutang/batalkan_tanda_siapa_pun batas keras [] → Finance; lihat_kotak_minta_ditagih
  'diri'). 3 mesin baru (**44 total**): penanda_catat_kasir (06.00), pencocok_piutang_kasir (1 jam),
  penanda_janji_tagih (06.00). 4 route/7 layar: `/logistik/catat-kasir`, `/logistik/koreksi-nota`,
  `/logistik/daftar-tagih`(+`[toko]`). Menu Beranda +2.

**Seam & susulan 4-g (tidak menghalangi; kerjakan saat bagian/modul terkait):**
- **Piutang per nota dari tarikan kasir, layar Perlu Diperiksa tab Piutang penuh, nota cabang dipilih dari kasir =
  4C:** sekarang diisi lewat Unggah File (`kasir_piutang`/`unggah_piutang`); mesin tarikan mengisinya saat 4C menyala.
- **Kas Masuk/Buku Kas, titipan pelunasan (KEU-46) & pembayaran toko ke Gudang (KEU-69) = Keuangan 4H:** pintu tulis
  `tulisBarisKeuangan` + `koreksi_nota.pengganti_*` siap dibaca; Keuangan menurunkan Kas Masuk.
- **Kotak "minta ditagih" belum dipasang di layar Kunjungan Toko (LOG-L18) & Sampai di Tujuan (LOG-L33):** fungsi
  baca `kotakMintaDitagih` + hak `log.lihat_kotak_minta_ditagih` siap; tombolnya disambung susulan kecil.
- **Kurang serah → Potongan Lain, sengketa → mungkin koreksi/retur:** catatan tagih hanya menandai; HR/Finance
  menindaklanjuti. **Dashboard = 4F-5c (4-h). Peta/GPS/kamera HP = komponen susulan.**
- Migrasi **0040 + benih SUDAH dijalankan ke tempat uji** (22 Okt; lihat konfirmasi di bawah).

### Bagian 4-h (4F-5c Dashboard, Laporan, Bensin) — SELESAI (bagian TERAKHIR Logistik)

Hijau `npm run cek` (**796 tes**, 53 berkas; migrasi sah **41**) + `npm run build`. Lengkap di CHANGELOG #278.
- Migrasi `0041`: 3 tabel (`permintaan_bensin` [satu Menunggu per mobil], `catatan_bensin` [asal uang, tempat uang,
  nominal, cabang dibebani, foto; SEAM `baris_buku_kas` + `diperiksa_keuangan`], `tinjau_luar_titik` [satu Berlaku
  per catatan bertanda]).
- **Dashboard (LOG-L71):** `logistik-dashboard.ts` HANYA MEMBACA (LOG-82, WAJ-04) — tiap baris dihitung dengan rumus
  yang sama dengan mesin penandanya. 4 bagian digerbang HAK (WAJ-05): `log.dashboard_operasi`/`dashboard_uang`/
  `dashboard_kurang_serah`/`lihat_bensin`; pagar titik mati hanya akses penuh. Muat ulang 1 menit.
- **INTI UANG (WAJ-06):** pustaka murni `src/lib/logistik-bensin.ts` — `validasiCatatanBensin`, `akibatAsalUang`
  (kembalian/kekurangan; tiga asal uang B3/LOG-144), `permintaanMerah` (12.00 besok, B4). +13 tes (U64–U67, W41).
  Pintu `logistik-bensin.ts` (Sudah Diisi 3 langkah + Tidak jadi + Catat bensin + Batalkan + `buatPermintaanBensin`
  SEAM KEH-L20), `logistik-tinjau-titik.ts` (Wajar/Titik salah/Tidak wajar, bukan awak/PJ-nya), `logistik-laporan.ts`
  (6 tab + Unduh Excel SpreadsheetML tanpa pustaka).
- +10 hak `log.*` (bensin/catat/batal = batas keras; batalkan siapa pun = akses penuh) + 9 tes hak (H59–H67).
  2 mesin baru (**46 total**): `penanda_permintaan_bensin` (12.00), `penanda_kirim_luar_titik` (06.00). 4 route/7
  layar (`/logistik/dashboard`, `/logistik/bensin`, `/logistik/tinjau-luar-titik`, `/logistik/laporan`); Dashboard =
  butir pertama menu Logistik.

**Seam & susulan 4-h (tidak menghalangi; pola sama 4-f/4-g):**
- **Baris uang keluar bensin di Buku Kas = Keuangan 4H** (KEU-18, 26): `catatan_bensin` menyimpan datanya; Keuangan
  menurunkan baris & menandai `baris_buku_kas`/`diperiksa_keuangan`. **"Uang bensin belum ada struknya"** di Dashboard
  = SEAM 4H (kosong sampai menyala).
- **Permintaan bensin dari KEH-L20:** pintu `buatPermintaanBensin` siap; tombol di Laporan Pulang disambung susulan.
- **Data kasir terakhir masuk** (Dashboard) = SEAM 4C. **Peta/GPS/kamera HP** = komponen susulan. **Jabatan Marketing**
  (Dashboard tanpa bensin/kurang serah, Laporan tanpa bensin) didaftar di hak.ts, dibenihi saat jabatan dibuat (KAR).
  **Unduhan Laporan tercatat (KEU-116)** = susulan (belum ada tabel jejak unduhan).
- Migrasi **0041 + benih SUDAH dijalankan ke tempat uji** (22 Okt).

### Bagian 4-b (4F-2 Rencana & Trip Truk) — seam & susulan

**Seam & susulan 4-b (tidak menghalangi; kerjakan saat bagian/modul terkait):**
- **Tarif pasangan mobil×rute = 4G:** Siap Kirim MENANDAI "belum ada tarif" tetapi tidak memblokir
  (kalau diblokir, tak ada trip bisa jalan sebelum 4G; sejalan 4-a LOG-L07). Gate disambung saat 4G ada.
- **Tombol Kirim/Kirim Besok/Gagal tiap kunjungan + uang per kunjungan = 4F-4** (4-d/4-e). Kerangka
  kunjungan + "Saya menuju ke sini" sudah ada; tiga tombol hasil menyusul.
- **Paket cabang (laporan_muat) = 4F-3** (4-c); **tugas retur = 4F-4** (4-e): rencana siap menampung.
- **Laporan Pulang (KEH-L20)** diisi lewat layar Kehadiran (2-c); lapor garasi menandai absen pulang
  `menunggu_laporan`. **Penanda "trip belum ditutup" (LOG-31) & "rencana menggantung" = Dashboard 4F-5**
  (4-h): mesinnya didaftarkan di sana (daur hidup trip tak butuh mesin itu untuk benar).
- **NOMINAL ritase & upah belanja = Gaji Driver 4G.** Peta/GPS/kamera HP = komponen susulan.
- Jabatan **Driver & Kenek** belum ada di benih contoh → izin tugas lapangan dibenihi ke 2 orang contoh
  (C008 menyetir, C006 kenek) sebagai data demo; hak `log.*` mereka menyusul saat jabatan dibuat (KAR).

## Lokasi project

**`D:\Applikasi NaurArkhAzzam\Hris v3\`** (repo privat GitHub `Naurakhazzam/hris-v3`).
Repo kode: dokumen di `docs/`, kode di `src/`, migrasi di `db/migrasi/`.

## Posisi di peta jalan

| Tahap | Posisi |
|---|---|
| 0–4 | Selesai (aturan, 7 modul, rancangan lintas modul, 16 spec, ~400 layar) |
| 5 | Selesai seluruhnya (5A–5D) |
| 6 | **Sedang jalan.** Langkah 1 & 2 (Kehadiran) & 3 (Gaji 4E) & 4 (Logistik 4F) SELESAI & di `main`. **Langkah 5 (Gaji Driver 4G) MULAI: bagian 5-a SELESAI & di `main` (PR #45).** Berikutnya: bagian 5-b (4G-2). |

Urutan modul Langkah 6 (dari peta jalan): 1 Karyawan dan Akses **(selesai)** → 2 Kehadiran **(selesai: 2-a..2-e)**
→ **3 Gaji Bulanan (selesai: 3-a..3-f-2)** → **4 Logistik (SELESAI: 4-a..4-h di main)** → **5 Gaji Driver/Borongan/Kasbon (JALAN: 5-a di main; 5-b s.d. 5-f berikutnya)** →
6 Keuangan → 7 Kinerja dan Rekrutmen. Detail: `docs/work/plans/2026-10-11-peta-jalan-v3.md`.

## Aturan sesudah beku

- Aturan dan spec tidak diubah lagi. Ide baru dicatat di `docs/work/backlog/`.
- Kesalahan atau pertentangan yang ketahuan saat membangun boleh diperbaiki kalau pemilik
  setuju, dicatat di CHANGELOG, bertanda "diperbaiki sesudah beku".
- Sistem lama (`../hris-app/`) dan database-nya hanya dibaca (WAJ-09).

## Langkah 2 — modul Kehadiran: pembagian (DIKONFIRMASI 19 Okt 2026)

Spec: `docs/work/specs/2026-10-13-kehadiran-spec.md` (2.323 baris, 43 layar, ~11 tabel).
**Keputusan pemilik 19 Okt 2026:** dipecah **sedikit bagian besar (±4–5 sesi), satu
bagian satu sesi**; **tidak** dipecah bertingkat (sub-sub-sesi) kecuali satu bagian
benar-benar tak muat satu sesi. Alasan: tiap sesi baru membaca ulang konteks, jadi sesi
kecil-kecil justru boros token (pelajaran dari Langkah 1).

Pembagian **mengikuti batas sub-bagian spec yang sudah "disetujui penuh"** (4D-1 s.d.
4D-5b), urut dari pondasi. **Dipilih pemilik 19 Okt 2026: 5 sesi.**

| Bagian | Sub-bagian spec | Isi | Layar | Status |
|---|---|---|---|---|
| 2-a | 4D-1 | Jam & Jadwal + **pondasi DB modul Kehadiran** | 5 (L01–L05) | **SELESAI & di `main` (PR #19)** |
| 2-b | 4D-2a + 4D-2c | Absen harian & istirahat + Absen lewat trip | 8 (L06–L11, L18–L19) | **SELESAI & di `main` (PR #20)** |
| 2-c | 4D-2b + 4D-3 | Tinjau/Koreksi/Catatan/Rekap + Laporan Pulang/serah terima/masalah/mobil | 12 (L12–L17, L20–L25) | **SELESAI lokal (belum di-push)** |
| 2-d | 4D-4a + 4D-4b | Libur & Tukar + Izin/Sakit/Cuti | 9 (L26–L34) | **SELESAI lokal (belum di-push)** |
| 2-e | 4D-5a + 4D-5b | Perlu Dijelaskan + Lembur (**uang → tes wajib WAJ-06**) | 9 (L35–L43) | **SELESAI lokal (belum di-push)** |

Catatan: 2-c paling berat (12 layar) — dipecah jadi dua sesi HANYA kalau ternyata tak
muat; jangan dipecah di muka (pelajaran Langkah 1).

Kehadiran menumpang pondasi Langkah 1 (Mesin Pengajuan, hak akses, komponen baku, mesin
terjadwal, jam server, tempat uji) — jadi mestinya lebih ringan dari Langkah 1 meski
spec-nya tebal.

### Bagian 2-a (4D-1) — SELESAI & di `main` (PR #19, merge 20 Okt 2026)

Hijau `npm run cek` (**270 tes**); migrasi 0021 + benih sudah di tempat uji. Yang dibangun:
- Migrasi `0021`: 8 tabel (jam_kerja_cabang, jam_tutup_kantor, kelompok_giliran, anggota_kelompok,
  giliran_shift, radius_absen_cabang, qr_cabang, hari_tutup).
- `src/lib/kehadiran-jadwal.ts` + 28 tes (W1/W5/W6/W8/W2/W3/W4); `hak-kehadiran.test.ts` 8 tes (H1–H10).
- 13 tindakan `keh.*` + benih hak ke jabatan contoh.
- Mesin `penggilir_shift` + `pemeriksa_giliran` (terdaftar + dibenihi, 10 mesin total).
- 5 layar: `/kehadiran/jam-kerja`, `/kehadiran/jadwal-shift`, `/kehadiran/lokasi-qr`,
  `/kehadiran/hari-tutup`, `/saya/jadwal`. Komponen baku baru `StripHari` + `TabelMinggu`.
- Benih contoh: 2 shift + radius + QR di "Toko Contoh 1" (kelompok sengaja kosong untuk demo).
- Docs: CHANGELOG #255, desain/README (komponen). Buku aturan sudah memuat KEH-102–107.

**Keputusan rancangan 2-a (penyelarasan sesudah beku; lengkap di CHANGELOG #255):** (a) tidak ada
tabel `pengaturan_kehadiran` — pakai `pengaturan_umum`+registri (spec bagian 8); 4D-1 tak menambah
entri registri (jadwal mesin di `mesin_otomatis`, radius & jam tutup kantor di tabelnya sendiri).
(b) `jam_kerja_cabang` satu tabel; `giliran_shift` menunjuk shift lewat (cabang, nama_shift).

**Susulan kecil 4D-1 (tidak menghalangi; kerjakan saat bagian terkait):**
- Render **gambar QR** (butuh 1 lib kecil) — bareng modul Absen 2-b (yang memindainya).
- **Draf pengumuman** otomatis saat jam kerja/radius berubah, dan **pemberitahuan GM** — titipan 4J.
- Entri **daftar-periksa-uji** 4D-1 (kejadian lapangan Kehadiran) — struktur uji sekarang masih
  ber-rilis "Langkah 1"; ditambah saat daftar uji Langkah 2 disiapkan.
- **Pintu baca `jam_buka_cabang`** untuk Tarik Data Kasir (4C): fungsi murni `jamBukaCabang`
  sudah ada & teruji (W6); pembungkus server tipis ditambah saat 4C membangunnya.

### Bagian 2-b (4D-2a + 4D-2c) — SELESAI & di `main` (PR #20, merge 20 Okt 2026)

Hijau `npm run cek` (**317 tes**, 26 berkas). Migrasi 0022 + benih **perlu dikonfirmasi** apakah
sudah dijalankan ke tempat uji (dijalankan pemilik lokal `npm run migrasi`).
Yang dibangun (lengkap di CHANGELOG #256):
- Migrasi `0022`: 7 tabel (catatan_absen, percobaan_absen, perbantuan, tanya_pindah,
  catatan_istirahat, absen_trip, akses_foto_absen).
- `src/lib/kehadiran-absen.ts` + 39 tes (W9–W15, W21–W27 sejauh dimiliki 2-b); hak-kehadiran.test.ts
  +15 tes (H15/H16/H29–H31). 7 tindakan `keh.*` baru + benih hak ke jabatan contoh.
- Pintu: kehadiran-absen (L06 keadaan + L07 langkah + L08 perbantuan + L09 istirahat),
  kehadiran-perbantuan (L11), kehadiran-pindah (KEH-27), kehadiran-absen-trip (L18/L19 + buka foto).
- Mesin `penghapus_foto_absen` (02.00) — terdaftar + dibenihi (11 mesin total).
- 4 layar: `/kehadiran/absen` (HP), `/kehadiran/perbantuan` (PC), `/saya/absen-trip` (HP),
  `/kehadiran/absen-trip` (PC). Tanpa komponen baku baru.

**Seam & susulan 2-b (tidak menghalangi; kerjakan saat bagian terkait):**
- **Laporan Pulang + KEH-L10 "Sudah pindah?"**: tombol Pulang menandai absen `menunggu_laporan`;
  jendela Laporan Pulang & pemicu KEH-L10 (muncul SESUDAH laporan terkirim, KEH-27) dirangkai **2-c**
  (4D-3). Logika + pintu tanya-pindah sudah siap (`perluTanyaPindah`, `jawabPindah`); jawaban "Ya"
  melahirkan usulan pindah (KAR-56) saat perangkaian 2-c.
- **Absen trip ditulis pintu Logistik 4F** (KEH-120): 2-b hanya menyediakan tabel + layar baca.
  Layar L18/L19 kosong sampai 4F (atau benih contoh trip ditambah). Mesin LOG-31 (trip menggantung)
  milik Logistik.
- **Mesin "Penanda tidak absen pulang"** (spec 4D-2a) **ditunda ke 2-e**: sasarannya
  `kejadian_perlu_jelas` baru ada di 4D-5.
- **Daftar "Tidak jalan"** di L19 diisi mesin Pembuat catatan hari kerja (**2-c**).
- Kamera/pemindai QR/GPS sungguhan di HP = susulan (foto/QR/koordinat kini data); pemilih shift
  perbantuan "pilih sendiri" di layar masih sederhana (server tetap menegakkannya).
- Entri **daftar-periksa-uji** 4D-2a/4D-2c — ditambah saat daftar uji Langkah 2 disiapkan.

### Bagian 2-c (4D-2b + 4D-3) — SELESAI (lokal), belum di-push

Hijau `npm run cek` (**355 tes**, 27 berkas; migrasi sah 23). Migrasi 0023 + benih **belum
dijalankan ke tempat uji**. Yang dibangun (lengkap di CHANGELOG #257):
- Migrasi `0023`: 12 tabel (hari_kerja, tinjauan_absen, tanda_pola_lokasi, koreksi_absen,
  laporan_pulang, serah_terima, penerima_serah_terima, keterangan_laporan, laporan_masalah,
  tindakan_laporan_masalah, keadaan_mobil, tindak_lanjut_mobil).
- `src/lib/kehadiran-hari.ts` + 24 tes (telat/toleransi W16, pulang cepat, status KEH-118/W19,
  periode 26..25/W20) + `src/lib/kehadiran-label.ts` (label status/catatan).
- `src/server/kehadiran/hitung-hari-kerja.ts`: SATU fungsi hitung hari kerja (WAJ-04), dipakai
  mesin & hitung-ulang koreksi.
- Mesin `pembuat_catatan_hari_kerja` (04.10) + `pendeteksi_pola_lokasi` (05.00) — terdaftar +
  dibenihi (13 mesin total) + tes.
- 14 tindakan `keh.*` + 38 tes hak (H19–H41) + benih ke jabatan contoh. KEH-128: GM vs Pemilik
  dibedakan lewat `jabatan.akses_penuh` langsung vs `mengikuti_jabatan` (tanpa nama, WAJ-05).
- 8 pintu: tinjau-koreksi, catatan-rekap, kehadiran-saya, foto-absen, laporan-pulang,
  serah-terima, laporan-masalah, keadaan-mobil.
- 12 layar (L12–L17, L20–L25); menu Beranda digerbang hak. Tabel rekap dibuat inline.

**Seam & susulan 2-c (tidak menghalangi):**
- **Status Libur/Izin/Sakit/Cuti & Alpha** menunggu 4D-4 (2-d) & penanda alpha (4D-5, 2-e);
  sampai itu mesin menulis Hadir/Hari tutup/Tidak jalan/belum ditentukan (KEH-118). Fungsi
  `statusHariKerja` sudah menerima libur & pengajuan (tinggal disambung saat tabelnya ada).
- **Lembur** tiga angka = 4D-5 (2-e); rekap/catatan tampil "-".
- **Laporan Pulang & keadaan mobil/bensin untuk driver trip** = pintu Logistik 4F; 2-c menangani
  absen QR. Permintaan bensin disimpan sebagai rujukan sampai 4F (WAJ-03).
- **Koreksi banyak orang**: pintu sudah menerima array + nomor kelompok; layar kini satu orang
  (picker banyak orang + tombol tahan 3 detik untuk >5 orang menyusul).
- **Jendela baca serah terima setelah absen masuk** (KEH-92): pintu `serahTerimaUntukBaca` +
  `tandaiDibaca` siap; kini tampil di menu Serah Terima Saya. Dirangkai ke layar Absen (2-b) nanti.
- `terkunci_pada` hari kerja diisi Gaji 4E; sampai itu cabang "koreksi susulan" belum terpicu.
- Entri **daftar-periksa-uji** 4D-2b/4D-3 — ditambah saat daftar uji Langkah 2 disiapkan.

### Bagian 2-d (4D-4a + 4D-4b) — SELESAI (lokal), belum di-push

Hijau `npm run cek` (**400 tes**, 28 berkas; migrasi sah 24). Lengkap di CHANGELOG #258.
- Migrasi `0024`: 11 tabel (libur_pilihan, tanda_tidak_memilih_libur, ajakan_tukar,
  permintaan_masuk_libur, libur_pengganti, pengajuan_tidak_masuk, tanggal_tidak_masuk,
  surat_dokter, akses_surat_dokter, tahun_cuti, gerak_cuti).
- `src/lib/kehadiran-libur.ts` + 28 tes (jendela KEH-132, akhir pekan/jarak KEH-134, cap cabang
  KEH-34, batas+mendadak KEH-141/142, hari kerja KEH-41, buku cuti KEH-145). Hak +11 tes (H42–H52).
- **Seam 2-c tersambung**: `hitung-hari-kerja.ts` membaca `libur_pilihan` berlaku & `tanggal_tidak_masuk`
  pengajuan disetujui → status Libur/Izin/Sakit/Cuti (KEH-118).
- Mesin Pengajuan diperluas (aditif): **efek transisi** dua arah (`efek-pengajuan.ts` +
  `jalankanAksi`) untuk izin/sakit/cuti; `ajukan()` terima `atasNamaOrang` (KEH-L34).
- 5 mesin baru (18 total): pembatal ajakan 00.05, pencatat tidak memilih 00.10, penghangus pengganti
  00.15, penutup tahun cuti 00.20, penghapus surat 02.30. 14 tindakan `keh.*` + jenis `keh_tidak_masuk`.
- 9 layar (L26–L34) + blok Keterangan Pembantu (L33) di `/persetujuan/[id]`. Menu digerbang hak.

**Seam & susulan 2-d (tidak menghalangi):**
- **Alpha & klarifikasi** (Perlu Dijelaskan) = 4D-5 (2-e); asal "lewat_penjelasan" sudah disiapkan.
- **Jatah libur/cuti sebanding orang baru** (prorata GAJ-06) dibaca Gaji; sementara jatah penuh.
- **Tukar shift satu tanggal** diwujudkan sebagai tukar shift minggu; override shift per hari menyusul.
- **Penghapus surat** berpatokan `tanggal_selesai + 60 hari` sampai penutup slip 4E ada.
- Nominal denda/potongan/kompensasi dibaca Gaji (GAJ-13..16); tak ada uang di 2-d (KEH-48).
- Entri **daftar-periksa-uji** 4D-4a/4D-4b — ditambah saat daftar uji Langkah 2 disiapkan.

### Bagian 2-e (4D-5a Perlu Dijelaskan + 4D-5b Lembur) — SELESAI (lokal), belum di-push

Hijau `npm run cek` (**431 tes**, 30 berkas; migrasi sah 25). Lengkap di CHANGELOG #259.
- Migrasi `0025`: 8 tabel (kejadian_perlu_jelas, penjelasan, penjelasan_kejadian, surat_penjelasan,
  tanda_berturut, lembur_terdeteksi, klaim_lembur, akses_foto_lembur). Kolom lembur 3 angka di
  `hari_kerja` (sudah ada sejak 0023) kini diisi.
- **Pustaka murni + tes wajib (WAJ-06):** `src/lib/kehadiran-lembur.ts` (13 tes: W56–W60, KEH-162/166)
  + `src/lib/kehadiran-jelas.ts` (13 tes: W48–W55, W75). Nominal milik Gaji; di sini kejadian ke-n & jam.
- **Seam tersambung** di `hitung-hari-kerja.ts` (SATU fungsi lembur, WAJ-04): lembur 3 angka mengisi
  `hari_kerja` (rekap "-" → angka, KEH-77); lupa absen disahkan → jam "diisi lewat klarifikasi" & Hadir
  (KEH-63); telat/pulang cepat > 30 menit → kejadian (KEH-151). Lembur lahir saat Laporan Pulang
  (KEH-160); "Ini lembur?" sebelum pertanyaan pindah (KEH-89).
- **4 mesin baru (22 total):** penanda_tidak_absen_pulang 04.05, penanda_alpha 04.20,
  pencatat_tidak_masuk_berturut 04.25, penghangus_klaim_lembur 04.30.
- **Mesin Pengajuan diperluas (aditif):** efek transisi `keh_penjelasan` & `keh_klaim_lembur`;
  `jalankanAksi` terima `muatan` (jam lembur yang diturunkan pengesah, KEH-162).
- **9 tindakan `keh.*` baru** + 2 jenis pengajuan (keh_penjelasan, keh_klaim_lembur). Isi awal tanda
  jabatan dapat_lembur/kena_telat/boleh_menyuruh_lembur dibenihi (KEH-25, 163).
- **9 layar**: `/saya/perlu-dijelaskan`, `/saya/lembur`, `/kehadiran/perlu-dijelaskan`,
  `/kehadiran/lembur-tim`, `/kehadiran/kebiasaan-lupa-absen`, "Ini lembur?" di Laporan Pulang, blok
  Keterangan Pembantu Penjelasan (L38) & Klaim Lembur (L43) di `/persetujuan/[id]`. Menu digerbang hak.

**Seam & susulan 2-e (tidak menghalangi):**
- Pencatatan akses foto surat penjelasan menyusul (tabel aksesnya sendiri; pembukaan sudah digerbang hak).
- Koreksi yang menurunkan telat di bawah ambang tidak menutup kejadian lama (PRI-02; kejadian asli tetap).
- Denda/nominal lembur ditulis Gaji (GAJ-12..16) saat 4E; 2-e hanya menyediakan kejadian ke-n & jam disahkan.
- Entri **daftar-periksa-uji** 4D-5a/4D-5b — ditambah saat daftar uji Langkah 2 disiapkan.

## Langkah 3 — modul Gaji Bulanan (4E): pembagian (DISETUJUI 20 Okt 2026)

Spec: `docs/work/specs/2026-10-13-gaji-bulanan-spec.md` (3.269 baris, 43 layar GAJ-L01–L43,
sudah terbagi di spec jadi 7 sub-bagian 4E-1 s.d. 4E-5c). Buku aturan: `docs/aturan/03-gaji.md`.
Gaji membaca `hari_kerja` (telat, lembur disahkan, status), `tanggal_tidak_masuk`, kejadian lupa
absen (ke-n), `tanda_tidak_memilih_libur`, buku cuti, dll. Di sinilah nominal denda lupa absen
(KEH-154) & lembur (GAJ-12) ditulis, dan `terkunci_pada` hari_kerja diisi saat slip ditutup
(seam yang ditinggalkan 2-c s.d. 2-e).

**Pembagian 6 bagian (DISETUJUI pemilik 20 Okt 2026; ikut batas sub-bagian spec, satu bagian
satu sesi, pola Kehadiran):**

| Bagian | Sub-bagian spec | Isi | Layar | Status |
|---|---|---|---|---|
| 3-a | 4E-1 | Komponen & Pengaturan Gaji + **pondasi DB modul Gaji** (jenis komponen, gaji standar, periode, Aturan Potongan, Buku Upah) | 8 (L01–L08) | **SELESAI (lokal, belum di-push)** |
| 3-b | 4E-2 | **Hitungan dari Kehadiran** — inti uang, **tes wajib WAJ-06**; seam Kehadiran (`hari_kerja`, denda, lembur) | 3 (L09–L11) | **SELESAI (lokal, belum di-push)** |
| 3-c | 4E-3 | Potongan di Luar Kehadiran (kehilangan barang, minus kas, potongan lain, keberatan) — **uang/WAJ-06** | 8 (L12–L19) | **SELESAI (lokal, belum di-push)** |
| 3-d | 4E-4 | Buku Bonus & Dua Dana (Dana Disiplin, Dana Tidak Hadir) | 8 (L20–L27) | **SELESAI (lokal, belum di-push)** |
| 3-e-1 | 4E-5a (inti) | **Tutup Slip (inti)** — hitung slip, penahan, langkah tutup 14 langkah, `terkunci_pada`, mutasi dua dana | 3 (L28–L30) | **SELESAI & di `main` (PR #26)** |
| 3-e-2 | 4E-5a (sisa) | Buka kembali, Tutup lebih cepat slip terakhir, cetakan PDF, pengingat, benih | 2 (L31–L32) | **SELESAI (lokal), siap push/merge** |
| 3-f-1 | 4E-5b | Bayar (langkah bayar, batal, slip Rp0, bayar luar slip, Jadwal Bayar, Daftar Transfer, Ringkasan) | 6 (L33–L38) | **SELESAI & di `main` (PR #30)** |
| 3-f-2 | 4E-5c | Sisi Karyawan (Pendapatan Saya, Slip Saya, keberatan slip, Total Diterima, mantan karyawan) | 5 (L39–L43) | **SELESAI & di `main` (PR #32)** |

Alasan pembagian: 4E-1 wajib duluan & sendiri (fondasi, semua menumpang). 4E-2 dipisah walau
3 layar — mesin uang inti ber-tes-wajib. 4E-3/4E-4 masing-masing 8 layar, pas satu sesi. Hanya
4E-5b+5c digabung (4E-5c banyak menumpang kerangka portal yang sudah ada).

**3-a, 3-b, 3-c, 3-d SEMUA SELESAI & di `main`.** 3-a (0026) & 3-b (0027) lewat PR #22/#23; 3-c (0028)
& 3-d (0029) lewat PR gabungan 20 Okt (bareng perbaikan build). Migrasi 0026–0029 + benih sudah
dijalankan ke tempat uji. **Saat mulai 3-e:** cabang baru dari `main` (migrasi 4E-5a = **0030**).

## Kunci `main` (WAJ-01) — keputusan: Pilihan C (pagar lokal)

GitHub gratis tidak mengizinkan kunci cabang di repo privat. Pemilik memilih lanjut tanpa
biaya: pagar lokal `.githooks/pre-push` menolak push langsung ke `main` (aktif setelah
`git config core.hooksPath .githooks`, sudah dijalankan). **Batas:** bisa dilewati sengaja,
hanya di komputer ini.

**Belum tuntas — pasang kunci server-side yang sesungguhnya begitu bisa:**
- Jalur gratis: pindah repo ke organisasi `hammielionpetshop` kalau paketnya GitHub Team
  (tanya dev — belum dijawab), lalu aktifkan ruleset "require pull request" + required-checks.
- Jalur berbayar: GitHub Pro ~US$4/bulan.
- Paling lambat: dipasang di VPS saat Masa B.

## Titipan terbuka (tidak menghalangi)

- **Tempat uji v3 TIDAK bisa dicek lewat sambungan Supabase sesi.** Akun Supabase yang
  tersambung hanya memperlihatkan dua project **sistem lama** (satu HRIS lama, satu konveksi —
  WAJ-09: hanya baca, jangan sentuh). Tempat uji v3 (migrasi `0001`–`00xx`) dijalankan pemilik
  lokal lewat `npm run migrasi`. Jangan menebak atau mengubah project Supabase lain.
- Migrasi 0023 & 0024 + benih **sudah dijalankan ke tempat uji** (20 Okt 2026). Migrasi 0022:
  dijalankan pemilik saat 2-b; dianggap sudah ada (benih idempoten). Tempat uji tidak bisa dicek
  dari sambungan Supabase sesi, jadi status ini dari keluaran skrip lokal, bukan pembacaan DB.
- Migrasi **0025 (2-e) + 0026 (3-a) + 0027 (3-b) + 0028 (3-c) + 0029 (3-d) + benih** — kini tercakup:
  per 21 Okt `npm run migrasi` melaporkan **33 migrasi semua jalan, tidak ada tertunda** (`npm run migrasi` lalu
  `BENIH_TEMPAT_UJI=ya npm run benih`; benih idempoten & aman diulang). Benih 3-a menambah: 3 jenis
  komponen gaji + Gaji Standar (Training & Karyawan) + 3 mesin gaji + jenis_tanda `gaj_gaji_kosong`
  + hak `gaj.*`. Benih 3-b menambah: 15 pengaturan rumus uang 4E-2 + 2 mesin gaji (penulis denda,
  penghitung koreksi) + 4 hak `gaj.*` (hitungan/tiadakan/koreksi/lihat). Benih 3-c menambah: 3 jenis
  Potongan Lain + tanda ikut-menanggung & bobot (Kepala Toko 2, Kasir/Kepala Gudang 1) + persen kantor
  40% per cabang toko/gudang + 3 mesin gaji (pembagian/tanggungan/penutup keberatan) + 3 jenis pengajuan
  (usulan/keberatan potongan, usul pengaturan) + jenis_tanda `gaj_tanggungan_kurang` + 15 hak `gaj.*`.
  Benih 3-d menambah: 5 jenis bonus (Grooming 10% boleh Pemilik, Ongkir 50%, Promo, Bonus Terukur,
  Bonus Bebas) + pengaturan & penerima contoh + mesin `pemeriksa_bonus_ditahan` + jenis pengajuan
  `gaj_usulan_bonus` + jenis_tanda `gaj_bonus_ditahan` + 9 hak `gaj.*`.
- Migrasi **0030 (3-e-1) + benih SUDAH dijalankan** ke tempat uji (dikonfirmasi 21 Okt)
  (`npm run migrasi` lalu `BENIH_TEMPAT_UJI=ya npm run benih`; idempoten). Benih 3-e-1 menambah:
  mesin `pembuat_slip` (harian 05.30) + 2 hak `gaj.*` (lihat_slip, tutup_slip) ke HR. Migrasi 0030
  membuat tabel slip/baris_slip/slip_nomor/langkah_slip (kosong sampai mesin & tutup mengisinya).
- Migrasi **0031 (3-e-2) + benih SUDAH dijalankan** ke tempat uji (dikonfirmasi 21 Okt).
  Migrasi 0031: tabel `cetak_slip`, `minta_buka_slip` + status `dibatalkan` di `sisa_potongan`. Benih
  3-e-2 menambah: jenis_tanda `gaj_slip_belum_tutup` + mesin `pengingat_tutup_slip` (harian 07.00) +
  hak `gaj.minta_buka_slip` (HR). Hak `gaj.buka_kembali_slip` lingkup [] (hanya akses penuh, tak dibenihi).
- Migrasi **0032 (3-f-1) + benih SUDAH dijalankan** ke tempat uji (21 Okt). Migrasi 0032:
  tabel `tempat_uang` (SEAM Keuangan KEU-02, tipis), `kelompok_bayar`, `pembayaran_slip`, `bayar_luar_slip`
  + ALTER `langkah_slip.aksi` & `baris_bonus.status`. Benih 3-f-1 menambah: jenis_tanda `gaj_belum_dibayar`
  + 2 mesin (`pengingat_belum_dibayar` 07.00, `pembuat_tagihan_luar_slip` 05.40) + 4 hak `gaj.*` (bayar_slip
  lingkup []; lihat_jadwal_bayar/daftar_transfer→Finance; lihat_ringkasan_gaji→HR+Finance) + 3 tempat uang
  contoh (Brankas, Kas Pegangan, Rekening Utama). **Seam Keuangan 4H:** Buku Kas uang keluar & cicilan
  Piutang Lain dibaca 4H dari `pembayaran_slip`/`bayar_luar_slip` (tak ada tabel Keuangan dibuat di sini).
- Migrasi **0033 (3-f-2) + benih SUDAH dijalankan** ke tempat uji (dikonfirmasi 21 Okt: 33 migrasi semua jalan, 36 mesin)
  (`npm run migrasi` lalu `BENIH_TEMPAT_UJI=ya npm run benih`; idempoten). Migrasi 0033: tabel `keberatan_slip`
  (pondasi `perubahan_gaji.asal='pembetulan'` + kolom `keberatan_slip` di 0026, dan
  `koreksi_periode_lalu.jenis_baris='R1'` di 0027 sudah ada — tidak di-ALTER lagi). Benih 3-f-2 menambah: jenis
  pengajuan `keberatan_slip` + jenis_tanda `gaj_pembetulan_keberatan` + mesin `pengingat_pembetulan_keberatan`
  (07.00) + 2 hak ke HR (`gaj.putuskan_keberatan_slip`, `gaj.lihat_total_diterima`). Hak sisi karyawan
  (`gaj.lihat_pendapatan_saya`, `gaj.ajukan_keberatan_slip`) = bawaan 'diri', tak dibenihi;
  `gaj.pembetulan_gaji_periode_lalu` lingkup [] (akses penuh). **SEAM:** login akses-terbatas mantan karyawan
  (C4) menunggu inti Karyawan KAR-07 (fungsi `masihPunyaUrusanUang` + gerbang sudah siap, tinggal disambung ke
  `bacaSesi`/login saat alur penonaktifan dibangun); bongkaran & slip mingguan = 4G (struktur siap, data kosong).

- Migrasi **0034 (4-a) + benih SUDAH dijalankan** ke tempat uji (dikonfirmasi 21 Okt: `npm run migrasi`
  "1 migrasi dijalankan"; benih "Logistik contoh: 4 jenis cabang diisi, 2 mobil, 3 rute"; 36 mesin).
  Migrasi 0034: ALTER `cabang` (+`jenis`) + 9 tabel Logistik. Benih menambah: jenis cabang contoh
  (idempoten, hanya yang NULL) + 2 mobil + 3 rute + hak `log.*` ke Kepala Gudang (kelola) & Finance (lihat).
- Migrasi **0035 (4-b) + benih SUDAH dijalankan** ke tempat uji (dikonfirmasi 21 Okt: "1 migrasi
  dijalankan"; benih "2 supplier, 2 izin lapangan"; 5 baris hak baru). Migrasi 0035: `supplier` (seam
  Keuangan) + 7 tabel trip/awak/kunjungan/tugas belanja/ritase/pagar. Benih menambah: 2 supplier + izin
  tugas lapangan contoh (C008 menyetir, C006 kenek) + 5 hak `log.*` (4 Kepala Gudang, 1 Finance).
- Migrasi **0036 (4-c) + benih SUDAH dijalankan** ke tempat uji (22 Okt: "1 migrasi dijalankan"; benih
  "2 mesin baru, 38 total"; 9 baris hak; `npm run migrasi` lalu
  `BENIH_TEMPAT_UJI=ya npm run benih`; idempoten). Migrasi 0036: 9 tabel Laporan Muat/Paket/Antar Sendiri
  (laporan_muat, foto_laporan_muat, ambil_paket, perubahan_laporan_muat, perjalanan_antar,
  tujuan_perjalanan, kiriman_perjalanan, pengalihan_pj, asal_bonus_ongkir). Benih menambah: 2 mesin
  (penanda_laporan_muat 15 menit, penanda_perjalanan_belum_kembali 23.59; **38 mesin**) + hak `log.*` 4F-3
  (Kepala Toko kelola/alihkan/tutup/lihat cabang + putuskan nota; Kepala Gudang lihat+tugaskan+tutup;
  Finance lihat). Mesin kasir 4F-3 (Penulis bonus ongkir, Pemasang ⚠, Pencocok nota) = seam 4C (tak dibenihi).
- Hak Tambahan (KAR-L29) DITUNDA → dikerjakan utuh setelah modul Keuangan ada (butuh
  mesin terjadwal + sasaran hak lapor Laporan Kasir). Lihat arsip bagian 1-g.
- Bentuk file export produk dan laporan pajak: jangan ditanyakan.
- File contoh kasir, daftar tempat uang, saldo awal: dikumpulkan pemilik nanti.
- Tanggal 26 untuk pindah: dipilih di Tahap 6.
- `engines.node` di `package.json` masih `>=20.9.0` padahal `--env-file-if-exists`
  perlu ≥20.12/22.9 (pemilik & CI v24, jadi tidak menggigit sekarang).

---

Arsip riwayat per sesi: `docs/work/WIP-arsip.md`. Arsip Tahap 0–5B:
`../bangun-ulang-sistem-hris/docs/work/WIP.md`.
