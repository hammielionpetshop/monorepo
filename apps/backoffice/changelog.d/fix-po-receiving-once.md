### Fixed

- Approval penerimaan PO mengunci header dan hanya menerima status PARTIALLY_RECEIVED; approval berulang atau bersamaan tidak menggandakan stok maupun hutang supplier.
- Pencatatan penerimaan BO/POS dan reversal memvalidasi status terbaru dalam transaksi dengan lock header yang sama.
- Batch, sinkronisasi modal, payable, audit penerimaan, dan status PO berubah atomik; kegagalan salah satu item membatalkan seluruh approval.
