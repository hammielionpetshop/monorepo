# 11. TESTING REQUIREMENTS

## 11.1 Unit Tests (Wajib)

### Multi-UOM Auto-Break
- ✅ Test jual UOM kecil (stock cukup)
- ✅ Test jual UOM kecil (stock tidak cukup, butuh break)
- ✅ Test jual UOM kecil (total stock tidak cukup)
- ✅ Test jual UOM besar
- ✅ Test jual dengan conversion ratio variabel
- ✅ Test auto-break log created correctly

### FIFO Costing
- ✅ Test single batch
- ✅ Test multi batch (same price)
- ✅ Test multi batch (different price)
- ✅ Test auto-break dari batch terlama
- ✅ Test COGS calculation per batch

### Pricing
- ✅ Test 6 tier pricing
- ✅ Test manual override
- ✅ Test promo apply otomatis
- ✅ Test harga jual non-proporsional

### Discount Engine
- ✅ Test percentage discount
- ✅ Test nominal discount
- ✅ Test BxGy
- ✅ Test bundle pricing
- ✅ Test conflict resolution (non-stackable)
- ✅ Test stackable override

### Settlement
- ✅ Test expected cash calculation per kasir
- ✅ Test variance calculation per kasir
- ✅ Test zero-tolerance logging
- ✅ Test modal share split antar kasir

### Offline Queue
- ✅ Test queue transaction offline
- ✅ Test sync batch saat online
- ✅ Test conflict resolution

## 11.2 Integration Tests

- ✅ End-to-end transaction flow
- ✅ Shift open (multi-kasir) → transaksi → settlement
- ✅ Void request → approve → stock return
- ✅ PO create → approve → receive → approve receiving
- ✅ SO create → submit → approve → stock adjust
- ✅ Offline transaction → online sync

## 11.3 Edge Case Tests

- ✅ Transaksi saat internet putus mid-process
- ✅ 2 kasir jual produk sama bersamaan (race condition)
- ✅ SO plus + minus di hari sama
- ✅ Multi batch FIFO with auto-break mixed
- ✅ Print gagal (printer offline)
- ✅ Barcode tidak ditemukan
- ✅ Customer dengan piutang melewati limit
- ✅ Owner override < 50% dari retail (warning flow)

## 11.4 User Acceptance Tests (UAT)

Scenarios didesain berdasarkan user stories di [12-user-stories.md](./12-user-stories.md).
