### Fixed
- **HPP batch baru dari retur penjualan tidak lagi kegedean.** `ReturService.processRetur` sebelumnya mengirim total HPP baris transaksi asli (`item.cogs`) sebagai *cost per unit* ke `StockService.addStock`, tanpa dibagi dulu dengan qty asli baris tersebut.
  - Dampaknya: setiap retur pada baris dengan qty > 1 — dan lebih parah lagi pada retur parsial — membuat batch stok baru dengan `costPrice` yang jauh lebih tinggi dari seharusnya, ikut mencemari FIFO untuk penjualan berikutnya.
  - Sekarang cost per unit dihitung dari `item.cogs ÷ item.qty` (qty asli baris, bukan qty yang diretur), sama seperti pola yang sudah dipakai di `void-service.ts` dan `transaction-edit-service.ts`.
