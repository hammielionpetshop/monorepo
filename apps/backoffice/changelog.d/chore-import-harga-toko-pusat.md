### Changed

- Harga jual dan modal Toko Pusat diperbarui dari `HARGA_TOKO_PUSAT.xlsx` (166 modal + 325 harga di 1.065 produk). Harga lama yang tidak disebut di Excel dibiarkan apa adanya.

### Added

- Skrip `apps/db-compare/import-harga-toko-pusat-20260814.mjs` — impor harga & modal per cabang dari Excel dengan mode dry-run bawaan, laporan CSV per baris (lama vs baru), dan penulisan dalam satu transaksi.
