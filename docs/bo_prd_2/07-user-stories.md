# 7. USER STORIES & ACCEPTANCE CRITERIA

## Epic: Product Management

### US-201: Create Product with Multi-UOM
```
As a Manager Backoffice,
I want to create product dengan multiple UOM dan pricing,
So that kasir bisa jual dalam kemasan besar atau kecil.

Acceptance Criteria:
✅ Input basic info (SKU, nama, kategori, brand)
✅ Define UOM base & UOM besar dengan conversion ratio
✅ Set harga per UOM (6 tier), harga tidak harus proporsional
✅ Upload foto produk (min 1, max 6)
✅ Assign multiple supplier
✅ Save → product created, visible di POS
✅ Audit log recorded
```

### US-202: Bulk Update Harga
```
As an Owner,
I want to update harga 100 produk sekaligus,
So that saya tidak perlu edit satu-satu.

Acceptance Criteria:
✅ Filter produk by kategori/brand
✅ Select multiple products
✅ Apply bulk action (increase/decrease by % or amount)
✅ Preview changes sebelum apply
✅ Confirm → all prices updated
✅ Audit log recorded
```

### US-203: Copy Harga Antar Cabang
```
As an Owner,
I want to copy harga dari Cabang A ke Cabang B,
So that setup cabang baru lebih cepat.

Acceptance Criteria:
✅ Select source & target branch
✅ Optional adjustment (+5% untuk cabang premium)
✅ Preview: "500 produk akan di-copy dengan harga +5%"
✅ Confirm → prices copied
✅ Audit log recorded
```

### US-204: Import Harga via Excel
```
As an Owner,
I want to import perubahan harga via Excel,
So that saya bisa update banyak harga sekaligus dari spreadsheet.

Acceptance Criteria:
✅ Download template Excel
✅ Upload file yang sudah diisi
✅ Sistem validasi format & data
✅ Preview changes (highlight yang berubah)
✅ Error report jika ada data invalid
✅ Confirm → harga updated
✅ Audit log recorded
```

### US-205: Scheduled Price Change
```
As an Owner,
I want to schedule perubahan harga untuk tanggal tertentu,
So that harga baru otomatis berlaku tanpa saya harus online.

Acceptance Criteria:
✅ Set effective date untuk harga baru
✅ Status: SCHEDULED sampai tanggal tiba
✅ Sistem auto-apply harga baru saat tanggal tiba
✅ Notifikasi ke Manager saat harga berubah
✅ Audit log recorded
```

### US-206: Category Tree Management
```
As a Manager Backoffice,
I want to manage kategori produk dengan 3-level hierarchy,
So that produk terorganisir dengan baik.

Acceptance Criteria:
✅ Create kategori Level 1, 2, 3
✅ View tree structure (parent-child)
✅ Edit nama & parent kategori
✅ Delete kategori (dengan validasi: tidak ada produk/child)
✅ Drag-and-drop sort order (nice to have)
```

### US-207: Auto-Tag Products
```
As a Manager Backoffice,
I want to sistem otomatis tag produk berdasarkan rules,
So that saya bisa filter produk dengan mudah.

Acceptance Criteria:
✅ "Best Seller" auto-assigned jika sold > 100/bulan
✅ "New Arrival" auto-assigned jika created < 30 hari
✅ "Low Stock" auto-assigned jika stock < minimum
✅ "Near Expired" auto-assigned jika expired < 30 hari
✅ Tags visible di product list
✅ Bisa filter produk by tag
```
