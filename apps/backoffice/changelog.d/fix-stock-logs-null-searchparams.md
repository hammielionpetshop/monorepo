### Fixed
- **Halaman Mutasi Stok tidak lagi berpotensi crash saat `useSearchParams()` bernilai null.** Pembacaan parameter URL (`q`, `branchId`, `from`, `to`) diberi guard `?.` supaya aman pada jalur render tanpa router context — sekaligus memperbaiki test `stock-logs-client` yang sebelumnya gagal.
