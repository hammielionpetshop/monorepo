# Backlog: mesin pengaman hak akses

Dicatat: 11 Oktober 2026
Status: **disetujui pemilik; dirinci di Tahap 3B (KAR-63, KAR-72; `../specs/2026-10-13-hak-akses-desain.md`)**

## Permintaan pemilik

"Anda harus ciptakan mesin pengaman yang bertugas check, apakah karyawan bisa
melakukan sesuatu yang di luar batas role-nya. Ini sangat penting, agar tidak ada
celah."

Pemicunya: di sistem lama ditemukan akun karyawan bisa mengganti perannya sendiri
menjadi Owner (`../../aturan/01-karyawan.md` bagian 5b butir 5). Celah itu sudah
ditutup pada 11 Oktober 2026 (migrasi 103 di sistem lama).

## Untuk v3

Sudah menjadi aturan wajib: WAJ-06 bagian "Mesin pengaman hak akses".

Cara kerjanya (**disetujui pemilik, 11 Oktober 2026**; jawaban pemilik: "1. saya
setuju", dibaca Claude sebagai setuju atas seluruh usulan). Dirancang rinci di
Tahap 3 bersama daftar hak akses per jabatan (KAR-58):

1. Satu daftar hak akses per jabatan menjadi kunci jawaban: jabatan apa boleh
   melihat, menambah, mengubah, dan membatalkan apa.
2. Mesin pengaman masuk sebagai akun contoh tiap jabatan, lalu **mencoba semua
   tindakan di semua data**, termasuk yang tidak ada tombolnya di layar. Yang
   menurut daftar tidak boleh, harus ditolak. Kalau ada satu saja yang lolos,
   mesin berhenti dan perubahan tidak bisa digabung.
3. Mesin jalan otomatis pada setiap perubahan kode dan setiap migrasi, bukan
   hanya saat diingat.
4. Tabel atau tindakan baru yang belum punya baris di daftar hak akses dianggap
   gagal. Jadi tidak ada data baru yang lahir tanpa aturan akses.
5. Percobaan khusus yang selalu ada: menaikkan hak sendiri, melihat gaji orang
   lain, mengubah data yang sudah disetujui, dan memakai sistem tanpa login.

## Untuk sistem lama

Pemindaian struktur pertama dilakukan 11 Oktober 2026. Ini **calon temuan, belum
diperiksa satu per satu**; sebagian mungkin memang sengaja dibuka.

| Kelompok | Jumlah | Contoh | Risiko kalau benar |
|---|---|---|---|
| Tabel tanpa pengaman baris | 0 | | |
| Data yang bisa dibaca siapa saja, termasuk tanpa login | 11 tabel | `salary_defaults` (gaji standar), `logistics_stores`, `branch_sales_targets`, `fin_vehicle_rental_rates` | Orang luar yang tahu alamat sistem bisa membaca data itu |
| Data yang bisa dibaca semua akun yang login | 4 tabel | `loss_monthly_inputs`, `cashier_loss_configs` | Karyawan membaca data yang bukan urusannya |
| Aturan ubah data milik sendiri yang tidak membatasi kolom | 3 aturan untuk diperiksa | `logistics_plan_stores_update`, `supplier_tasks_update`, `attendances_mobile_checkin_update` | Driver atau karyawan mengubah kolom yang seharusnya diisi kantor |
| Fungsi berhak tinggi yang bisa dipanggil tanpa login dan tidak memeriksa peran | 20 fungsi | `fin_generate_vehicle_rental_costs`, `fin_recompute_helper_weekly_wage`, `verify_cash_payment` | Sebagian menulis ke data keuangan |

**Keputusan pemilik (11 Oktober 2026): sistem lama dibiarkan dulu.** Calon
temuan di atas tidak diperiksa dan tidak ditutup sekarang; fokus pada membangun
v3. Kesalahan sistem lama dipakai sebagai pelajaran untuk pondasi v3.

## Pelajaran dari sistem lama yang menjadi pondasi v3

Tiap kelompok temuan di atas menjadi satu percobaan tetap di mesin pengaman:

| Kesalahan di sistem lama | Pondasi di v3 |
|---|---|
| Akun bisa mengubah perannya sendiri | Hak akses tidak disimpan di data yang bisa diubah pemiliknya. Percobaan "menaikkan hak sendiri" selalu ada |
| Data bisa dibaca tanpa login | Bawaan semua data adalah tertutup. Tidak ada data yang bisa dibaca tanpa login, kecuali yang tertulis di daftar hak akses |
| Data bisa dibaca semua akun | Tiap data punya baris di daftar hak akses per jabatan; yang tidak punya baris dianggap gagal |
| Aturan "milik sendiri" tidak membatasi kolom | Izin mengubah ditulis per tindakan (misalnya "lapor kunjungan"), bukan "boleh mengubah baris ini" |
| Fungsi berhak tinggi tanpa pemeriksaan peran | Tiap tindakan di server memeriksa hak akses lebih dulu, di satu tempat yang sama (WAJ-04) |
| Modul lain melihat seluruh data karyawan | Modul lain hanya melihat nama dan jabatan (PRI-24) |

## Mesin pengaman kedua: memastikan tidak ada error

Pertanyaan pemilik (11 Oktober 2026): "apakah ada mesin pengaman untuk memastikan
tidak ada error? Misalnya jika melakukan apa akan terjadi apa."

**Disetujui pemilik, 11 Oktober 2026.** Menjadi bagian WAJ-06. Dirinci di Tahap 3:

1. **Tes aturan.** Tiap aturan di buku aturan ditulis sebagai soal beserta kunci
   jawabannya: "kalau melakukan ini, harus terjadi itu". Sudah wajib untuk uang,
   waktu, dan hak akses (WAJ-06); usulannya diperluas ke semua aturan bernomor.
2. **Tes skenario.** Mesin menjalankan satu rangkaian kerja dari awal sampai
   akhir seperti orang sungguhan, lalu memeriksa hasil akhirnya.
3. **Tes jalan keluar.** Tiap kejadian di bagian "Kejadian di lapangan" (salah
   isi, batal, ulang) dicoba mesin (WAJ-11).
4. Ketiganya jalan otomatis setiap ada perubahan; kalau satu gagal, perubahan
   tidak bisa dipasang.
5. **Catatan error saat dipakai.** Error yang tetap terjadi di lapangan tercatat
   otomatis dan terlihat pemilik.
