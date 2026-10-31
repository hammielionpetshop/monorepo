# Plan HRIS — Pematenan Tampilan (Poles UI tahap 1)

Tanggal: 2026-11-01 · Status: **disetujui owner 2026-11-01; implementasi berjalan.**
Permintaan owner 2026-11-01: patenkan UI HRIS selagi modul masih sedikit — toggle tema, isi lebar penuh,
menu berkelompok yang bisa dilipat, halaman Hak Akses Jabatan lebih ringkas. Poles lain menyusul.
Lanjutan L2a ([plan L2](2026-11-01-hris-l2.md)); dasar kode `origin/dev_hris`, tanpa migrasi,
tanpa dependensi baru, tanpa perubahan API.

## Kondisi sekarang (dari kode)

| Bagian | File | Kondisi |
|---|---|---|
| Token warna | `apps/hris/app/globals.css` | `@theme` Tailwind v4, hanya terang; nilai warna tidak tertulis mentah di komponen (bagus untuk tema gelap) |
| Kerangka | `apps/hris/components/app-shell.tsx` | sidebar 14rem + header; isi `max-w-5xl` di tengah |
| Menu | `apps/hris/lib/nav.ts`, `components/nav-links.tsx` | daftar datar 6 item; bilah bawah HP memuat semua item (sudah sesak) |
| Hak Akses | `modules/access/ui/grants-screen.tsx` | pilih jabatan lewat dropdown di kartu, lalu satu kartu per kelompok, satu baris + dropdown 48 per tindakan; tindakan khusus Pemilik tetap memakan baris |

## Pembagian pekerjaan

Dua branch, bisa paralel karena path tidak bersinggungan:

| Branch | Task | Path utama |
|---|---|---|
| `feat/hris-ui-shell` | T1 tema, T2 lebar penuh, T3 menu berkelompok | `apps/hris/app/{globals.css,layout.tsx}`, `apps/hris/components/**`, `apps/hris/lib/nav.ts` (+ tes) |
| `feat/hris-access-compact` | T4 Hak Akses ringkas | `apps/hris/modules/access/ui/**`, `apps/hris/app/(app)/pengaturan/hak-akses/**` |

T1–T3 satu branch karena menyentuh file kerangka yang sama (`app-shell.tsx`, `nav-links.tsx`);
dikerjakan berurutan, satu commit per task. Klaim path kedua branch dipublikasikan dulu lewat
`docs/claim-hris-ui-polish` (merge lokal ke `staging`, push) sebelum implementasi. Integrasi:
merge lokal ke `dev_hris`, lalu ke `staging` dalam satu batch untuk uji owner.

---

## T1 — Toggle tema (Terang / Gelap / Ikuti perangkat)

**Hasil:** tombol tema di header; pilihan tersimpan per perangkat; tanpa kedip warna saat halaman dibuka.

Langkah:
1. `globals.css`: tambah blok `[data-theme="dark"] { --color-…: … }` yang menimpa token yang sama
   (surface, canvas, line, ink, ink-muted, brand-50/100/700, ok/warn/danger/info bg+fg). Tambahkan
   `color-scheme: light` / `dark` supaya kontrol bawaan (select, tanggal, scrollbar) ikut.
   Tambah `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));` untuk kasus langka
   yang butuh kelas `dark:`.
2. `app/layout.tsx`: skrip inline kecil di `<head>` yang membaca `localStorage['hris-theme']`
   (`light|dark|system`) dan memasang `data-theme` di `<html>` sebelum render; `<html suppressHydrationWarning>`.
   `system` mengikuti `prefers-color-scheme` dan ikut berubah bila setelan perangkat berubah.
   `viewport.themeColor` dua nilai (terang/gelap).
3. `components/theme-toggle.tsx` (`'use client'`): tombol ikon putar Terang → Gelap → Perangkat,
   `aria-label` menyebut tema aktif, target sentuh ≥ 44px. Ditaruh di header (HP dan desktop),
   sebelah tombol Keluar. Halaman login juga memakai tema yang sama (skripnya di root layout).
