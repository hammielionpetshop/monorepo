### Fixed

- HPP Estimasi di form "Buat PO Internal" (kasir) selalu tampil 0 — field `defaultCostPrice` yang dipakai untuk mengisinya tidak pernah dikirim oleh API pencarian produk POS. Sekarang dihitung dari modal (`productUomCosts`) milik cabang peminta sendiri, sesuai data yang sudah tersedia dari API yang sama.
- Prefill Bulk Sale dari Internal PO memakai harga tier pertama yang kebetulan terbaca dari database, bukan tier harga yang sudah ditetapkan untuk toko cabang tujuan (mis. GROSIR) — kadang jatuh ke RETAIL padahal tokonya sudah punya tier sendiri. Sekarang mengambil tier sesuai `defaultTierType` customer cabang tujuan, dengan fallback ke harga pertama bila tier itu belum tersedia untuk satuan terkait.
