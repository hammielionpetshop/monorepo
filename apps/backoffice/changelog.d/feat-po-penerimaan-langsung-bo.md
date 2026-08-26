### Added
- **Penerimaan barang PO kini bisa dicatat langsung dari backoffice oleh OWNER/GM.** Halaman baru
  `/purchase-orders/[id]/receive` menampilkan form qty diterima, qty rusak, dan tanggal
  kedaluwarsa per item, menggantikan kebutuhan mencatat lewat POS untuk PO yang ditangani BO.
  - Endpoint baru `POST /api/bo/purchase-orders/[id]/receive` (permission `po.approve`) memakai
    alur validasi yang sama dengan penerimaan POS (qty rusak tidak boleh melebihi qty diterima,
    qty diterima tidak boleh melebihi sisa item).
  - Tombol "Catat Penerimaan Barang" / "Lanjutkan Penerimaan" muncul di halaman detail PO untuk
    status `APPROVED`, `IN_TRANSIT`, dan `PARTIALLY_RECEIVED`, hanya untuk role OWNER/GM.
