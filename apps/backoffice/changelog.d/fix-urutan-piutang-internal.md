### Fixed

- **Urutan tabel Hutang Piutang Internal kini konsisten dan diurutkan di server.** Sebelumnya server mengambil data urut `created_at` terbaru dulu, lalu client diam-diam mengurut ulang seluruh daftar berdasarkan No. IBT menaik — jadi piutang terbaru selalu jatuh di baris paling bawah dan urutan di kode saling bertentangan. Sekarang server (halaman & API) mengurutkan `No. IBT` terbaru dulu dengan `id` sebagai tie-breaker, dan client memakai urutan itu apa adanya.
