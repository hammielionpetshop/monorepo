# 01 — Susunan Web

## 1. Tujuan

Empat web terpisah dengan satu akun, supaya pekerjaan tiap bagian tidak tercampur ✅
(owner 2026-11-08: "tujuannya agar tidak tercampur2").

```
              ┌─────────────────────────────┐
              │  Halaman Awal (login sekali) │
              └──────────────┬──────────────┘
      ┌──────────────┬───────┴──────┬──────────────┐
      ▼              ▼              ▼              ▼
     POS          Finance       Logistik     HRIS Karyawan
```

| Web | Isi | Peran |
|---|---|---|
| **POS** | Back Office + layar kasir (yang ada sekarang) | Mencatat jualan, stok, PO, setoran, bayar supplier, Arus Kas |
| **Finance** | Baru | **Analisa** — hanya membaca ✅ |
| **Logistik** | Layar Logistik yang sekarang ada di HRIS | Mencatat trip, uang toko, bensin, sewa mobil |
| **HRIS Karyawan** | HRIS tanpa Logistik | Absen, gaji, kasbon, bongkaran, dana, minus kas |

## 2. Halaman Awal & hak per web

- Setiap orang hanya melihat web yang menjadi haknya ✅.
- 💡→✅ **Punya hak satu web**: langsung masuk ke web itu tanpa halaman pilihan. **Dua web atau
  lebih**: tampil halaman pilihan berisi kotak web yang boleh dibuka.
- 💡→✅ Setiap web punya tombol **"Pindah web"** di pojok atas, tanpa login ulang, isinya hanya web
  yang menjadi hak orang itu.
- Hak per web memakai **tautan akun per app** di auth terpusat (`auth.account_links`, Fase 1 L1);
  app baru `finance` dan `logistik` didaftarkan di sana, diatur Owner/GM di Akun & Tautan HRIS.

## 3. Driver & kenek ✅

- **Trip Saya** pindah ke web **Logistik**; absen, slip, dan kasbon tetap di **HRIS**.
- Absen lewat trip tetap otomatis: HRIS membaca data trip dari Logistik seperti sekarang.
- **Gaji driver** (ritase, slip mingguan, denda) dan **Tarif Ritase** tetap di **HRIS** ✅;
  Logistik hanya mencatat trip.
- 💡 Beranda HRIS driver memberi kotak pintas "Trip Saya hari ini" ke web Logistik.

Catatan teknis (2026-11-08): modul `apps/hris/modules/logistics` tidak memanggil langsung modul
gaji/absen/kasbon; sambungan yang perlu dirapikan saat pemisahan: halaman absen lewat trip,
tanda menu Trip Saya, dan angka perhatian di beranda HRIS.

## 4. POS / Back Office tidak berubah ✅

"Hanya beberapa orang yang bisa masuk ke backoffice; jika tidak diizinkan masuk back office, maka
otomatis ke pos — biarkan seperti apa adanya hari ini." Di Halaman Awal keduanya tampil sebagai
satu kotak **POS**.

## 5. Urutan pembangunan ✅

1. **Finance dibangun lebih dulu sebagai web/modul sendiri sejak hari pertama** — bukan tab di
   HRIS — supaya kelak "tinggal dipindahkan" ke Halaman Awal.
2. Halaman Awal + Pindah web dan pemisahan Logistik dari HRIS dikerjakan **belakangan**.
3. Selama Halaman Awal belum ada, Logistik tetap di HRIS. Finance membaca data Logistik langsung
   dari schema `logistics` (lewat pintu baca yang terdaftar), **bukan** lewat HRIS, supaya
   pemisahan Logistik nanti tidak mengubah Finance.

**Modul tanpa layar dulu** — owner 2026-11-08: "kita buat saja modulnya, tapi tidak usah
ditampilkan di hris, sampai ada webnya, jika web sudah ada baru disambungkan".
- ✅ Rumus & pembacaan data Finance dibuat sebagai modul tersendiri (bertes), tidak di HRIS, tidak
  di menu mana pun.
- 💡 Ditambah **web Finance sederhana khusus staging** (hanya Owner/GM, tanpa domain produksi)
  supaya owner bisa menguji angka; tidak masuk produksi sampai web resmi siap. ❓ belum diputuskan.

## 6. Alamat web

**Diputuskan dev asli** ✅ — PRD tidak menetapkan domain/subdomain.

## 7. Kriteria selesai (bagian Belakangan)

- Kasir dan Back Office masuk persis seperti sekarang.
- Orang dengan satu hak langsung masuk; dengan beberapa hak melihat pilihan yang benar.
- Driver bisa absen, melihat trip, dan melihat slip tanpa login ulang.
- Tidak ada layar Logistik tersisa di HRIS selain yang memang milik gaji (Tarif Ritase, slip driver).

## 8. Pertanyaan terbuka

- ❓ Web Finance khusus staging untuk uji (§5).
- 🗣️ Siapa saja yang mendapat hak web Finance dan Logistik (dibahas saat F2-6 / pemisahan).
