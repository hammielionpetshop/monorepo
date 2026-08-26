### Fixed
- **Buat PO gagal dengan pesan "Invalid input: expected string, received null" saat kolom catatan dikosongkan.** Form mengirim `notes: null`, tapi skema validasi hanya menerima `undefined`. Skema `POST /api/bo/purchase-orders` kini menerima `null` juga.
