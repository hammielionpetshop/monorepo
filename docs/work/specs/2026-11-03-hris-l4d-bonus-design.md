# Spec HRIS L4d — Buku Bonus dan Dua Dana

Tanggal: 2026-11-03 · Status: **disetujui owner 2026-11-03; L4d-1 lolos uji owner di staging 2026-11-03 (deployment `e8bd0bec`); L4d-2 tayang staging 2026-11-03, menunggu uji owner** (§9 semua sesuai saran, "ok lanjutkan")
Cakupan: bagian keempat L4 (Gaji Bulanan), yaitu 4E-4 di [PRD 06](../../hris_planning/PRD/fase_1/06-gaji-bulanan.md) (GAJ-L20 s.d. L27), dengan penyimpangan Fase 1 yang sudah diputuskan: **bonus dibatasi** ke Grooming, Ongkir, dan Bonus Bebas (PRD 06 §3.2); bonus ongkir dicatat modul Gaji langsung dari data kasir; Dana Disiplin & Dana Tidak Hadir hanya tampil di HRIS (PRD 06 §3.3). Ditambah layar **Pasangkan Groomer & Pengantar** (PRD 04 §3.3), yang baru terpakai di sini.
Sumber: v3 `03-gaji` GAJ-24 s.d. 35, 61, 83 s.d. 90; `gaji-bulanan-spec` §3.4 (jenis bonus, perjalanan baris, perubahan dari kasir, Dana Disiplin, Dana Tidak Hadir, GAJ-L20 s.d. L27, kartu Aturan Potongan dan Bonus), keputusan B1 s.d. B6 (13 Oktober 2026); PRD 01 §4 (view `v_jasa_grooming`, `v_ongkir`, rumus nilai bersih baris di `packages/shared`); PRD 04 §3.3.
Dasar kode: L2c (penempatan bertanggal, nonaktif), L2e (pengaturan bertanggal, `startDay: 26`), L2f (Mesin Pengajuan, Pemberitahuan, `announceToOwners`), L3c (`payPeriodOf`), L4a (`salary_owner_only`, `isPeriodLocked`), L4b (`attendancePay`, Aturan Potongan), L4c (view POS + stub `petshop-pos.sql`, `cash-shortage-sync`, Tautan Akun Kasir, `deductionsOf` kelompok (c)). POS: `apps/backoffice/lib/grooming-bonus.ts`, `line-net-value.ts`, `ongkir.ts`, laporan Grooming (`grooming-report-service.ts`).
Aliran migrasi: **`hris` 0020** (dan 0021 bila tahap 2, §9 butir 1). Modul: `apps/hris/modules/payroll` (lanjutan).

## 1. Batas

**Pokoknya (GAJ-83):** semua bonus masuk **satu Buku Bonus** lewat **satu pintu tulis di server**, `recordBonus(jenis, orang, tanggal kejadian, cabang, dasar hitungan, asal)`. Pintu itu menghitung nominal dari pengaturan jenis bonus yang berlaku pada tanggal kejadian, menolak penerima yang tidak berhak, dan mencegah dobel lewat **kunci asal** (mis. `GROOMING:<grooming_order_id>`). Tidak ada kode lain yang menulis nominal bonus. Slip (4E-5a) hanya membaca baris yang **Disahkan** lewat fungsi `bonusesOf(orang, periode)`.

Jabatan **GM tidak menerima bonus apa pun** (KAR-67). Jabatan **Pemilik** hanya jenis bertanda "boleh untuk jabatan Pemilik" (isi awal: Grooming), nominalnya hanya terlihat Pemilik/GM, dan tidak disahkan dirinya sendiri (GAJ-09, 46, 61). Orang ber-`pay_basis = WEEKLY` tidak dihitung di sini (L7).

**Dikerjakan** (§9 butir 1: dua kali tayang staging):

| Tahap | Isi |
|---|---|
| **L4d-1** | Jenis Bonus (Grooming, Ongkir, Bonus Bebas) + pengaturan bertanggal, pintu tulis Buku Bonus, view POS grooming & ongkir + mesin `bonus-sync`, **Pasangkan Groomer & Pengantar**, Persetujuan Bonus tab Grooming / Ongkir / Perubahan dari kasir / Ditahan / Belum dipasangkan, Buku Bonus, tab **Bonus** di Gaji Seseorang, kartu bonus grooming & ongkir di Aturan Potongan |
| **L4d-2** | Bonus Bebas (Catat 4 langkah, usulan HR lewat Mesin Pengajuan), jenis ketik tambahan, tab Bonus Bebas di Persetujuan Bonus, **Dana Disiplin & Dana Tidak Hadir** (buku mutasi, Saldo/Terpesan/Tersedia, Isi saldo awal, Sesuaikan, Pindah), pagar Tersedia saat mengesahkan bonus bersumber Dana Disiplin, kartu Dana Disiplin di Aturan Potongan |

