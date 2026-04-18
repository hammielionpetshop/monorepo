# 13. APPENDIX

## 13.1 Glossary

| Term | Definisi |
|------|----------|
| **UOM** | Unit of Measure (satuan ukur) |
| **UOM Base** | Satuan terkecil (pcs, gram, ml) |
| **UOM Besar** | Satuan kemasan (sak, dus, box) |
| **Conversion Ratio** | Rasio konversi (1 Sak = 30 Pcs) |
| **Auto-Break** | Sistem otomatis pecah UOM besar saat stock kecil kurang |
| **FIFO** | First In First Out - batch terlama keluar dulu |
| **COGS** | Cost of Goods Sold - harga modal barang terjual |
| **SKU** | Stock Keeping Unit - kode unik produk |
| **PO** | Purchase Order - pesanan ke supplier |
| **SO** | Stock Opname - inventarisasi fisik |
| **Settlement** | Tutup kasir & serah terima uang |
| **Shift** | Sesi kerja kasir |
| **Void** | Pembatalan transaksi |
| **Piutang** | Hutang customer ke toko |
| **Shrinkage** | Kerugian dari selisih stock |

## 13.2 References

- Strategi Arsitektur: Pemisahan Backoffice + POS (dokumen terpisah)
- Next.js 15 Documentation: https://nextjs.org/docs
- Electron Documentation: https://www.electronjs.org/docs
- Dexie.js (IndexedDB wrapper): https://dexie.org
- node-thermal-printer: https://github.com/Klemen1337/node-thermal-printer

## 13.3 Open Questions (Perlu Jawaban dari User)

| # | Pertanyaan | Status |
|---|-----------|--------|
| 1 | Mekanisme tukar point loyalty — ditukar apa? | ⚠️ OPEN |
| 2 | Kategori pengeluaran — hybrid pre-defined + manual? (rekomendasi hybrid) | ⚠️ OPEN |
| 3 | Threshold override harga sebelum minta approval (rekomendasi 10%) | ⚠️ OPEN |
| 4 | Limit default piutang untuk customer baru | ⚠️ OPEN |
| 5 | Format export laporan (Excel/PDF format custom?) | ⚠️ OPEN |
| 6 | Integrasi payment gateway (QRIS aggregator mana?) | ⚠️ OPEN |
| 7 | Channel online order (WA/Tokped/Shopee?) | ⚠️ OPEN (future) |

> **Instruksi AI**: Sebelum implement fitur yang terkait dengan open question di atas, TANYAKAN ke user dulu.

## 13.4 Future Enhancements

- Integrasi marketplace (Tokopedia, Shopee)
- WhatsApp order integration
- Mobile app untuk owner/manager monitoring
- AI-powered demand forecasting
- Integration EDC/payment gateway
- E-invoice integration
