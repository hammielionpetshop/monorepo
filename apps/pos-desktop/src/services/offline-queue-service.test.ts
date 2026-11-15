import { describe, it, expect, vi, beforeEach } from "vitest";
import { offlineQueueService } from "./offline-queue-service";
import type { OfflineTransactionPayload } from "./offline-queue-service";
import { getDb } from "@/lib/db";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

describe("OfflineQueueService", () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      pendingOperations: { add: vi.fn(), count: vi.fn() },
      localTransactions: { add: vi.fn() },
    };
    (getDb as any).mockResolvedValue(mockDb);
  });

  describe("enqueue", () => {
    it("should save transaction to pendingOperations and return localTrxNumber", async () => {
      const payload: OfflineTransactionPayload = {
        branchId: 1,
        shiftId: 10,
        cashierId: 1,
        customerId: null,
        items: [],
        totals: {
          grandTotal: 10000,
          discountTotal: 0,
          itemCount: 0,
          subtotal: 0,
          totalWeightGram: 0,
        },
        amountPaid: 10000,
        change: 0,
        payments: [],
        offlineAt: 123456789,
      };

      const result = await offlineQueueService.enqueue(payload);

      expect(result).toMatch(/^TRX-OFFLINE-1-\d+-[a-f0-9]{4}$/);
      expect(mockDb.pendingOperations.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "TRANSACTION",
          payload: expect.objectContaining({
            localTrxNumber: result,
            branchId: 1,
          }),
        }),
      );
    });

    it("should throw error if saving fails", async () => {
      mockDb.pendingOperations.add.mockRejectedValue(new Error("DB Error"));

      await expect(offlineQueueService.enqueue({} as any)).rejects.toThrow(
        "Gagal menyimpan transaksi ke antrean lokal.",
      );
    });
  });

  describe("saveLocalTransaction", () => {
    it("should save transaction to localTransactions", async () => {
      const trx = {
        shiftId: 10,
        trxNumber: "TRX-123",
        createdAt: 123456789,
        customerName: "Test Customer",
        totalAmount: "10000",
        payload: {},
      };

      await offlineQueueService.saveLocalTransaction(trx);

      expect(mockDb.localTransactions.add).toHaveBeenCalledWith(trx);
    });

    it("should throw error if saving fails", async () => {
      mockDb.localTransactions.add.mockRejectedValue(new Error("DB Error"));

      await expect(
        offlineQueueService.saveLocalTransaction({} as any),
      ).rejects.toThrow("Gagal menyimpan riwayat transaksi lokal.");
    });
  });

  describe("getPendingCount", () => {
    it("should return count from pendingOperations", async () => {
      mockDb.pendingOperations.count.mockResolvedValue(5);

      const count = await offlineQueueService.getPendingCount();

      expect(count).toBe(5);
      expect(mockDb.pendingOperations.count).toHaveBeenCalled();
    });

    it("should throw error if counting fails", async () => {
      mockDb.pendingOperations.count.mockRejectedValue(new Error("DB Error"));

      await expect(offlineQueueService.getPendingCount()).rejects.toThrow(
        "Gagal menghitung antrean transaksi.",
      );
    });
  });
});