4. Periksa warna yang bukan token: toast `text-white` di atas `bg-ink` (di gelap `ink` jadi terang →
   pakai token `--color-inverse` / `--color-on-inverse`), backdrop dialog `bg-black/40` (aman).
5. Halaman `/komponen` dipakai sebagai lembar periksa kontras kedua tema.

Keputusan bawaan: tidak memakai `next-themes` (backoffice memakainya, tetapi skrip ±15 baris cukup dan
aturan melarang dependensi tanpa kebutuhan). Pilihan tema per perangkat, bukan per akun.

Selesai bila: semua halaman HRIS terbaca di kedua tema (kontras teks normal ≥ 4.5:1 untuk pasangan token
utama), tidak ada kedip putih saat muat ulang di mode gelap.

## T2 — Isi selebar layar

**Hasil:** area isi memakai lebar penuh di layar lebar.

Langkah:
1. `app-shell.tsx`: `<main>` hapus `mx-auto max-w-5xl`; padding tetap `p-4 sm:p-6`.
2. Tinjau halaman yang ada: Daftar Karyawan, Halaman orang, Cabang & Jabatan, Hak Akses, Profil,
   Beranda, Komponen. Tabel/daftar ikut melebar; kisi kartu memakai kolom responsif
   (`lg:grid-cols-2`/`xl:grid-cols-3`) bila jadi terlalu renggang.
3. Formulir isian tetap dibatasi lebar baca (mis. `Card max-w-xl` di Tambah Karyawan) supaya kolom
   isian tidak memanjang 1.500px — pembatas ada di formulirnya, bukan di kerangka.

Selesai bila: tak ada `max-w-*` di kerangka; tiap halaman di atas tetap rapi di 1366px dan 1920px.

## T3 — Menu berkelompok yang bisa dilipat

**Hasil:** menu samping dikelompokkan dengan judul kelompok yang bisa dilipat; menu HP tetap ringkas.

Kelompok awal (bisa diubah owner):

| Kelompok | Item |
|---|---|
| — (tanpa judul) | Beranda |
| Saya | Profil saya |
| Karyawan | Karyawan |
| Pengaturan | Cabang & Jabatan, Hak Akses Jabatan |
| Pengembang | Komponen |

Langkah:
1. `lib/nav.ts`: bentuk data jadi `NavGroup { id, label?, items: NavItem[] }`; `NAV_GROUPS` menggantikan
   `NAV_ITEMS`. `visibleNav` menyaring item per hak lalu membuang kelompok kosong (tetap gagal tertutup).
   Tambah tes unit kecil `lib/nav.test.ts`: kelompok kosong hilang, item tanpa `action` tetap tampil,
   tanpa pemeriksa hak hanya item tanpa `action`. Pemeriksaan server per halaman tidak berubah.
2. `nav-links.tsx` `SideNav`: judul kelompok berupa tombol (`aria-expanded`, `aria-controls`) dengan
   panah; kelompok berisi halaman aktif selalu terbuka; status lipat disimpan di
   `localStorage['hris-nav-collapsed']`. Kelompok tanpa judul tidak bisa dilipat.
3. HP (`BottomNav`): bilah bawah hanya memuat maksimal 4 pintasan (Beranda, Profil saya, Karyawan bila
   berhak) + tombol **Menu** yang membuka laci (memakai `Dialog` yang ada) berisi menu berkelompok
   lengkap. Pintasan ditandai `mobile: true` di data menu.
4. Sidebar bisa digulir sendiri (`sticky top-0 h-screen overflow-y-auto`) supaya menu panjang tidak ikut
   tergulir dengan isi.

Di luar cakupan: melipat seluruh sidebar jadi rel ikon (bisa menyusul bila diminta).