**Tidak dikerjakan di L4d:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Bonus Promo, Bonus Terukur (tab 2 dan 3 Persetujuan Bonus) | Kinerja, bukan Fase 1 (PRD 06 §3.2) | Tab tidak ditampilkan |
| Mutasi otomatis dana **saat slip ditutup** (telat/denda masuk Dana Disiplin; alpha/izin/sakit masuk dan lembur/kompensasi keluar Dana Tidak Hadir; bonus bersumber dana keluar; dibalik saat buka kembali) | 4E-5a (langkah tutup slip) | Belum ada slip yang ditutup, jadi Saldo hanya berisi saldo awal, penyesuaian, dan pindah. Kolom **Perkiraan periode berjalan** tampil bertanda "perkiraan, belum masuk saldo" (§9 butir 2) |
| Status **Masuk slip**, bonus orang berhenti menahan slip terakhir, Hangus (GAJ-58), bayar di luar slip (GAJ-89, 106) | 4E-5a / 4E-5b | Dicatat di §10 |
| Buku Upah (DRV-84) | L7 driver & kenek | — |
| Bonus di **Pendapatan Saya** (karyawan, HP) | 4E-5c | Tab Bonus hanya di layar kantor |
| **Unduh Excel** Buku Bonus (KEU-116) | menyusul (HRIS belum punya pembuat Excel) | Daftar bisa disaring dan dicetak |

## 2. Data (`hris` 0020, 0021)

Pola L4b/L4c: yang disimpan hanya catatan dan keputusan manusia; semua tabel tanpa hapus (pemicu tolak `DELETE`), kesalahan dibetulkan dengan Batalkan/Tolak beralasan.

| Tabel | Isi | Tahap |
|---|---|---|
| `bonus_types` | kode (`GROOMING`, `DELIVERY`, `FREE`, + jenis ketik), nama, lahir dari (`POS_GROOMING` / `POS_DELIVERY` / `TYPED`), cara disahkan (`GROUPED` / `NONE` / `PER_ROW`), aktif. Pengaturan bertanggalnya (persen, jabatan penerima, sumber dana bawaan, boleh untuk Pemilik) di registry Pengaturan L2e, sasaran jenis bonus, **mulai tanggal 26** (GAJ-67) | L4d-1 (jenis ketik L4d-2) |
| `bonus_entries` (Buku Bonus) | jenis, karyawan, tanggal kejadian, periode, cabang, dasar hitungan (rupiah), persen yang dipakai, nominal, sumber dana (`OFFICE` / `DISCIPLINE_FUND`), status `HELD` / `PENDING` / `APPROVED` / `REJECTED` / `CANCELLED`, tanda (`GROOMER_CHANGED`, `CHANGED_FROM_POS`), **kunci asal** unik di antara baris yang belum dibatalkan, rujukan asal (id grooming/pengantaran POS, nomor nota, layanan), baris yang digantikan, alasan, pemutus/kapan, pengajuan (Bonus Bebas HR) | L4d-1 |
| `bonus_pos_changes` (Perubahan dari kasir) | baris bonus yang sudah Disahkan, nilai sebelum & sesudah (orang, dasar, nominal, batal/retur), status `OPEN` / `ACCEPTED` / `IGNORED`, alasan, pemutus. **Terima** menulis baris koreksi (plus atau minus) di periode berjalan | L4d-1 |
| `pos_groomer_links` (Pasangkan Groomer & Pengantar) | id `petshop.groomers` → karyawan, atau tanda **bukan karyawan HRIS** (§9 butir 5); dibuat/dilepas oleh-kapan-alasan. Satu nama POS ke paling banyak satu karyawan | L4d-1 |
| `fund_entries` (mutasi dana) | dana (`DISCIPLINE` / `ABSENCE`), arah, jenis mutasi (`OPENING`, `ADJUSTMENT`, `TRANSFER`, dan jenis slip untuk 4E-5a), cabang asal, nominal, alasan, oleh/kapan, rujukan (slip, bonus). Saldo awal sekali per dana | L4d-2 |

