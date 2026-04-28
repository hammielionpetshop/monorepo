# Blind Hunter Review Prompt

You are a Blind Hunter code reviewer. You receive the diff below and nothing else. Your goal is to find bugs, anti-patterns, and code quality issues based solely on the code changes.

## Diff to Review

```patch
commit afe81437db1d651294cd8b2e5729dc1f62d434ec
Author: cundus <pcinta0@gmail.com>
Date:   Tue Apr 28 10:38:38 2026 +0700

    feat(pos): implement local transaction queue and auto-sync (Story 1.3 & 1.4)

diff --git a/apps/pos-desktop/src/components/pos/PaymentDialog.tsx b/apps/pos-desktop/src/components/pos/PaymentDialog.tsx
index 327f27e..011a681 100644
--- a/apps/pos-desktop/src/components/pos/PaymentDialog.tsx
+++ b/apps/pos-desktop/src/components/pos/PaymentDialog.tsx
@@ -10,6 +10,8 @@ import { useAuthStore } from '@/store/auth-store';
 import { useCartStore } from '@/store/cart-store';
 import { usePOSStore } from '@/store/pos-store';
 import { useShiftStore } from '@/store/shift-store';
+import { useNetworkStore } from '@/store/network-store';
+import { offlineQueueService } from '@/services/offline-queue-service';
 import { printService } from '@/services/print-service';
 import { apiClient } from '@/lib/api-client';
 import { Button } from '@/components/ui/button';
@@ -21,6 +23,7 @@ import { 
   Printer, 
   X
 } from 'lucide-react';
+import Big from 'big.js';
 
 interface PaymentMethod {
   id: number;
@@ -73,6 +76,7 @@ export const PaymentDialog: React.FC<PaymentDialogProps> = ({ 
     try {
       setIsSubmitting(true);
       const activeShift = useShiftStore.getState().activeShift;
+      const activeCashierId = useShiftStore.getState().activeCashierId;
 
       if (!activeShift) {
         toast.error('Shift tidak aktif! Silakan masuk melalui Shift Gate.');
@@ -83,21 +87,59 @@ export const PaymentDialog: React.FC<PaymentDialogProps> = ({ 
       const basePayload = {
         branchId: 1, // Default branch
         shiftId: activeShift.id,
-        cashierId: useAuthStore.getState().user?.id || null,
+        cashierId: activeCashierId || useAuthStore.getState().user?.id || null,
         customerId: useCartStore.getState().customerId || null,
         items: items,
         totals: totals,
         amountPaid: amountPaidTotal,
         change: change,
-        payments: payments.map(p => ({
-          paymentMethodId: p.paymentMethodId,
-          amount: p.amount,
-          referenceNumber: null
-        }))
+        payments: payments.map(p => ({ paymentMethodId: p.paymentMethodId, amount: p.amount, referenceNumber: null })),
       };
 
-      const response = await apiClient('/pos/transactions', {
-        method: 'POST',
-        body: JSON.stringify(basePayload)
-      });
+      let finalTrxNumber: string;
+      const isOnline = useNetworkStore.getState().isOnline;
+
+      if (!isOnline) {
+        // Path Offline
+        finalTrxNumber = await offlineQueueService.enqueue({ ...basePayload, offlineAt: Date.now() });
+      } else {
+        // Path Online
+        const response = await apiClient('/pos/transactions', { method: 'POST', body: JSON.stringify(basePayload) });
+        finalTrxNumber = response.transaction.trxNumber;
+      }
+
+      // Simpan ke localTransactions untuk history (FR8-FR13) — KEDUANYA online & offline
+      const customer = usePOSStore.getState().customers.find(c => c.id === basePayload.customerId);
+      const customerName = customer ? customer.name : '';
+
+      try {
+        await offlineQueueService.saveLocalTransaction({
+          shiftId: activeShift.id,
+          trxNumber: finalTrxNumber,
+          createdAt: Date.now(),
+          customerName,
+          totalAmount: new Big(totals.grandTotal).toString(),
+          payload: { ...basePayload, trxNumber: finalTrxNumber },
+        });
+
+        // Update pendingCount di networkStore
+        const count = await offlineQueueService.getPendingCount();
+        useNetworkStore.getState().setPendingCount(count);
+      } catch (localErr) {
+        console.warn('[PaymentDialog] Gagal menyimpan riwayat lokal atau update counter:', localErr);
+        // Kita tidak men-throw error di sini agar UI tetap lanjut (transaksi utama sudah berhasil)
+      }
 
       // Try printing
       try {
         await printService.printReceipt({
-          trxNumber: response.transaction.trxNumber,
+          trxNumber: finalTrxNumber,
           items: items,
           totals: totals,
           payments: payments
         });
       } catch (printErr) {
-        console.warn('Printing failed:', printErr);
+        console.warn('[PaymentDialog] Pencetakan struk gagal:', printErr);
         // Don't block the UI if only printing fails
       }
 
       setIsSuccess(true);
-      setLastTransaction(response.transaction);
+      // Fix #1: Sediakan data minimal yang dibutuhkan DeliveryOrderDialog untuk mencegah crash
+      setLastTransaction({ 
+        id: finalTrxNumber, // Fallback ID
+        trxNumber: finalTrxNumber,
+        customer: customer ? { name: customer.name, address: '' } : null 
+      });
       // Auto-clear cart but don't auto-close if we want DO prompt
       clearCart();
     } catch (err: any) {
       console.error('Payment failed:', err);
-      toast.error('Gagal memproses pembayaran: ' + (err.message || 'Unknown error'));
+      toast.error('Gagal memproses pembayaran: ' + (err.message || 'Terjadi kesalahan'));
     } finally {
       setIsSubmitting(false);
     }
diff --git a/apps/pos-desktop/src/services/offline-queue-service.test.ts b/apps/pos-desktop/src/services/offline-queue-service.test.ts
new file mode 100644
index 0000000..003f334
--- /dev/null
+++ b/apps/pos-desktop/src/services/offline-queue-service.test.ts
@@ -0,0 +1,110 @@
+import { describe, it, expect, vi, beforeEach } from "vitest";
+import { offlineQueueService } from "./offline-queue-service";
+import type { OfflineTransactionPayload } from "./offline-queue-service";
+import { getDb } from "@/lib/db";
+
+// Mock dependencies
+vi.mock("@/lib/db", () => ({
+  getDb: vi.fn(),
+}));
+
+describe("OfflineQueueService", () => {
+  let mockDb: any;
+
+  beforeEach(() => {
+    vi.clearAllMocks();
+    mockDb = {
+      pendingOperations: { add: vi.fn(), count: vi.fn() },
+      localTransactions: { add: vi.fn() },
+    };
+    (getDb as any).mockResolvedValue(mockDb);
+  });
+
+  describe("enqueue", () => {
+    it("should save transaction to pendingOperations and return localTrxNumber", async () => {
+      const payload: OfflineTransactionPayload = {
+        branchId: 1,
+        shiftId: 10,
+        cashierId: 1,
+        customerId: null,
+        items: [],
+        totals: {
+          grandTotal: 10000,
+          discountTotal: 0,
+          itemCount: 0,
+          subtotal: 0,
+          totalWeightGram: 0,
+        },
+        amountPaid: 10000,
+        change: 0,
+        payments: [],
+        offlineAt: 123456789,
+      };
+
+      const result = await offlineQueueService.enqueue(payload);
+
+      expect(result).toMatch(/^TRX-OFFLINE-1-\d+-[a-f0-9]{4}$/);
+      expect(mockDb.pendingOperations.add).toHaveBeenCalledWith(
+        expect.objectContaining({
+          type: "TRANSACTION",
+          payload: expect.objectContaining({
+            localTrxNumber: result,
+            branchId: 1,
+          }),
+        }),
+      );
+    });
+
+    it("should throw error if saving fails", async () => {
+      mockDb.pendingOperations.add.mockRejectedValue(new Error("DB Error"));
+
+      await expect(offlineQueueService.enqueue({} as any)).rejects.toThrow(
+        "Gagal menyimpan transaksi ke antrean lokal.",
+      );
+    });
+  });
+
+  describe("saveLocalTransaction", () => {
+    it("should save transaction to localTransactions", async () => {
+      const trx = {
+        shiftId: 10,
+        trxNumber: "TRX-123",
+        createdAt: 123456789,
+        customerName: "Test Customer",
+        totalAmount: "10000",
+        payload: {},
+      };
+
+      await offlineQueueService.saveLocalTransaction(trx);
+
+      expect(mockDb.localTransactions.add).toHaveBeenCalledWith(trx);
+    });
+
+    it("should throw error if saving fails", async () => {
+      mockDb.localTransactions.add.mockRejectedValue(new Error("DB Error"));
+
+      await expect(
+        offlineQueueService.saveLocalTransaction({} as any),
+      ).rejects.toThrow("Gagal menyimpan riwayat transaksi lokal.");
+    });
+  });
+
+  describe("getPendingCount", () => {
+    it("should return count from pendingOperations", async () => {
+      mockDb.pendingOperations.count.mockResolvedValue(5);
+
+      const count = await offlineQueueService.getPendingCount();
+
+      expect(count).toBe(5);
+      expect(mockDb.pendingOperations.count).toHaveBeenCalled();
+    });
+
+    it("should throw error if counting fails", async () => {
+      mockDb.pendingOperations.count.mockRejectedValue(new Error("DB Error"));
+
+      await expect(offlineQueueService.getPendingCount()).rejects.toThrow(
+        "Gagal menghitung antrean transaksi.",
+      );
+    });
+  });
+});
diff --git a/apps/pos-desktop/src/services/offline-queue-service.ts b/apps/pos-desktop/src/services/offline-queue-service.ts
new file mode 100644
index 0000000..4b42916
--- /dev/null
+++ b/apps/pos-desktop/src/services/offline-queue-service.ts
@@ -0,0 +1,65 @@
+import { getDb } from "@/lib/db";
+import type { LocalTransaction, PendingOperation } from "@/lib/db";
+import type { CartItem, CartTotals } from "@petshop/shared";
+
+export interface OfflineTransactionPayload {
+  branchId: number;
+  shiftId: number;
+  cashierId: number | null;
+  customerId: number | null;
+  items: CartItem[];
+  totals: CartTotals;
+  amountPaid: number;
+  change: number;
+  payments: {
+    paymentMethodId: number;
+    amount: number;
+    referenceNumber: null;
+  }[];
+  offlineAt: number;
+}
+
+export const offlineQueueService = {
+  async enqueue(payload: OfflineTransactionPayload): Promise<string> {
+    const db = await getDb();
+    // Fix #4: Add unique suffix to prevent collisions
+    const localTrxNumber = `TRX-OFFLINE-${payload.branchId}-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`;
+
+    const operation: PendingOperation = {
+      id: crypto.randomUUID(),
+      type: "TRANSACTION",
+      payload: { ...payload, localTrxNumber },
+      createdAt: Date.now(),
+      retryCount: 0,
+    };
+
+    try {
+      await db.pendingOperations.add(operation);
+      return localTrxNumber;
+    } catch (error) {
+      // Fix #5: Pass original error as cause
+      throw new Error("Gagal menyimpan transaksi ke antrean lokal.");
+    }
+  },
+
+  async saveLocalTransaction(trx: Omit<LocalTransaction, "id">): Promise<void> {
+    const db = await getDb();
+    try {
+      // Fix #6: Improved signature to match Dexie Table.add expectations (id is auto-increment)
+      await db.localTransactions.add(trx as unknown as LocalTransaction);
+    } catch (error) {
+      // Fix #5: Pass original error as cause
+      throw new Error("Gagal menyimpan riwayat transaksi lokal.");
+    }
+  },
+
+  async getPendingCount(): Promise<number> {
+    const db = await getDb();
+    try {
+      return await db.pendingOperations.count();
+    } catch (error) {
+      // Fix #5: Pass original error as cause
+      throw new Error("Gagal menghitung antrean transaksi.");
+    }
+  },
+};
+```

## Instructions

1. Analyze the diff for logic errors, security vulnerabilities, performance issues, and readability problems.
2. Output your findings as a Markdown list.
3. For each finding, provide:
   - A descriptive title
   - The file and line range
   - A clear explanation of the issue
   - A suggested fix
