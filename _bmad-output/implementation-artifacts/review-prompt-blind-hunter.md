# Blind Hunter Review Prompt

You are an elite code reviewer. Your task is to perform an adversarial review of the provided diff.

## Context
You have NO context about the project, the story, or the requirements. You ONLY have the diff below.

## Role: Blind Hunter
You are a cynical, jaded reviewer with zero patience for sloppy work. Assume the code was written by a clueless weasel. Look for what's missing, bugs, bad patterns, and security flaws. Use a precise, professional tone.

## Content to Review (Diff)
```diff
diff --git a/apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx b/apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx
index be3385b..ec18cf0 100644
--- a/apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx
+++ b/apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx
@@ -13,18 +13,21 @@ interface TransactionDetailDialogProps {
   transaction: LocalTransaction | null;
   paymentMethods: PaymentMethod[];
   onClose: () => void;
-  onVoid?: (updatedTx: LocalTransaction) => void; // NEW
+  onVoid?: (updatedTx: LocalTransaction) => void;
+  activeShiftId?: number | null;
 }
 
 export const TransactionDetailDialog: React.FC<
   TransactionDetailDialogProps
-> = ({ transaction, paymentMethods, onClose, onVoid }) => {
+> = ({ transaction, paymentMethods, onClose, onVoid, activeShiftId }) => {
   const [isPrinting, setIsPrinting] = useState(false);
   const [isVoidPinOpen, setIsVoidPinOpen] = useState(false);
   const [isVoidProcessing, setIsVoidProcessing] = useState(false);
 
   if (!transaction) return null;
 
+  const canVoid = activeShiftId != null && transaction.shiftId === activeShiftId;
+
   const payload = transaction.payload ?? {};
   const items: CartItem[] = payload.items ?? [];
   const totals: CartTotals = payload.totals ?? {};
@@ -255,7 +258,7 @@ export const TransactionDetailDialog: React.FC<
         </div>
 
         {/* Footer */}
-        {transaction.status !== "VOID" && (
+        {transaction.status !== "VOID" && canVoid && (
           <button
             onClick={() => setIsVoidPinOpen(true)}
             disabled={isPrinting || isVoidProcessing}
diff --git a/apps/pos-desktop/src/pages/History.tsx b/apps/pos-desktop/src/pages/History.tsx
index 11e26d7..1a674c1 100644
--- a/apps/pos-desktop/src/pages/History.tsx
+++ b/apps/pos-desktop/src/pages/History.tsx
@@ -2,6 +2,7 @@ import React, { useEffect, useMemo, useState } from 'react'
 import { POSLayout } from '@/components/layout/POSLayout'
 import { historyService } from '@/services/history-service'
 import { usePOSStore } from '@/store/pos-store'
+import { useShiftStore } from '@/store/shift-store'
 import { formatRupiah } from '@/lib/utils'
 import type { LocalTransaction } from '@/lib/db'
 import { ClipboardList, Loader2, Search, X } from 'lucide-react'
@@ -18,6 +19,7 @@ function formatDateForInput(date: Date): string {
 
 export const HistoryPage: React.FC = () => {
   const { paymentMethods } = usePOSStore()
+  const { activeShift } = useShiftStore()
   const [transactions, setTransactions] = useState<LocalTransaction[]>([])
   const [isLoading, setIsLoading] = useState(true)
   const [selectedTransaction, setSelectedTransaction] = useState<LocalTransaction | null>(null)
@@ -252,6 +254,7 @@ export const HistoryPage: React.FC = () => {
         paymentMethods={paymentMethods}
         onClose={() => setSelectedTransaction(null)}
         onVoid={handleVoid}
+        activeShiftId={activeShift?.id ?? null}
       />
     </POSLayout>
   )
diff --git a/apps/pos-desktop/src/services/void-service.test.ts b/apps/pos-desktop/src/services/void-service.test.ts
new file mode 100644
index 0000000..d9de27b
--- /dev/null
+++ b/apps/pos-desktop/src/services/void-service.test.ts
@@ -0,0 +1,119 @@
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { voidService } from './void-service'
+import { getDb } from '@/lib/db'
+
+vi.mock('@/lib/db', () => ({
+  getDb: vi.fn(),
+}))
+
+describe('VoidService', () => {
+  const mockDb = {
+    localTransactions: {
+      get: vi.fn(),
+      update: vi.fn(),
+    },
+    pendingOperations: {
+      add: vi.fn(),
+    },
+    transaction: vi.fn(),
+  }
+
+  beforeEach(() => {
+    vi.clearAllMocks()
+    vi.mocked(getDb).mockResolvedValue(mockDb as any)
+    // Simulate Dexie transaction executing the callback immediately
+    mockDb.transaction.mockImplementation((_mode: string, _tables: any[], callback: () => any) =>
+      callback()
+    )
+  })
+
+  describe('voidTransaction', () => {
+    it('should update status to VOID and add pendingOperation', async () => {
+      const mockTrx = {
+        id: 1,
+        shiftId: 42,
+        trxNumber: 'TRX-001',
+        createdAt: Date.now(),
+        customerName: 'Budi',
+        totalAmount: '100000',
+        payload: {},
+        status: undefined,
+      }
+      mockDb.localTransactions.get.mockResolvedValue(mockTrx)
+      mockDb.localTransactions.update.mockResolvedValue(1)
+      mockDb.pendingOperations.add.mockResolvedValue('some-uuid')
+
+      const result = await voidService.voidTransaction(1)
+
+      expect(mockDb.localTransactions.update).toHaveBeenCalledWith(1, { status: 'VOID' })
+      expect(mockDb.pendingOperations.add).toHaveBeenCalledWith(
+        expect.objectContaining({
+          type: 'VOID_TRANSACTION',
+          payload: expect.objectContaining({ transactionId: 1, trxNumber: 'TRX-001' }),
+        })
+      )
+      expect(result.status).toBe('VOID')
+    })
+
+    it('should throw if transaction not found', async () => {
+      mockDb.localTransactions.get.mockResolvedValue(undefined)
+
+      await expect(voidService.voidTransaction(999)).rejects.toThrow('Transaksi tidak ditemukan.')
+    })
+
+    it('should throw if transaction already VOID', async () => {
+      mockDb.localTransactions.get.mockResolvedValue({ id: 1, status: 'VOID' })
+
+      await expect(voidService.voidTransaction(1)).rejects.toThrow('Transaksi sudah dibatalkan.')
+    })
+  })
+
+  // Story 4.2 contract: shift-closed guard lives in UI layer, not service
+  // The UI checks: canVoid = activeShiftId != null && transaction.shiftId === activeShiftId
+  // voidService itself does NOT enforce shift status — the Void button is hidden before it can be called
+  describe('shiftId contract (Story 4.2 guard — UI layer)', () => {
+    it('should preserve shiftId in the returned voided transaction', async () => {
+      const mockTrx = {
+        id: 5,
+        shiftId: 42,
+        trxNumber: 'TRX-SHIFT',
+        createdAt: Date.now(),
+        customerName: '',
+        totalAmount: '50000',
+        payload: {},
+        status: undefined,
+      }
+      mockDb.localTransactions.get.mockResolvedValue(mockTrx)
+      mockDb.localTransactions.update.mockResolvedValue(1)
+      mockDb.pendingOperations.add.mockResolvedValue('uuid')
+
+      const result = await voidService.voidTransaction(5)
+
+      // shiftId must be preserved so UI can still evaluate canVoid after void
+      expect(result.shiftId).toBe(42)
+    })
+
+    it('should document UI guard: Void button only shown when shiftId matches activeShiftId', () => {
+      // This test documents the UI guard contract (no runtime assertion needed):
+      // In TransactionDetailDialog:
+      //   const canVoid = activeShiftId != null && transaction.shiftId === activeShiftId
+      //   {transaction.status !== 'VOID' && canVoid && <VoidButton />}
+      //
+      // Cases:
+      //   activeShiftId=42, shiftId=42 → canVoid=true  → button shown
+      //   activeShiftId=null, shiftId=42 → canVoid=false → button hidden
+      //   activeShiftId=43, shiftId=42  → canVoid=false → button hidden
+      const cases = [
+        { activeShiftId: 42, shiftId: 42, expected: true },
+        { activeShiftId: null, shiftId: 42, expected: false },
+        { activeShiftId: 43, shiftId: 42, expected: false },
+        { activeShiftId: undefined, shiftId: 42, expected: false },
+      ]
+
+      for (const { activeShiftId, shiftId, expected } of cases) {
+        const canVoid = activeShiftId != null && shiftId === activeShiftId
+        expect(canVoid).toBe(expected)
+      }
+    })
+  })
+})
+```

## Expected Output
A Markdown list of findings (descriptions only). Find at least 10 issues.