**View POS** (pemilik migrasi; `hris_app` tidak membaca `petshop` langsung), mengikuti PRD 01 §4:
- `hris.pos_grooming_services` (`v_jasa_grooming`): tiap `grooming_orders` dengan status, `picked_up_at`, cabang, nomor nota, nama jasa, groomer, nilai baris, `payable_amount`, jumlah baris nota (bahan nilai bersih), dan tanda groomer pernah diganti.
- `hris.pos_deliveries` (`v_ongkir`): tiap `service_deliveries` dengan status, tanggal nota, cabang, pengantar, gratis ongkir, nilai baris ongkir, `payable_amount`, jumlah baris nota.
- `hris.pos_groomers`: id, nama, aktif, memandikan/mengantar (untuk layar Pasangkan).
- **Rumus nilai bersih** `netLineAmount` dan `bonusOf` disalin ke `packages/shared` (pola fungsi Minus Kasir L4c-1, dengan kasus tes yang sama dengan POS); backoffice dialihkan lewat branch dari `main` (§10).

## 3. Aturan

### 3.1 Jenis bonus dan isi awal (GAJ-25, PRD 06 §3.2)

| Jenis | Lahir dari | Lahir sebagai | Disahkan | Isi awal |
|---|---|---|---|---|
| **Grooming** | jasa grooming berstatus **DIAMBIL** di POS (GAJ-61) | Menunggu | per groomer per periode (B2), HR/Pemilik/GM | 10% × harga jasa sesudah diskon, bulat ke bawah; penerima §9 butir 6; **boleh untuk Pemilik** |
| **Ongkir** | pengantaran POS yang bukan gratis ongkir (LOG-76) | **Disahkan** | tanpa pengesahan, bisa **Batalkan** beralasan sebelum slip ditutup | 50% × ongkir sesudah diskon, bulat ke bawah (§9 butir 4); penerima §9 butir 6 |
| **Bonus Bebas** (L4d-2) | diketik | Menunggu (HR) / Disahkan (Pemilik, GM) | per baris, hanya Pemilik/GM (B1) | alasan wajib ≥ 15 huruf; semua jabatan kecuali Pemilik & GM; sumber dana dipilih per baris |

- **Tanggal kejadian** (GAJ-38, 28): Grooming = tanggal **kucing diambil** (`picked_up_at`, WIB); Ongkir = tanggal nota; Bonus Bebas = tanggal diisi. Cabang = cabang nota. Periode = `payPeriodOf(tanggal)`.
- Nota yang **belum lunas tetap berbonus** (GAJ-61; tagihannya urusan piutang kasir).
- Nominal dihitung pintu tulis dari **persen yang berlaku pada tanggal kejadian**; persen disimpan di baris supaya perubahan pengaturan tidak mengubah baris lama.
- **Penerima di luar jabatan penerima** (mis. kasir dipasangkan sebagai groomer): baris **Ditahan**, tampil di "perlu perhatian" HR dan tab Ditahan; masuk Menunggu setelah jabatan penerima jenisnya diubah, atau Ditolak beralasan.
- **Groomer/pengantar belum dipasangkan**: bonus tidak hilang; baris POS tersimpan menunggu dan tampil di tab **Belum dipasangkan** (jumlah jasa, perkiraan nominal). Saat dipasangkan, `bonus-sync` berikutnya (atau tombol Pasangkan langsung) menulis barisnya. Nama bertanda **bukan karyawan HRIS** tidak pernah menghasilkan baris (§9 butir 5).
- GM yang tercatat sebagai groomer/pengantar: tidak menerima (baris tidak dibuat; tampil sebagai catatan di Pasangkan).

### 3.2 Penarikan dari POS (`bonus-sync`, idempoten)

- Tiap malam (dan tombol **Tarik sekarang** untuk HR/Pemilik/GM) membaca view sejak `BONUS_FROM` (§9 butir 3) dan menyamakan Buku Bonus dengan POS per kunci asal:
  - **Belum ada baris** dan syaratnya terpenuhi (Grooming: DIAMBIL; Ongkir: tidak dibatalkan, tidak gratis, nilai bersih > 0) → `recordBonus`.
  - **Ada baris belum final** (Grooming Menunggu/Ditahan; Ongkir Disahkan sebelum periodenya terkunci) dan POS berubah (ganti groomer/pengantar, ubah harga, batal, retur) → baris lama **Dibatalkan** dengan alasan otomatis, baris baru ditulis bertanda "berubah dari … menjadi …"; ganti groomer bertanda ⚠ (GAJ-90). Tidak ditimpa.
  - **Ada baris final** (Grooming Disahkan; Ongkir di periode terkunci) dan POS berubah → satu baris **Perubahan dari kasir** (`OPEN`), tidak menyentuh baris bonus.
  - Dua kali jalan tanpa perubahan POS = tidak ada tulisan baru (tes).
