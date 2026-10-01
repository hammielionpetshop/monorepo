### Added

- **Modal di Manajemen Harga kini diperbarui otomatis dari barang masuk** — tidak perlu lagi diketik ulang setiap harga beli berubah. Pemicunya:
  - approve penerimaan PO (harga faktur, atau harga PO bila faktur kosong);
  - koreksi faktur PO, khusus barang yang sudah masuk stok — faktur PO lama tidak menimpa modal dari penerimaan yang lebih baru;
  - terima transfer internal (IBT) di cabang tujuan, khusus IBT yang diproses lewat Bulk Sale (harga jual Gudang per satuan item). IBT yang dikirim manual dilewati karena harganya masih estimasi modal per satuan dasar cabang peminta;
  - Penyesuaian Stok **penambahan** yang kolom modalnya diisi (> 0). Ini jalur Gudang mencatat pembelian supplier; penambahan tanpa modal atau modal 0 (mis. barang bonus) tidak menyentuh Manajemen Harga.
  - Semua satuan produk ikut diisi dari rasio konversi (SAK → KG dibagi, KG → SAK dikali); satuan masuk memakai angka mentahnya (182.500/SAK tetap 182.500).
  - Perubahan di bawah 30% dari modal sebelumnya langsung diterapkan; modal yang masih kosong langsung diisi.
  - **Lompatan 30% atau lebih (naik maupun turun) ditahan** dan menunggu persetujuan OWNER/GM. Barang masuk berikutnya untuk produk & cabang yang sama menggantikan usulan yang belum diputuskan.
  - Pembatalan penerimaan PO tidak lagi diam-diam meninggalkan modal dari PO itu: sistem membuat **usulan pengembalian modal** yang harus disetujui. Usulan dilewati bila modal sudah diperbarui barang masuk lain sesudahnya.
- **Halaman baru "Tinjauan Modal & Margin"** (`/master-data/cost-review`, menu Master Data, OWNER/GM lewat izin `master.price.manage` yang sudah ada — tidak perlu seed permission):
  - Tab **Modal Perlu Ditinjau**: Menunggu (Setujui / Tolak dengan alasan wajib), Otomatis, Disetujui, Ditolak/Digantikan — lengkap dengan sumber (no. PO/IBT/penyesuaian), modal lama → baru per satuan dasar, dan persentase perubahan.
  - Tab **Margin Menipis / Rugi**: setiap harga jual (per cabang, satuan, tier) yang marginnya **1% atau kurang** terhadap modal, termasuk yang rugi. Ambangnya sama untuk semua tier. Baris hilang sendiri begitu harga jualnya dinaikkan di Manajemen Harga. Tombol **Atur Harga** membuka Manajemen Harga langsung ke cabang & produk itu.
  - Badge di sidebar = usulan modal yang menunggu + jumlah harga jual bermargin ≤ 1%.
- **Riwayat harga di Manajemen Harga ikut mencatat perubahan otomatis**: sumbernya tampil sebagai "Otomatis dari barang masuk (PO-…/IBT-…/Penyesuaian stok #…)" atau "Disetujui dari Tinjauan Modal (…)", dengan modal lama → baru dan pelakunya (penerima barang / penyetuju). Log Audit punya aksi baru "Modal diperbarui dari barang masuk" dan "Usulan modal ditolak".
- Manajemen Harga bisa dibuka langsung ke cabang & pencarian tertentu lewat `?branchId=&q=`.
- Migrasi `0027_product_cost_syncs`: tabel jejak sinkron modal sekaligus antrean tinjauannya.
