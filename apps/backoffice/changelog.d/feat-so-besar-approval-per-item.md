### Added
- **SO Besar kini disetujui per item, bukan satu SO sekaligus.** Produk yang fisiknya pas otomatis dianggap selesai tanpa perlu ditinjau; produk yang selisih ditahan menunggu keputusan admin, dan bisa dihitung ulang dulu di POS sebelum diputuskan — supaya selisih yang cuma salah hitung tidak sampai mengubah stok.
  - Halaman **Stock Opname — Persetujuan**: tiap item selisih punya tombol Setujui/Tolak sendiri (tolak wajib alasan). SO ditutup otomatis begitu semua item selesai diputuskan.
  - POS: tombol **Hitung Ulang Selisih** muncul di layar SO Besar kalau masih ada produk yang perlu dicek ulang — hitungannya tetap disembunyikan dari stok sistem, sama seperti hitungan pertama.
  - Berlaku khusus SO Besar; SO Harian tidak berubah, tetap disetujui satu SO sekaligus.

### Fixed
- **Petugas sekarang memilih dulu SO Besar mana yang mau dikerjakan kalau ada lebih dari satu aktif di cabangnya.** Sebelumnya POS diam-diam selalu memakai SO Besar pertama yang ditemukan, jadi hitungan bisa nyasar ke SO yang salah kalau admin membuat beberapa SO Besar sekaligus (mis. per kategori/petugas).
  - `GET /api/pos/stock-opnames/active-full` sekarang juga menyembunyikan SO yang ditugaskan (`assignedUserIds`) ke petugas lain — OWNER/GM/MANAGER tetap melihat semuanya.