- Grooming yang diterima sebelum `BONUS_FROM` tetapi diambil sesudahnya ikut (yang menentukan tanggal diambil, GAJ-61).

### 3.3 Pengesahan (GAJ-26, 85)

- **Grooming per groomer per periode:** baris bertanda ⚠ diputuskan satu per satu dulu (Sahkan / Tolak, alasan wajib untuk Tolak); lalu satu tombol "Sahkan bonus grooming Rina, periode November: 23 jasa, Rp196.500" **ditahan 3 detik**. Server mengesahkan **tepat daftar baris yang tampil** (dikirim id-nya); baris yang masuk sesudahnya menjadi kelompok menunggu baru. Satu baris boleh dikeluarkan dengan **Tolak** beralasan. Tidak ada "Sahkan semua" lintas orang.
- **Ongkir:** tombol satu-satunya **Batalkan** (alasan wajib), sebelum periodenya terkunci.
- **Perubahan dari kasir:** **Terima perubahan** (lahir baris koreksi plus atau minus di periode berjalan, bertanda periode asal) atau **Biarkan**; alasan wajib. Bonus jabatan Pemilik diputuskan Pemilik/GM.
- **Koreksi minus** (bonus yang harus kembali) dibaca `deductionsOf` di **kelompok (c)** bersama Potongan Lain (GAJ-90); koreksi plus masuk `bonusesOf`.
- Pengesahan sesudah periode terkunci tetap boleh; pesan berhasil menyebut "masuk slip periode berikutnya" (GAJ-50, 86). Penempatannya di slip dibuat 4E-5a.
- **Ditolak server** (jendela "OK, paham"): pemutus tak berhak; bonus milik pemutus sendiri; HR memutus bonus jabatan Pemilik; daftar kelompok berubah sejak layar dibuka (minta muat ulang); (L4d-2) Dana Disiplin tidak cukup, menyebut kekurangannya, baris tetap Menunggu.

### 3.4 Dana Disiplin & Dana Tidak Hadir (L4d-2; GAJ-33 s.d. 35, 87, 88)

- **Satu dana untuk perusahaan** (B4); rincian asal per cabang tampil.
- **Dana Disiplin:** Saldo = jumlah mutasi; **Terpesan** = bonus bersumber Dana Disiplin yang Disahkan dan belum masuk slip yang ditutup; **Tersedia** = Saldo − Terpesan. Pengesahan bonus bersumber dana yang melebihi Tersedia **ditolak** ("Dana Disiplin tersedia Rp300.000; bonus ini Rp500.000; kurang Rp200.000"), barisnya tetap Menunggu. Pemeriksaan dan pengesahan dalam satu transaksi berkunci dana (dua pengesahan bersamaan tidak bisa sama-sama lolos).
- **Dana Tidak Hadir:** laporan, bukan pagar; tabel per periode × cabang (masuk alpha/izin/sakit, keluar lembur/kompensasi libur, selisih) dan saldo berjalan sejak saldo awal. Kalimat tetap: "Ini laporan. Lembur dan kompensasi libur tetap dibayar berapa pun saldonya."
- **Isi saldo awal** (sekali per dana, SIS-33, hanya sebelum ada mutasi lain), **Sesuaikan** (tambah/kurang; kurang tidak boleh membuat Saldo Dana Disiplin di bawah Terpesan), **Pindah** Dana Tidak Hadir → Dana Disiplin (paling banyak saldo berjalan yang positif; satu langkah menulis dua mutasi). Hanya Pemilik/GM, alasan ≥ 15 huruf, 3 langkah, tombol ditahan 3 detik, pemilik lain diberi tahu. Tidak dihapus; salah isi dibetulkan dengan penyesuaian baru.
- **Perkiraan periode berjalan** (§9 butir 2): kolom terpisah dari `attendancePay` + `deductionsOf` (telat & denda → Dana Disiplin; alpha/izin/sakit, lembur, kompensasi → Dana Tidak Hadir), bertanda "perkiraan, belum masuk saldo". Mutasi sungguhan ditulis langkah tutup slip 4E-5a.

### 3.5 Aturan Potongan dan Bonus (GAJ-L07)

