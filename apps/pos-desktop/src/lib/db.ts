import Dexie, { type Table } from "dexie";
import { applyEncryptionMiddleware, NON_INDEXED_FIELDS } from "dexie-encrypted";

// Tipe data untuk Master Data
export interface Product {
  id: number;
  sku: string;
  name: string;
  branchId: number;
  categoryId: number;
  baseUomId: number; // Added: Fix 2
}

export interface Category {
  id: number;
  name: string;
  parentId?: number;
}

// ... existing interfaces ...

export interface ProductUom {
  id: number;
  productId: number;
  uomId: number;
  uomCode: string;
  conversionValue: string; // big.js string
}

export interface ProductPrice {
  id: number;
  productId: number;
  priceCategoryId: number;
  uomId: number; // Added: Fix 2
  tierType: string; // Added: Fix 2
  price: string; // big.js string
}

export interface Customer {
  id: number;
  phone: string;
  name: string;
}

export interface PaymentMethod {
  id: number;
  name: string;
  code: string;
}

export interface TaxSetting {
  id: number;
  name: string;
  rate: string; // big.js string
}

// Tipe data untuk Operational
export interface CurrentShift {
  id: number;
  openedAt: number;
  cashierId: number;
  status: "OPEN" | "CLOSED";
}

export interface PendingOperation {
  id: string;
  type: "TRANSACTION" | "EXPENSE" | "SHIFT_CLOSE" | "VOID_TRANSACTION";
  payload: any;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

export interface LocalTransaction {
  id: number;
  shiftId: number;
  trxNumber: string;
  createdAt: number;
  customerName: string;
  totalAmount: string; // big.js string
  payload: any; // Full transaction data
  status?: 'COMPLETED' | 'VOID'; // NEW — undefined = COMPLETED (backward compat)
}

class AppDatabase extends Dexie {
  products!: Table<Product>;
  categories!: Table<Category>; // Added: Fix 7
  productUoms!: Table<ProductUom>;
  productPrices!: Table<ProductPrice>;
  customers!: Table<Customer>;
  paymentMethods!: Table<PaymentMethod>;
  taxSettings!: Table<TaxSetting>;
  currentShift!: Table<CurrentShift>;
  pendingOperations!: Table<PendingOperation>;
  localTransactions!: Table<LocalTransaction>;

  constructor() {
    super("HammielionPOS");
  }
}

let dbInstance: AppDatabase | null = null;
let dbInitPromise: Promise<AppDatabase> | null = null; // Added: Fix 1

export async function getDb(): Promise<AppDatabase> {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    const db = new AppDatabase();

    try {
      // Ambil atau buat kunci enkripsi dari Electron safeStorage
      // @ts-ignore
      const isIpcAvailable = !!(
        window.ipcRenderer && window.ipcRenderer.secureStorage
      );

      let encryptionKey: string | null = null;

      if (isIpcAvailable) {
        // @ts-ignore
        encryptionKey = await window.ipcRenderer.secureStorage.get("dexie-key");

        if (!encryptionKey) {
          encryptionKey = crypto.randomUUID();
          // @ts-ignore
          await window.ipcRenderer.secureStorage.set(
            "dexie-key",
            encryptionKey,
          );
        }
      } else {
        // Fallback for dev/test environments without Electron (Fix 9)
        console.warn(
          "[DB] Security bridge unavailable. Using insecure local key.",
        );
        encryptionKey = localStorage.getItem("dexie-insecure-key");
        if (!encryptionKey) {
          encryptionKey = crypto.randomUUID();
          localStorage.setItem("dexie-insecure-key", encryptionKey);
        }
      }

      // Convert string key to 32-byte Uint8Array for dexie-encrypted (Fix for string key error)
      const encoder = new TextEncoder();
      const keyData = encoder.encode(encryptionKey!);
      const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
      const finalKey = new Uint8Array(hashBuffer);

      // Aktifkan enkripsi (ADR-001)
      // Middleware WAJIB dipasang sebelum definisi stores (version)
      applyEncryptionMiddleware(db, finalKey, {
        products: NON_INDEXED_FIELDS,
        categories: NON_INDEXED_FIELDS,
        productUoms: NON_INDEXED_FIELDS,
        productPrices: NON_INDEXED_FIELDS,
        customers: NON_INDEXED_FIELDS,
        paymentMethods: NON_INDEXED_FIELDS,
        taxSettings: NON_INDEXED_FIELDS,
        currentShift: NON_INDEXED_FIELDS,
        pendingOperations: NON_INDEXED_FIELDS,
        localTransactions: NON_INDEXED_FIELDS,
      });

      // Definisikan skema
      db.version(1).stores({
        products: "++id, sku, name, branchId, categoryId",
        categories: "++id, name",
        productUoms: "++id, productId",
        productPrices:
          "++id, productId, priceCategoryId, [productId+uomId+tierType]",
        customers: "++id, phone, name",
        paymentMethods: "++id",
        taxSettings: "++id",
        currentShift: "++id",
        pendingOperations: "++id, type, createdAt",
        localTransactions: "++id, shiftId, createdAt, customerName",
      });

      // Versi 2 — tambah index status di localTransactions (Post-MVP void support)
      db.version(2).stores({
        localTransactions: "++id, shiftId, createdAt, customerName, status",
      });

      await db.open();
      dbInstance = db;
      return db;
    } catch (error) {
      console.error("Gagal membuka database:", error);
      // Clean up on failure (Fix 6)
      if (db.isOpen()) await db.close();
      dbInitPromise = null;
      throw new Error(
        "Gagal menginisialisasi database lokal. Silakan restart aplikasi.",
      );
    }
  })();

  return dbInitPromise;
}
