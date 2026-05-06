import { getDb } from '@/lib/db';
import Big from 'big.js';

export const bootstrapService = {
  /**
   * Mengisi database lokal dengan data master dari server secara atomic.
   * Menggunakan transaksi Dexie dan chunking untuk menghindari memory issue.
   */
  async populate(data: any) {
    const db = await getDb();
    const CHUNK_SIZE = 1000;

    const chunkedPut = async (table: any, items: any[]) => {
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        await table.bulkPut(items.slice(i, i + CHUNK_SIZE));
      }
    };

    try {
      await db.transaction('rw', [
        db.products,
        db.categories,
        db.productUoms,
        db.productPrices,
        db.customers,
        db.paymentMethods,
        db.taxSettings
      ], async () => {
        if (data.products) await chunkedPut(db.products, data.products);
        if (data.categories) await chunkedPut(db.categories, data.categories);
        
        if (data.conversions) {
          await chunkedPut(db.productUoms, data.conversions.map((c: any) => ({
            ...c,
            conversionValue: new Big(c.conversionValue || 1).toString()
          })));
        }

        if (data.prices) {
          await chunkedPut(db.productPrices, data.prices.map((p: any) => ({
            ...p,
            price: new Big(p.price || 0).toString()
          })));
        }

        if (data.customers) await chunkedPut(db.customers, data.customers);
        if (data.paymentMethods) await chunkedPut(db.paymentMethods, data.paymentMethods);
        
        if (data.taxSettings) {
          await chunkedPut(db.taxSettings, data.taxSettings.map((t: any) => ({
            ...t,
            rate: new Big(t.rate || 0).toString()
          })));
        }
      });

      console.log('[BootstrapService] Data lokal berhasil diperbarui');
    } catch (error) {
      console.error('[BootstrapService] Gagal memperbarui data lokal:', error);
      throw new Error('Gagal menyimpan data master ke penyimpanan lokal.');
    }
  },

  /**
   * Mengambil seluruh data master dari penyimpanan lokal.
   */
  async loadFromLocal() {
    const db = await getDb();
    
    const [
      products,
      categories,
      conversions,
      prices,
      customers,
      paymentMethods,
      taxSettings
    ] = await Promise.all([
      db.products.toArray(),
      db.categories.toArray(),
      db.productUoms.toArray(),
      db.productPrices.toArray(),
      db.customers.toArray(),
      db.paymentMethods.toArray(),
      db.taxSettings.toArray()
    ]);

    return {
      products,
      categories,
      conversions,
      prices,
      customers,
      paymentMethods,
      taxSettings,
      uoms: [],
      expenseCategories: [],
      priceTiers: []
    };
  },

  /**
   * Mencari produk dari database lokal (Dexie).
   * Dioptimalkan menggunakan index (Fix 3).
   */
  async searchProducts(query: string, categoryId?: number | null) {
    const db = await getDb();
    let results: any[] = [];

    if (query) {
      // Gunakan indexed search untuk SKU dan Nama (Fix 3)
      // Catatan: Dexie startsWith lebih efisien daripada filter JS
      const skuMatch = await db.products.where('sku').equalsIgnoreCase(query).toArray();
      const nameMatch = await db.products.where('name').startsWithIgnoreCase(query).limit(50).toArray();
      
      // Gabungkan dan deduplikasi
      const map = new Map();
      [...skuMatch, ...nameMatch].forEach(p => map.set(p.id, p));
      results = Array.from(map.values());
    } else {
      results = await db.products.limit(50).toArray();
    }

    // Filter kategori jika disediakan (Fix 5: handle ID 0)
    if (categoryId !== undefined && categoryId !== null) {
      results = results.filter(p => p.categoryId === categoryId);
    }

    return results;
  },

  async clear() {
    const db = await getDb();
    await db.transaction('rw', [
      db.products,
      db.categories,
      db.productUoms,
      db.productPrices,
      db.customers,
      db.paymentMethods,
      db.taxSettings
    ], async () => {
      await db.products.clear();
      await db.categories.clear();
      await db.productUoms.clear();
      await db.productPrices.clear();
      await db.customers.clear();
      await db.paymentMethods.clear();
      await db.taxSettings.clear();
    });
  }
};