Kartu dihitung server dari pengaturan yang berlaku: **Bonus grooming** ("Jasa Rp85.000 sesudah diskon: bonus 10% = Rp8.500, masuk periode tanggal kucing diambil"), **Bonus ongkir** ("Ongkir Rp15.000: bonus 50% = Rp7.500; gratis ongkir tidak berbonus") — hanya untuk jabatan penerimanya; **Dana Disiplin** (L4d-2; kalimat v3, tanpa saldo). Judul isi menjadi "Aturan Potongan dan Bonus", menu tetap.

## 4. Layar

| Layar | Alamat | Menu | Tahap |
|---|---|---|---|
| Persetujuan Bonus (GAJ-L20): tab **Grooming**, **Ongkir**, **Perubahan dari kasir**, **Ditahan**, **Belum dipasangkan** (+ **Bonus Bebas** di L4d-2) | `/bonus/persetujuan` | **Kantor › Gaji › Persetujuan Bonus** | L4d-1 |
| Buku Bonus (GAJ-L21) | `/bonus/buku` | tab di Persetujuan Bonus | L4d-1 |
| Pasangkan Groomer & Pengantar (PRD 04 §3.3) | `/bonus/pasangkan` | dari tab Belum dipasangkan + **Pengaturan › Pasangkan Groomer** | L4d-1 |
| Jenis Bonus (GAJ-L23) | `/pengaturan/jenis-bonus` | **Pengaturan › Jenis Bonus** | L4d-1 (tambah jenis ketik L4d-2) |
| Bonus Seseorang (GAJ-L27) | `/gaji/[employeeId]/bonus?periode=…` | tab **Bonus** di Gaji Seseorang | L4d-1 |
| Catat Bonus Bebas (GAJ-L22, 4 langkah) | `/bonus/catat` | dari Persetujuan Bonus | L4d-2 |
| Dana Disiplin & Dana Tidak Hadir (GAJ-L24, L25) + Pindah dan Sesuaikan Dana (GAJ-L26, 3 langkah) | `/dana`, `/dana/ubah` | **Kantor › Gaji › Dana Disiplin & Tidak Hadir** | L4d-2 |

- **Persetujuan Bonus:** kepala = pilih periode (berjalan lebih dulu), jumlah menunggu per tab, tanggal terakhir `bonus-sync` + tombol **Tarik sekarang**. Grooming dikelompokkan per groomer: tanggal diambil, nomor nota (tautan "Buka di POS"), jasa, harga sesudah diskon, bonus, tanda ⚠. Sesudah satu keputusan ada tombol **Berikutnya**.
- **Buku Bonus:** orang, jenis, tanggal, cabang, dasar, persen, nominal, sumber dana, status, tanda, asal, pemutus; saring periode/jenis/cabang/status/orang; **Batalkan** beralasan untuk baris Disahkan sebelum periode terkunci. Finance melihat **jumlah per jenis per periode** saja.
- **Pasangkan:** daftar nama groomer/pengantar POS, peran (memandikan/mengantar), karyawan tertaut, jumlah jasa & bonus yang menunggu, **usulan** dari kemiripan nama (tidak pernah dipasang otomatis), tombol Pasangkan / Bukan karyawan HRIS / Lepas (alasan). Melepas tidak mengubah baris yang sudah Disahkan.
- **Jenis Bonus:** daftar jenis; klik membuka pengaturan bertanggal (persen, jabatan penerima, sumber dana bawaan, boleh untuk Pemilik) dengan contoh hitungan dari server ("Jasa Rp85.000 → bonus Rp8.500"). Perubahan persen/penerima diumumkan ke penerimanya (PRI-35).
- **Bonus Seseorang:** per periode, baris per jenis (status, nominal, tanggal, asal, alasan ditolak/dibatalkan), jumlah yang Disahkan. Tombol **Lihat aturan**.
- Semua rupiah pakai pemisah ribuan, pesan error di jendela "OK, paham", menu dan bagian baru diberi tanda **Baru**, fragment `apps/hris/changelog.d` per tahap.

## 5. Hak

| Tindakan | HR | Admin HR | Finance | Karyawan | Pemilik, GM |
|---|---|---|---|---|---|
| `bonus.view` (Persetujuan, Buku, tab Bonus; bonus jabatan Pemilik dan orang `salary_owner_only` tidak dikirim ke non-Pemilik/GM) | ✓ | — | jumlah per jenis saja | — | ✓ |
| `bonus.approve` (sahkan/tolak Grooming, batalkan Ongkir/baris, putuskan Perubahan dari kasir, tolak Ditahan) · selfForbidden | ✓ | — | — | — | ✓ |
| `bonus.sync` (Tarik sekarang) | ✓ | — | — | — | ✓ |
| `pos_groomer_link.manage` (Pasangkan) | lihat (§9 butir 7) | — | — | — | ✓ |
| Jenis Bonus: lihat / ubah | lihat | — | — | — | ubah (§9 butir 8) |
| `bonus.record_free` (L4d-2; HR = usulan) | ✓ | — | — | — | ✓ langsung |
| `bonus.approve_free` (L4d-2) · ownerOnly · selfForbidden | — | — | — | — | ✓ |
| `fund.view` (L4d-2) | ✓ | — | tanpa nama orang | — | ✓ |
| `fund.manage` (L4d-2; saldo awal, sesuaikan, pindah) · ownerOnly | — | — | — | — | ✓ |

