import { getDb } from "@/lib/db";
import type { LocalTransaction, PendingOperation } from "@/lib/db";
import type { CartItem, CartTotals } from "@petshop/shared";

export interface OfflineTransactionPayload {
  branchId: number;
  shiftId: number;
  cashierId: number | null;
  customerId: number | null;
  items: CartItem[];
  totals: CartTotals;
  amountPaid: number;
  change: number;
  payments: {
    paymentMethodId: number;
    amount: number;
    referenceNumber: null;
  }[];
  offlineAt: number;
  authorizedOversell?: boolean;
  oversellApprovedAt?: number;
}

export const offlineQueueService = {
  async enqueue(payload: OfflineTransactionPayload): Promise<string> {
    const db = await getDb();
    // Fix #4: Add unique suffix to prevent collisions
    const localTrxNumber = `TRX-OFFLINE-${payload.branchId}-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`;

    const operation: PendingOperation = {
      id: crypto.randomUUID(),
      type: "TRANSACTION",
      payload: { ...payload, localTrxNumber },
      createdAt: Date.now(),
      retryCount: 0,
    };

    try {
      await db.pendingOperations.add(operation);
      return localTrxNumber;
    } catch (error) {
      // Fix #5: Pass original error as cause
      throw new Error("Gagal menyimpan transaksi ke antrean lokal.", { cause: error });
    }
  },

  async saveLocalTransaction(trx: Omit<LocalTransaction, "id">): Promise<void> {
    const db = await getDb();
    try {
      // Fix #6: Improved signature to match Dexie Table.add expectations (id is auto-increment)
      await db.localTransactions.add(trx as unknown as LocalTransaction);
    } catch (error) {
      // Fix #5: Pass original error as cause
      throw new Error("Gagal menyimpan riwayat transaksi lokal.", { cause: error });
    }
  },

  async getPendingCount(): Promise<number> {
    const db = await getDb();
    try {
      return await db.pendingOperations.count();
    } catch (error) {
      // Fix #5: Pass original error as cause
      throw new Error("Gagal menghitung antrean transaksi.", { cause: error });
    }
  },
};
