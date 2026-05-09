import Big from 'big.js';
import { getDb } from '@/lib/db';
import type { CartItem } from '@petshop/shared';
import { apiClient } from '@/lib/api-client';
import { useShiftStore } from '@/store/shift-store';
import { useAuthStore } from '@/store/auth-store';

export const localStockService = {
  /**
   * Kurangi stok Dexie lokal secara atomik setelah transaksi berhasil.
   * Menggunakan rasio konversi UOM agar pengurangan selalu dalam Base UOM.
   * Non-blocking untuk produk yang tidak ditemukan di cache lokal.
   */
  async deductStock(items: CartItem[]): Promise<void> {
    const db = await getDb();

    await db.transaction('rw', [db.products, db.productUoms], async () => {
      for (const item of items) {
        const product = await db.products.get(item.productId);
        if (!product) continue;

        let ratio = new Big(1);
        if (item.uomId !== product.baseUomId) {
          const conv = await db.productUoms
            .where('productId').equals(item.productId)
            .filter((c: any) => c.uomId === item.uomId)
            .first();
          if (conv?.ratio) ratio = new Big(conv.ratio);
        }

        const qtyInBase = new Big(item.qty).times(ratio);
        const currentStock = new Big(product.stock ?? '0');
        const newStock = currentStock.minus(qtyInBase).toString();

        await db.products.update(item.productId, { stock: newStock });
      }
    });
  },

  /**
   * Rekonsiliasi stok Dexie dengan snapshot terbaru dari server.
   * Dipanggil setelah sync berhasil atau saat koneksi kembali.
   * Kegagalan tidak memblokir operasi lain.
   */
  async reconcileStock(): Promise<void> {
    const branchId =
      useShiftStore.getState().activeShift?.branchId ??
      useAuthStore.getState().user?.branchId;

    if (!branchId) return;

    const snapshot: { id: number; stock: string }[] = await apiClient(
      `/pos/stock-snapshot?branchId=${branchId}`
    );

    const db = await getDb();
    await db.transaction('rw', db.products, async () => {
      for (const s of snapshot) {
        await db.products.update(s.id, { stock: s.stock });
      }
    });
  },
};