Penolakan server yang dites: GM sebagai penerima; Pemilik menerima jenis yang tidak boleh; HR melihat/memutus bonus jabatan Pemilik; mengesahkan bonus sendiri; kelompok berubah sejak dibuka; satu nama POS dipasangkan ke dua karyawan; Batalkan Ongkir sesudah periode terkunci; (L4d-2) Bonus Bebas untuk diri sendiri / Pemilik / GM / alasan < 15 huruf / tanggal masa depan; Dana Disiplin tidak cukup; saldo awal kedua kali; penyesuaian membuat Saldo < Terpesan; pindah melebihi saldo berjalan; Admin HR membuka Buku Bonus.

## 6. Mesin terjadwal

| Mesin | Kapan | Isi |
|---|---|---|
| `bonus-sync` | tiap hari 04.45 WIB (baris baru di `infra/apps/cron/crontab`) | §3.2: tulis baris baru, tulis ulang baris yang berubah sebelum final, catat Perubahan dari kasir; idempoten |

Dana tidak butuh mesin di L4d (mutasi slip ditulis 4E-5a).

## 7. Pemberitahuan

| Kapan | Ke siapa | Isi |
|---|---|---|
| Bonus grooming disahkan | groomernya | "Bonus grooming periode November disahkan: 23 jasa, Rp196.500." |
| Baris bonus ditolak / dibatalkan | orangnya | jenis, nominal, alasan |
| Bonus Bebas disahkan (L4d-2) | orangnya | jenis, nominal, alasan |
| Ada baris Ditahan / Belum dipasangkan / Perubahan dari kasir baru | HR, Pemilik, GM (kartu "perlu perhatian" di Beranda) | jumlah |
| Usulan Bonus Bebas menunggu (L4d-2) | Pemilik/GM (kotak Persetujuan) | — |
| Pemilik/GM mengubah Jenis Bonus, memasangkan, mencatat langsung, mengubah dana | pemilik lain (`announceToOwners`) | ringkas |
| Persen atau penerima jenis bonus berubah | penerima jenis itu | persen baru dan mulai tanggal |

## 8. Tes

- **Unit** (`modules/payroll/rules/bonus`): nominal grooming & ongkir sama dengan `bonusOf` POS (kasus tes POS ikut disalin); nilai bersih nota berdiskon total; gratis ongkir = tanpa baris; GM tanpa baris, Pemilik hanya Grooming; penerima di luar jabatan → Ditahan; penyamaan POS (baru / berubah sebelum final → batal + tulis ulang bertanda / berubah sesudah final → Perubahan dari kasir); koreksi minus ke kelompok (c); (L4d-2) Saldo/Terpesan/Tersedia, penyesuaian kurang, pindah.
- **Integrasi DB** (tanggal lampau, stub `petshop-pos.sql` diperluas dengan tabel grooming & pengantaran): view → `bonus-sync` dua kali jalan = sama; groomer belum dipasangkan → menunggu → dipasangkan → baris lahir; ganti groomer di POS sebelum disahkan → baris lama batal + baru ⚠; sahkan kelompok persis daftar yang tampil (baris susulan tetap menunggu); ganti harga sesudah disahkan → Perubahan dari kasir → Terima → koreksi; Batalkan Ongkir; pagar hak §5; pagar tanpa hapus; (L4d-2) Bonus Bebas HR → usulan → sahkan; dua pengesahan bersumber dana bersamaan.
- **View**: CI menjalankan semua aliran migrasi berurutan (PRD 01 §4).

## 9. Keputusan owner (2026-11-03: "ok lanjutkan", semua sesuai saran)

