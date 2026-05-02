# Acceptance Auditor Review Prompt

You are an Acceptance Auditor. Your task is to review the provided diff against the spec and context docs.

## Role
Check for:
- Violations of acceptance criteria
- Deviations from spec intent
- Missing implementation of specified behavior
- Contradictions between spec constraints and actual code

## Specification (Story 4.2)
```markdown
# Story 4.2: Prevent Void on Closed Shift

## Acceptance Criteria

1. **Given** sebuah transaksi terjadi pada shift yang statusnya sudah ditutup (Closed)
   **When** Kasir melihat rincian transaksi tersebut di dialog `TransactionDetailDialog`
   **Then** tombol "Void" akan disembunyikan (tidak dirender)

2. **Given** sebuah transaksi terjadi pada shift yang MASIH aktif (Open)
   **When** Kasir melihat rincian transaksi tersebut
   **Then** tombol "Void" tetap tampil seperti perilaku Story 4.1 (tidak berubah)

3. **Given** tidak ada shift aktif saat ini (`activeShift === null`)
   **When** Kasir melihat rincian transaksi apapun
   **Then** tombol "Void" disembunyikan (semua transaksi dianggap bukan dari shift aktif)

4. **Given** Kasir melihat halaman History tanggal kemarin
   **When** transaksi yang ditampilkan berasal dari shift yang berbeda dari shift aktif hari ini
   **Then** tombol "Void" disembunyikan pada semua transaksi tersebut

## Tasks / Subtasks

- [x] **Update props `TransactionDetailDialog.tsx` — tambah `activeShiftId`** (AC: 1, 2, 3)
  - [x] Tambah prop `activeShiftId?: number | null` ke interface `TransactionDetailDialogProps`
  - [x] Hitung `const canVoid = activeShiftId != null && transaction.shiftId === activeShiftId`
  - [x] Update kondisi render Void button: `{transaction.status !== 'VOID' && canVoid && (...)}`
  - [x] **PENTING:** Jangan ubah handler `handleVoidSuccess`, guard `isVoidProcessing`, atau logika PIN — hanya visibilitas Void button yang berubah

- [x] **Update `History.tsx` — kirim `activeShiftId` ke dialog** (AC: 1, 2, 3, 4)
  - [x] Import `useShiftStore` dari `@/store/shift-store`
  - [x] Destructure `activeShift` dari `useShiftStore()`
  - [x] Tambah prop `activeShiftId={activeShift?.id ?? null}` pada `<TransactionDetailDialog>`
```

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
```

## Expected Output
A Markdown list of findings. Each finding: one-line title, which AC/constraint it violates, and evidence from the diff.
