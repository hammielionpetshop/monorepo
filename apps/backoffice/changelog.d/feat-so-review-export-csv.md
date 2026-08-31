### Added
- **Export CSV item Stock Opname.** Di halaman Inventory → Stock Opname (Persetujuan) tiap baris SO punya tombol "Export CSV" di kolom Aksi, dan tombol yang sama ada di header modal Review — tarik seluruh item ke satu berkas tanpa harus buka modal.
  - **SO Besar: seluruh cakupan produk ikut diekspor**, termasuk yang belum dihitung (qty fisik & selisih kosong, kolom "status hitung" = "Belum dihitung"). Tombol SO Besar selalu aktif walau belum ada satu pun item dihitung.
  - Kolom: produk, sku, satuan, status hitung, qty sistem, qty fisik, selisih, nilai selisih, alasan selisih, status item, qty hitung ulang, selisih hitung ulang, catatan keputusan.
  - Berkas diawali BOM UTF-8 supaya Excel Windows tidak menampilkan nama produk beraksen sebagai mojibake; sel string yang berpotensi formula injection dinetralkan, angka ditulis polos.
  - Endpoint `GET /api/bo/stock-opnames/[id]/export` (izin `stock_opname.read`, non-privileged dibatasi cabang sendiri). Logika daftar cakupan SO Besar dipindah ke `lib/services/stock-opname-candidates.ts` dan dipakai bersama endpoint `/candidates`.