1. **Dua kali tayang.** **Saran: L4d-1** (Grooming + Ongkir + Pasangkan + Persetujuan + Buku Bonus + Jenis Bonus) lalu **L4d-2** (Bonus Bebas + Dana Disiplin & Dana Tidak Hadir), masing-masing diuji terpisah. Promo dan Bonus Terukur tidak dibangun (Fase 1).
2. **Dana sebelum ada slip ditutup.** Mutasi dana lahir saat slip ditutup (GAJ-87, 88), dan tutup slip baru ada di 4E-5a. **Saran:** L4d-2 membangun buku mutasi, saldo awal, penyesuaian, pindah, Terpesan/Tersedia, ditambah kolom **perkiraan periode berjalan** bertanda "belum masuk saldo"; mutasi slip ditulis 4E-5a.
3. **Mulai tarik data POS.** **Saran:** seperti minus kas L4c, tarik sejak periode **26 Oktober 2026** (`BONUS_FROM`) supaya bisa diuji di staging dengan data nyata; **sebelum produksi diganti** ke periode gaji HRIS pertama, supaya bonus yang sudah dibayar lewat HRIS lama tidak terbayar dua kali.
4. **Persen bonus ongkir** (PRD 06 §5 ❓). **Saran: 50%**, sama dengan angka yang sekarang dipakai laporan Grooming POS (`COURIER_BONUS_PERCENT`) dan LOG-77. Grooming 10% (GAJ-61).
5. **Nama groomer/pengantar yang bukan karyawan** (mis. pekerja lepas). HRIS Fase 1 belum punya pekerja lepas. **Saran:** tombol **Bukan karyawan HRIS** (alasan wajib) di layar Pasangkan: bonusnya tidak dicatat di HRIS (dibayar di luar), dan bisa dibatalkan bila kelak dipasangkan.
6. **Jabatan penerima isi awal.** **Saran:** Grooming = **Groomer** (+ Pemilik boleh); Ongkir = **semua jabatan kecuali Pemilik dan GM** (pengantar di nota bisa siapa saja). Penerima di luar daftar → Ditahan. Kalau owner punya daftar lain, sebutkan.
7. **Siapa memasangkan groomer.** PRD 04 §3.3/§5 menyebut tindakan "pasangkan groomer" untuk **Owner, GM**. **Saran: ikuti PRD** — Pemilik/GM memasangkan, HR melihat dan mendapat usulan di tab Belum dipasangkan. (Berbeda dengan Tautan Akun Kasir L4c yang juga dibuka untuk HR.)
8. **Siapa mengubah Jenis Bonus.** v3 GAJ-L23: Pemilik/GM langsung, HR mengusulkan. **Saran: Pemilik/GM langsung, HR hanya melihat** (sama dengan Potongan & Lembur L4b dan Tanggungan Kehilangan L4c); usulan HR untuk pengaturan menyusul.

## 10. Catatan untuk tahap berikutnya

- **4E-5a** wajib: status **Masuk slip** dan penempatan bonus Disahkan terlambat ke slip berikutnya (GAJ-50, 86); mutasi Dana Disiplin & Dana Tidak Hadir saat slip ditutup dan dibalik saat dibuka kembali; slip terakhir tertahan selama bonus Menunggu/Ditahan (GAJ-89); Hangus GAJ-58 (dana terpesan dilepas); koreksi bonus minus tak tertampung di slip terakhir → Piutang Lain.
- **4E-5b:** bayar bonus di luar slip (GAJ-89, 106).
- **4E-5c:** tab Bonus di Pendapatan Saya (karyawan, HP), termasuk baris yang ditolak beserta alasannya (PRI-21).
- **Backoffice:** laporan Grooming POS masih memakai salinan `bonusOf`/`netLineAmount` sendiri sampai dialihkan ke `packages/shared` lewat branch dari `main`; persennya juga masih konstanta POS, sehingga bila owner mengubah persen di Jenis Bonus HRIS, angka "bonus" di laporan POS tinggal perkiraan (WAJ-04, GAJ-61).

## 11. Catatan implementasi L4d-1 (2026-11-03)

