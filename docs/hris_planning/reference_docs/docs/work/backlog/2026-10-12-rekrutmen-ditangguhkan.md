# Rekrutmen (ditangguhkan)

Tanggal: 12 Oktober 2026

## Masalah

Rekrutmen adalah bagian dari Bab 7 (Kinerja dan Rekrutmen). Sistem lama punya
modulnya: halaman lamaran untuk umum, penyaringan, psikotes, konfirmasi
interview, dan daftar pelamar (kira-kira 3.000 baris kode, 499 pelamar
tercatat). Bagian ini **belum digali**.

## Yang diinginkan

Keputusan pemilik (12 Oktober 2026): **rekrutmen dibangun nanti saja**.
Penggalian dan penetapan aturannya ditangguhkan; v3 tahap awal tidak memuat
rekrutmen.

Alur yang diinginkan pemilik, dicatat apa adanya sebagai pegangan saat kelak
dibahas:

1. QR lowongan disebar.
2. Masa terima dibuat: waktu mulai dan waktu akhir.
3. Pelamar mengisi data diri.
4. Pelamar menjawab semua pertanyaan yang ada.
5. Pelamar mengerjakan tes.
6. Wawancara, sampai diterima.

## Yang ikut tertunda

- Isi otomatis data karyawan dari data pelamar (dulu KAR-11; butir terbuka
  nomor 6 buku Karyawan). Sampai rekrutmen dibangun, karyawan baru masuk
  lewat pendaftaran sendiri yang disetujui HR (KAR-60).

## Yang perlu diputuskan saat rencana tayang (Tahap 1)

Sistem lama masih menerima lamaran. Kalau v3 menggantikan sistem lama sebelum
rekrutmen dibangun, harus diputuskan: halaman lamaran sistem lama tetap
dijalankan sementara, atau penerimaan lamaran kembali manual.

**Diputuskan 13 Oktober 2026 (SIS-22):** sistem lama tetap hidup hanya untuk
menerima lamaran, menu lain ditutup; Rekrutmen menjadi fitur tambahan pertama
setelah v3 jadi, sesudah itu sistem lama dimatikan.

## Sumber di sistem lama (untuk penggalian kelak)

`rekrutmen/page.tsx`, `rekrutmen/pelamar/page.tsx`,
`rekrutmen/interview-konfirmasi/page.tsx`, `app/lamaran/` dan
`app/api/lamaran/`, `components/recruitment/`,
`lib/server/recruitmentTransitions.ts`; tabel `job_applicants`, `screening_*`,
`psycho*`. Hanya dibaca (WAJ-09).
