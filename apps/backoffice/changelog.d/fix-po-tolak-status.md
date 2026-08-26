### Fixed

- Tolak Purchase Order kini benar-benar mengubah status PO menjadi "Ditolak" (`REJECTED`).
  Sebelumnya endpoint `PATCH /api/bo/purchase-orders/[id]/reject` menyetel status balik ke
  `PENDING_APPROVAL`, sehingga PO yang ditolak tetap nyangkut di "Menunggu Approval" dan
  tombol Setujui/Tolak muncul lagi seolah aksi tolak tidak terjadi.
- Reject PO sekarang menolak permintaan (404) bila PO sudah tidak lagi berstatus
  "Menunggu Approval" (mis. sudah disetujui atau ditolak lebih dulu), mencegah reject ganda.