Selesai bila: jabatan dengan hak terbatas tidak melihat kelompok kosong; status lipat bertahan setelah
pindah halaman/muat ulang; di HP semua menu tetap terjangkau lewat **Menu**.

## T4 — Hak Akses Jabatan lebih ringkas

**Hasil:** satu layar yang memuat lebih banyak tindakan tanpa banyak gulir; alur simpan (periksa,
tahan 3 detik, simpan) tidak berubah; API `/api/access/grants` tidak berubah.

Langkah:
1. Tata letak dua panel di layar lebar (`lg:grid-cols-[16rem_1fr]`): kiri daftar jabatan (nama, jumlah
   pemegang, lencana "mengikuti Pemilik"/"nonaktif", jabatan terpilih disorot; tetap memakai
   `?jabatan=`). Di HP panel kiri kembali jadi dropdown di atas.
2. Panel kanan berupa tabel matriks: baris = tindakan, kolom = Tidak ada · Diri sendiri · Cabang ·
   Departemen · Semua, isinya radio (satu nilai per baris). Lingkup yang tidak diizinkan untuk tindakan
   itu (`selfOnly`) tampil sebagai sel kosong tak bisa dipilih. Baris setinggi ±36px, judul kelompok
   jadi baris pemisah tabel yang menempel (`sticky`), bukan kartu terpisah.
   Di HP (< md) baris tetap memakai dropdown seperti sekarang supaya tidak menggulir ke samping.
3. Tindakan khusus Pemilik/GM (`ownerOnly`) tidak lagi memakan baris: diringkas jadi satu catatan per
   kelompok, "N tindakan hanya untuk Pemilik dan GM" yang bisa dibuka untuk melihat namanya.
4. Bilah atas panel kanan: kotak cari tindakan + saring "Hanya yang diberi" + ringkasan
   "12 dari 26 tindakan diberi".
5. Baris berubah tetap disorot; tombol Batalkan/Periksa tetap menempel di bawah. Dialog periksa dan
   hitung mundur tidak diubah.
6. Pecah `grants-screen.tsx` bila lewat ±250 baris: `position-list.tsx`, `grants-table.tsx`.

Selesai bila: memilih jabatan, mengubah beberapa lingkup, periksa, simpan tetap berjalan; jabatan
"mengikuti Pemilik" dan jabatan sendiri tetap terkunci; semua tindakan satu jabatan muat dalam ±1,5 layar
desktop 1366×768.

---

## Verifikasi

- `pnpm typecheck` dari root sekali pada kandidat akhir; `pnpm --filter hris lint`; tes unit
  `lib/nav.test.ts` (T3). Tanpa tes UI otomatis (AGENTS.md).
- Tanpa migrasi. Fragmen changelog per branch di `apps/backoffice/changelog.d/` (pola poles HRIS sebelumnya).
- Uji owner di staging (HP + desktop), skenario singkat:
  1. Ganti tema 3 kali, muat ulang di mode gelap → tidak ada kedip putih; login juga gelap.
  2. Buka semua halaman di layar lebar → isi melebar, formulir tetap rapi.
  3. Lipat kelompok Pengaturan, pindah halaman → tetap terlipat; buka Hak Akses → kelompoknya terbuka.
  4. Di HP: bilah bawah ringkas, tombol Menu membuka seluruh menu.
  5. Hak Akses: pilih jabatan dari daftar kiri, ubah 2–3 lingkup, Periksa → Simpan.
  6. Login sebagai jabatan non-penuh → kelompok tanpa item tidak tampil.

## Keputusan terbuka (bawaan dipakai bila owner tidak mengubah)

1. Pilihan tema bawaan untuk pengguna baru: **Ikuti perangkat**.
2. Nama dan isi kelompok menu seperti tabel T3; menu **Komponen** masuk kelompok Pengembang (atau
   disembunyikan dari pengguna non-Pemilik).
3. Formulir tetap dibatasi lebar baca walau isi halaman selebar layar.
4. Matriks radio untuk desktop, dropdown untuk HP.
