### Fixed
- **Petugas sekarang memilih dulu SO Besar mana yang mau dikerjakan kalau ada lebih dari satu aktif di cabangnya.** Sebelumnya POS diam-diam selalu memakai SO Besar pertama yang ditemukan, jadi hitungan bisa nyasar ke SO yang salah kalau admin membuat beberapa SO Besar sekaligus (mis. per kategori/petugas).
  - `GET /api/pos/stock-opnames/active-full` sekarang juga menyembunyikan SO yang ditugaskan (`assignedUserIds`) ke petugas lain — OWNER/GM/MANAGER tetap melihat semuanya.