- **Jenis bonus belum menjadi tabel.** Grooming dan Ongkir ditetapkan di kode (`rules/bonus.ts`); persennya pengaturan bertanggal `payroll.bonus_grooming_percent` (10) dan `payroll.bonus_delivery_percent` (50), jabatan penerima `position.bonus_grooming` / `position.bonus_delivery` di Pengaturan Jabatan (isi awal: grooming = Groomer + Pemilik; ongkir = semua jabatan, Pemilik dan GM dikecualikan kode). Tabel `bonus_types` dibuat di L4d-2 bersama jenis ketik.
- **Pintu tulis** = `recordBonus` di `server/bonus.ts`, dipanggil hanya oleh `syncBonuses`; nominal dari `netLineAmount` × persen, `bonusOf` (disalin ke `packages/shared/src/utils/grooming-bonus.ts`, BigInt, kasus tes sama dengan POS). Backoffice belum dialihkan (lewat branch dari `main`).
- **Kunci asal** `GROOMING:<id grooming_orders>` / `DELIVERY:<id service_deliveries>` unik di antara baris yang belum Dibatalkan; koreksi `CORRECTION:<id perubahan>:<orang>` (nominal boleh minus, tanda `CORRECTION`). Baris Ditolak tidak dihidupkan lagi oleh mesin.
- **Penyamaan:** sidik keadaan (orang, nominal, tanggal) dibandingkan dengan baris hidup; keputusan Terima/Biarkan menyimpan sidik itu sehingga perubahan yang sama tidak ditandai ulang. Nama kasir yang pasangannya dilepas: baris yang ada tidak disentuh sampai dipasangkan lagi (pindah ke pasangan baru bila belum final).
- **Belum dipasangkan** dihitung saat dibaca dari view (tidak disimpan); jumlah dan perkiraan bonus tampil di tab Belum dipasangkan dan layar Pasangkan.
- **Finance** memakai tindakan baru `bonus.view_totals` (jumlah per jenis per periode). Memasangkan = `pos_groomer_link.manage` (ownerOnly, §9 butir 7); sesudah memasangkan/melepas, mesin langsung dijalankan.
- `BONUS_FROM = 2026-10-26` (§9 butir 3) — **sebelum produksi diganti** ke periode gaji HRIS pertama.
- Mesin `bonus-sync` 04.45 WIB (04.40 sudah dipakai `salary-proposal-expire`).
- Kartu "perlu perhatian" di Beranda belum dipasang (fungsi hitungnya `bonusAttentionCounts` sudah ada); untuk sekarang angka per tab tampil di Persetujuan Bonus.
- **Tes:** unit 12 (`rules/bonus.test.ts`) + 6 (`packages/shared` grooming-bonus), integrasi DB 10 (`bonus.integration.test.ts`); seluruh HRIS 434 lulus berurutan. db-roles: 3 kegagalan lama (H18, dua kunci jawaban `hris-access`) tetap, tidak bertambah.
- Lolos uji owner di staging 2026-11-03 (deployment `e8bd0bec`).

## 12. Catatan implementasi L4d-2 (2026-11-03)

- **Jenis ketik** = tabel `bonus_types` (isi awal "Bonus Bebas", sumber dana bawaan uang kantor); baris Buku Bonus berjenis `TYPED` + `type_id`. Grooming dan Ongkir tetap di kode. Jenis ketik ditambah/diubah/dinonaktifkan Pemilik/GM (`settings.manage` + akses penuh), tidak dihapus.
- **Bonus Bebas**: Pemilik/GM mencatat langsung → Disahkan; HR → jenis pengajuan `free_bonus` (penyetuju `bonus.approve_free`, ownerOnly selfForbidden; ikut `APPROVAL_ACTIONS`). Baris Menunggu disimpan saat usulan dikirim (`request_id`), Disahkan saat disetujui, Ditolak saat usulan ditolak/dibatalkan. Kunci asal `TYPED:R<id pengajuan>` / `TYPED:<uuid>`. Pencatat disimpan; DB menolak pencatat = penerima. Batalkan baris Disahkan hanya Pemilik/GM.
- **Dana**: tabel `fund_entries` (bertanda, tanpa ubah/hapus, saldo awal unik per dana, pindah = dua baris satu `transfer_group`). Terpesan = semua bonus `DISCIPLINE_FUND` yang Disahkan (belum ada slip ditutup). Pengesahan bersumber dana, penyesuaian, dan pindah memakai `pg_advisory_xact_lock` yang sama; Dana Disiplin tidak cukup → pengesahan ditolak, usulan tetap Menunggu (dites dua pengesahan bersamaan).
- **Perkiraan periode berjalan** dihitung saat dibaca dari `computeAttendancePay` tiap orang bergaji bulanan (tanpa Pemilik/GM), per cabang penempatan sekarang. Mutasi slip menyusul 4E-5a (`bonusesOf` kini juga mengembalikan `fromDisciplineFund`).
- Hak awal: HR `bonus.record_free` + `fund.view`; Finance `fund.view` (tanpa nama orang).
- Kartu Beranda "perlu perhatian" bonus masih belum dipasang (sama dengan L4d-1).
- **Tes:** unit 8 (`rules/funds.test.ts`), integrasi DB 6 (`funds.integration.test.ts`); seluruh HRIS 448 lulus berurutan.
