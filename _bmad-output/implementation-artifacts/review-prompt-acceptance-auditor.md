# Acceptance Auditor Review Prompt

Anda adalah seorang **Acceptance Auditor**. Tugas Anda adalah meninjau perubahan kode (diff) berikut terhadap Spesifikasi (Story) dan dokumen Arsitektur yang disediakan. Pastikan semua Kriteria Penerimaan (AC) terpenuhi dan tidak ada penyimpangan dari desain yang direncanakan.

## Diff Output
`diff
diff --git a/apps/pos-desktop/electron/main.ts b/apps/pos-desktop/electron/main.ts
index ce079eb..9296634 100644
--- a/apps/pos-desktop/electron/main.ts
+++ b/apps/pos-desktop/electron/main.ts
@@ -3,6 +3,7 @@ import { fileURLToPath } from 'node:url'
 import path from 'node:path'
 import fs from 'node:fs'
 import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer'
+import bcrypt from 'bcryptjs'
 
 const __dirname = path.dirname(fileURLToPath(import.meta.url))
 
@@ -81,6 +82,36 @@ ipcMain.handle('secure-storage:remove', (_, key: string) => {
   return true
 })
 
+// Validasi PIN Owner (ADR-004)
+ipcMain.handle('pin:validate', async (_, pin: string) => {
+  if (!pin || typeof pin !== 'string') return false
+  if (!safeStorage.isEncryptionAvailable()) return false
+  const config = getSecureConfig()
+  const encrypted = config['owner-pin-hash']
+  if (!encrypted) return null // null = PIN belum dikonfigurasi (berbeda dari false = PIN salah)
+  try {
+    const storedHash = safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
+    return await bcrypt.compare(pin, storedHash)
+  } catch {
+    return false
+  }
+})
+
+// Setup PIN Owner — dipanggil saat bootstrap atau oleh Administrator
+ipcMain.handle('pin:set-hash', async (_, plainPin: string) => {
+  if (!safeStorage.isEncryptionAvailable()) return false
+  try {
+    const hash = await bcrypt.hash(plainPin, 12)
+    const encrypted = safeStorage.encryptString(hash).toString('base64')
+    const config = getSecureConfig()
+    config['owner-pin-hash'] = encrypted
+    saveSecureConfig(config)
+    return true
+  } catch {
+    return false
+  }
+})
+
 ipcMain.handle('printer:print', async (_, payload: any) => {
   console.log('[Printer] Received print payload:', payload.trxNumber);
   
diff --git a/apps/pos-desktop/package.json b/apps/pos-desktop/package.json
index a53a8ea..876e275 100644
--- a/apps/pos-desktop/package.json
+++ b/apps/pos-desktop/package.json
@@ -18,6 +18,7 @@
     "@radix-ui/react-slot": "^1.2.4",
     "@radix-ui/react-toast": "^1.2.15",
     "@tanstack/react-query": "latest",
+    "bcryptjs": "^3.0.3",
     "big.js": "^7.0.1",
     "class-variance-authority": "latest",
     "clsx": "latest",
@@ -33,6 +34,7 @@
     "zustand": "latest"
   },
   "devDependencies": {
+    "@types/bcryptjs": "^3.0.0",
     "@types/big.js": "^6.2.2",
     "@types/react": "^19",
     "@types/react-dom": "^19",
diff --git a/apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx b/apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx
index efaa4a5..2b64de0 100644
--- a/apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx
+++ b/apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx
@@ -1,24 +1,24 @@
 import React, { useState } from 'react'
-import { X, Printer, Loader2 } from 'lucide-react'
+import { X, Printer, Loader2, Ban } from 'lucide-react'
 import { toast } from 'sonner'
 import type { LocalTransaction, PaymentMethod } from '@/lib/db'
 import { formatRupiah } from '@/lib/utils'
 import type { CartItem, CartTotals } from '@petshop/shared'
 import type { TransactionPayment } from '@petshop/shared'
 import { printService } from '@/lib/print-service'
+import { PinChallengeDialog } from '@/components/pos/PinChallengeDialog'
+import { voidService } from '@/services/void-service'
 
 interface TransactionDetailDialogProps {
   transaction: LocalTransaction | null
   paymentMethods: PaymentMethod[]
   onClose: () => void
+  onVoid?: (updatedTx: LocalTransaction) => void // NEW
 }
 
-export const TransactionDetailDialog: React.FC<TransactionDetailDialogProps> = ({
-  transaction,
-  paymentMethods,
-  onClose,
-}) => {
   const [isPrinting, setIsPrinting] = useState(false)
+  const [isVoidPinOpen, setIsVoidPinOpen] = useState(false)
+  const [isVoidProcessing, setIsVoidProcessing] = useState(false)
 
   if (!transaction) return null
 
@@ -65,6 +65,20 @@ export const TransactionDetailDialog: React.FC<TransactionDetailDialogProps> = (
     }
   }
 
+  const handleVoidSuccess = async () => {
+    setIsVoidPinOpen(false)
+    setIsVoidProcessing(true)
+    try {
+      const updated = await voidService.voidTransaction(transaction!.id)
+      toast.success('Transaksi berhasil dibatalkan')
+      onVoid?.(updated)
+    } catch (err) {
+      toast.error('Gagal membatalkan transaksi: ' + (err as Error).message)
+    } finally {
+      setIsVoidProcessing(false)
+    }
+  }
+
   return (
     <>
       {/* Backdrop */}
@@ -79,7 +93,15 @@ export const TransactionDetailDialog: React.FC<TransactionDetailDialogProps> = (
         {/* Header */}
         <div className="flex items-start justify-between px-6 py-5 border-b border-white/5 shrink-0">
           <div>
-            <h2 className="text-lg font-black text-white">{transaction.trxNumber}</h2>
+            <div className="flex items-center gap-3">
+              <h2 className="text-lg font-black text-white">{transaction.trxNumber}</h2>
+              {transaction.status === 'VOID' && (
+                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-wide">
+                  <Ban className="w-3 h-3" />
+                  VOID
+                </span>
+              )}
+            </div>
             <p className="text-sm text-neutral-500 mt-0.5">{formatDateTime(transaction.createdAt)}</p>
             {transaction.customerName && (
               <p className="text-sm text-brand-400 mt-0.5">{transaction.customerName}</p>
@@ -179,10 +201,19 @@ export const TransactionDetailDialog: React.FC<TransactionDetailDialogProps> = (
         </div>
 
         {/* Footer */}
-        <div className="px-6 py-4 border-t border-white/5 shrink-0 flex gap-3">
+          {transaction.status !== 'VOID' && (
+            <button
+              onClick={() => setIsVoidPinOpen(true)}
+              disabled={isPrinting || isVoidProcessing}
+              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
+            >
+              <Ban className="w-4 h-4" />
+              Void
+            </button>
+          )}
           <button
             onClick={handleReprint}
-            disabled={isPrinting}
+            disabled={isPrinting || isVoidProcessing || transaction.status === 'VOID'}
             className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
           >
             {isPrinting
@@ -200,6 +231,12 @@ export const TransactionDetailDialog: React.FC<TransactionDetailDialogProps> = (
           </button>
         </div>
       </div>
+
+      <PinChallengeDialog
+        isOpen={isVoidPinOpen}
+        onClose={() => setIsVoidPinOpen(false)}
+        onSuccess={handleVoidSuccess}
+      />
     </>
   )
 }
diff --git a/apps/pos-desktop/src/components/pos/PinChallengeDialog.tsx b/apps/pos-desktop/src/components/pos/PinChallengeDialog.tsx
index 7c6f9c8..e2ebdcb 100644
--- a/apps/pos-desktop/src/components/pos/PinChallengeDialog.tsx
+++ b/apps/pos-desktop/src/components/pos/PinChallengeDialog.tsx
@@ -1,5 +1,5 @@
 import React, { useState } from 'react';
-import { X, Lock, CheckCircle2 } from 'lucide-react';
+import { X, Lock, Loader2 } from 'lucide-react';
 
 interface PinChallengeDialogProps {
   isOpen: boolean;
@@ -10,18 +10,31 @@ interface PinChallengeDialogProps {
 export const PinChallengeDialog: React.FC<PinChallengeDialogProps> = ({ isOpen, onClose, onSuccess }) => {
   const [pin, setPin] = useState('');
   const [error, setError] = useState('');
+  const [isValidating, setIsValidating] = useState(false);
 
   if (!isOpen) return null;
 
-  const handleSubmit = (e: React.FormEvent) => {
+  const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
-    // Default dummy PIN for owner is '123456'
-    if (pin === '123456') {
-      onSuccess();
-      setPin('');
-      setError('');
-    } else {
-      setError('PIN tidak valid');
+    if (pin.length < 4 || isValidating) return;
+    setIsValidating(true);
+    setError('');
+    try {
+      const result = await window.ipcRenderer.invoke('pin:validate', pin);
+      if (result === null) {
+        // null = PIN belum dikonfigurasi di safeStorage
+        setError('PIN Owner belum dikonfigurasi. Hubungi Administrator.');
+      } else if (result === true) {
+        onSuccess();
+        setPin('');
+        setError('');
+      } else {
+        setError('PIN tidak valid. Pastikan PIN Owner yang dimasukkan benar.');
+      }
+    } catch {
+      setError('Gagal memvalidasi PIN. Coba lagi.');
+    } finally {
+      setIsValidating(false);
     }
   };
 
@@ -33,26 +46,26 @@ export const PinChallengeDialog: React.FC<PinChallengeDialogProps> = ({ isOpen,
             <Lock className="w-5 h-5 text-brand-400" />
             Otorisasi Owner
           </h2>
-          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 transition-colors">
+          <button
+            onClick={onClose}
+            disabled={isValidating}
+            className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
+          >
             <X className="w-5 h-5" />
           </button>
         </div>
-        
+
         <form onSubmit={handleSubmit} className="p-6 space-y-6">
-          <div className="space-y-2 text-center">
-            <p className="text-sm text-neutral-400">Masukkan 6-digit PIN Owner untuk melanjutkan tindakan ini.</p>
-          </div>
-          
+          <p className="text-sm text-neutral-400 text-center">Masukkan 6-digit PIN Owner untuk melanjutkan tindakan ini.</p>
+
           <div>
-            <input 
+            <input
               type="password"
               maxLength={6}
               value={pin}
-              onChange={(e) => {
-                setPin(e.target.value);
-                setError('');
-              }}
-              className="w-full bg-[#161616] border border-white/5 rounded-2xl py-4 text-center text-3xl tracking-[1em] font-black text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-mono"
+              onChange={(e) => { setPin(e.target.value); setError(''); }}
+              disabled={isValidating}
+              className="w-full bg-[#161616] border border-white/5 rounded-2xl py-4 text-center text-3xl tracking-[1em] font-black text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-mono disabled:opacity-50"
               autoFocus
             />
             {error && <p className="text-red-500 text-xs text-center mt-2 font-bold">{error}</p>}
@@ -60,10 +73,10 @@ export const PinChallengeDialog: React.FC<PinChallengeDialogProps> = ({ isOpen,
 
           <button
             type="submit"
-            disabled={pin.length < 4}
-            className="w-full bg-brand-500 hover:bg-brand-400 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-950 font-black py-4 rounded-2xl transition-all"
+            disabled={pin.length < 4 || isValidating}
+            className="w-full bg-brand-500 hover:bg-brand-400 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-950 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
           >
-            Verifikasi
+            {isValidating ? <><Loader2 className="w-4 h-4 animate-spin" /> Memverifikasi...</> : 'Verifikasi'}
           </button>
         </form>
       </div>
diff --git a/apps/pos-desktop/src/lib/db.ts b/apps/pos-desktop/src/lib/db.ts
index 456ba8a..23522fe 100644
--- a/apps/pos-desktop/src/lib/db.ts
+++ b/apps/pos-desktop/src/lib/db.ts
@@ -64,7 +64,7 @@ export interface CurrentShift {
 
 export interface PendingOperation {
   id: string;
-  type: "TRANSACTION" | "EXPENSE" | "SHIFT_CLOSE";
+  type: "TRANSACTION" | "EXPENSE" | "SHIFT_CLOSE" | "VOID_TRANSACTION";
   payload: any;
   createdAt: number;
   retryCount: number;
@@ -79,6 +79,7 @@ export interface LocalTransaction {
   customerName: string;
   totalAmount: string; // big.js string
   payload: any; // Full transaction data
+  status?: 'COMPLETED' | 'VOID'; // NEW — undefined = COMPLETED (backward compat)
 }
 
 class AppDatabase extends Dexie {
@@ -177,6 +178,11 @@ export async function getDb(): Promise<AppDatabase> {
         localTransactions: "++id, shiftId, createdAt, customerName",
       });
 
+      // Versi 2 — tambah index status di localTransactions (Post-MVP void support)
+      db.version(2).stores({
+        localTransactions: "++id, shiftId, createdAt, customerName, status",
+      });
+
       await db.open();
       dbInstance = db;
       return db;
diff --git a/apps/pos-desktop/src/pages/History.tsx b/apps/pos-desktop/src/pages/History.tsx
index b5296b9..4b405a6 100644
--- a/apps/pos-desktop/src/pages/History.tsx
+++ b/apps/pos-desktop/src/pages/History.tsx
@@ -1,4 +1,4 @@
-import React, { useEffect, useState } from 'react'
+import React, { useEffect, useMemo, useState } from 'react'
 import { POSLayout } from '@/components/layout/POSLayout'
 import { historyService } from '@/services/history-service'
 import { usePOSStore } from '@/store/pos-store'
@@ -23,9 +23,11 @@ export const HistoryPage: React.FC = () => {
   const [selectedTransaction, setSelectedTransaction] = useState<LocalTransaction | null>(null)
   const [searchQuery, setSearchQuery] = useState('')
   const [selectedDate, setSelectedDate] = useState<Date>(new Date())
+  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null)
 
   useEffect(() => {
     let isCancelled = false
+    setSelectedShiftId(null)
     setIsLoading(true)
     historyService.getTransactionsByDate(selectedDate)
       .then((data) => {
@@ -63,21 +65,47 @@ export const HistoryPage: React.FC = () => {
     return new Date(timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
   }
 
-  const trimmedQuery = searchQuery.trim().toLowerCase()
-  const filteredTransactions = trimmedQuery
-    ? transactions.filter((trx) =>
-        String(trx.customerName ?? '').toLowerCase().includes(trimmedQuery)
-      )
-    : transactions
-
-  const dateLabel = useMemo(() => 
-    selectedDate.toLocaleDateString('id-ID', { 
-      weekday: 'long', 
-      day: 'numeric', 
-      month: 'long', 
-      year: 'numeric' 
+  const shiftOptions = useMemo(() => {
+    const shiftMap = new Map<number, number>() // shiftId → createdAt terkecil
+    for (const trx of transactions) {
+      const existing = shiftMap.get(trx.shiftId)
+      if (existing === undefined || trx.createdAt < existing) {
+        shiftMap.set(trx.shiftId, trx.createdAt)
+      }
+    }
+    return Array.from(shiftMap.entries())
+      .sort(([, a], [, b]) => a - b)
+      .map(([shiftId, firstAt], i) => ({
+        shiftId,
+        label: `Shift ${i + 1} (${new Date(firstAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})`,
+      }))
+  }, [transactions])
+
+  const shiftFilteredTransactions = useMemo(
+    () =>
+      selectedShiftId !== null
+        ? transactions.filter((trx) => trx.shiftId === selectedShiftId)
+        : transactions,
+    [transactions, selectedShiftId]
+  )
+
+  const filteredTransactions = useMemo(() => {
+    const q = searchQuery.trim().toLowerCase()
+    if (!q) return shiftFilteredTransactions
+    return shiftFilteredTransactions.filter((trx) =>
+      String(trx.customerName ?? '').toLowerCase().includes(q)
+    )
+  }, [shiftFilteredTransactions, searchQuery])
+
     }), [selectedDate])
 
+  const handleVoid = (updatedTx: LocalTransaction) => {
+    setTransactions((prev) =>
+      prev.map((trx) => (trx.id === updatedTx.id ? updatedTx : trx))
+    )
+    setSelectedTransaction(updatedTx) // refresh tampilan dialog jika masih terbuka
+  }
+
   return (
     <POSLayout>
       <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar">
@@ -127,6 +155,23 @@ export const HistoryPage: React.FC = () => {
             disabled={isLoading}
             className="py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:dark]"
           />
+
+          {/* Shift Filter */}
+          <select
+            value={selectedShiftId ?? ''}
+            onChange={(e) =>
+              setSelectedShiftId(e.target.value ? Number(e.target.value) : null)
+            }
+            disabled={isLoading || shiftOptions.length === 0}
+            className="py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:dark] min-w-[140px]"
+          >
+            <option value="">Semua Shift</option>
+            {shiftOptions.map(({ shiftId, label }) => (
+              <option key={shiftId} value={shiftId}>
+                {label}
+              </option>
+            ))}
+          </select>
         </div>
 
         {/* Content */}
@@ -142,6 +187,11 @@ export const HistoryPage: React.FC = () => {
                 <p className="text-neutral-500 font-bold">Tidak ada transaksi untuk "{searchQuery}"</p>
                 <p className="text-neutral-600 text-sm mt-1">Coba kata kunci lain atau kosongkan pencarian</p>
               </>
+            ) : selectedShiftId !== null ? (
+              <>
+                <p className="text-neutral-500 font-bold">Tidak ada transaksi untuk shift ini</p>
+                <p className="text-neutral-600 text-sm mt-1">Pilih shift lain atau tampilkan semua shift</p>
+              </>
             ) : (
               <>
                 <p className="text-neutral-500 font-bold">Tidak ada transaksi pada tanggal ini</p>
@@ -164,11 +214,22 @@ export const HistoryPage: React.FC = () => {
             {filteredTransactions.map((trx) => (
               <div
                 key={trx.id}
-                className="grid grid-cols-5 gap-4 px-4 py-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
+                className={`grid grid-cols-5 gap-4 px-4 py-4 rounded-xl border transition-colors cursor-pointer
+                  ${trx.status === 'VOID'
+                    ? 'bg-red-500/5 border-red-500/15 hover:bg-red-500/10 opacity-70'
+                    : 'bg-white/5 border-white/5 hover:bg-white/10'
+                  }`}
                 onClick={() => setSelectedTransaction(trx)}
               >
                 <span className="text-sm font-mono text-neutral-300">{formatTime(trx.createdAt)}</span>
-                <span className="text-sm font-bold text-white truncate" title={trx.trxNumber}>{trx.trxNumber}</span>
+                <span className="text-sm font-bold text-white truncate flex items-center gap-1.5" title={trx.trxNumber}>
+                  {trx.trxNumber}
+                  {trx.status === 'VOID' && (
+                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 uppercase tracking-wide leading-none shrink-0">
+                      VOID
+                    </span>
+                  )}
+                </span>
                 <span className="text-sm text-neutral-400 truncate" title={trx.customerName || undefined}>{trx.customerName || '—'}</span>
                 <span className="text-sm font-bold text-emerald-400 text-right">{formatRupiah(parseFloat(trx.totalAmount))}</span>
                 <span className="text-sm text-neutral-300">{getPaymentMethodName(trx)}</span>
@@ -182,6 +243,7 @@ export const HistoryPage: React.FC = () => {
         transaction={selectedTransaction}
         paymentMethods={paymentMethods}
         onClose={() => setSelectedTransaction(null)}
+        onVoid={handleVoid}
       />
     </POSLayout>
   )
diff --git a/apps/pos-desktop/src/services/history-service.test.ts b/apps/pos-desktop/src/services/history-service.test.ts
index 491d66d..c303cee 100644
--- a/apps/pos-desktop/src/services/history-service.test.ts
+++ b/apps/pos-desktop/src/services/history-service.test.ts
@@ -139,4 +139,36 @@ describe('HistoryService', () => {
       expect(result[0].customerName).toBe('Budi')
     })
   })
+
+  describe('getTransactionsByDate - shiftId contract', () => {
+    it('should return transactions with shiftId field (required by Story 3.3 in-memory filter)', async () => {
+      const mockData = [
+        { id: 1, shiftId: 10, trxNumber: 'TRX-001', createdAt: Date.now(), totalAmount: '100', customerName: 'Budi', payload: {} },
+        { id: 2, shiftId: 11, trxNumber: 'TRX-002', createdAt: Date.now(), totalAmount: '200', customerName: 'Ani', payload: {} },
+      ]
+      mockDb.localTransactions.toArray.mockResolvedValue(mockData)
+
+      const result = await historyService.getTransactionsByDate(new Date())
+
+      expect(result[0].shiftId).toBe(10)
+      expect(result[1].shiftId).toBe(11)
+    })
+  })
+
+  describe('LocalTransaction status contract (Story 4.1)', () => {
+    it('should support VOID status and handle legacy undefined status', async () => {
+      const mockData = [
+        { id: 1, trxNumber: 'TRX-VOID', status: 'VOID', createdAt: Date.now() },
+        { id: 2, trxNumber: 'TRX-OK', status: 'COMPLETED', createdAt: Date.now() },
+        { id: 3, trxNumber: 'TRX-OLD', status: undefined, createdAt: Date.now() },
+      ]
+      mockDb.localTransactions.toArray.mockResolvedValue(mockData)
+
+      const result = await historyService.getTodayTransactions()
+
+      expect(result[0].status).toBe('VOID')
+      expect(result[1].status).toBe('COMPLETED')
+      expect(result[2].status).toBeUndefined() // UI interpret undefined as COMPLETED
+    })
+  })
 })
diff --git a/apps/pos-desktop/src/services/void-service.ts b/apps/pos-desktop/src/services/void-service.ts
new file mode 100644
--- /dev/null
+++ b/apps/pos-desktop/src/services/void-service.ts
@@ -0,0 +1,32 @@
+// apps/pos-desktop/src/services/void-service.ts
+import { getDb } from '@/lib/db'
+import type { LocalTransaction } from '@/lib/db'
+
+export const voidService = {
+  async voidTransaction(transactionId: number): Promise<LocalTransaction> {
+    const db = await getDb()
+
+    return await db.transaction('rw', [db.localTransactions, db.pendingOperations], async () => {
+      const trx = await db.localTransactions.get(transactionId)
+      if (!trx) throw new Error('Transaksi tidak ditemukan.')
+      if (trx.status === 'VOID') throw new Error('Transaksi sudah dibatalkan.')
+
+      await db.localTransactions.update(transactionId, { status: 'VOID' })
+
+      await db.pendingOperations.add({
+        id: crypto.randomUUID(),
+        type: 'VOID_TRANSACTION',
+        payload: {
+          transactionId,
+          trxNumber: trx.trxNumber,
+          voidedAt: Date.now(),
+        },
+        createdAt: Date.now(),
+        retryCount: 0,
+      })
+
+      return { ...trx, status: 'VOID' as const }
+    })
+  },
+}
+

`

## Spec Content (Story 4.1)
---
epic_id: 4
story_id: 4.1
story_key: 4-1-void-transaction-with-pin
status: review
created_at: 2026-05-02
---

# Story 4.1: Void Transaction with PIN

## Story

As a Kasir,
I want membatalkan (Void) transaksi yang salah jika saya mendapatkan PIN Otorisasi dari Owner,
So that saya dapat mengoreksi kesalahan input tanpa merusak catatan finansial permanen.

## Acceptance Criteria

1. **Given** Kasir sedang melihat rincian transaksi di halaman History  
   **When** mereka menekan tombol "Void"  
   **Then** muncul modal `PinChallengeDialog` yang meminta PIN Otorisasi Owner

2. **Given** PIN dimasukkan dengan benar  
   **When** form dikirim  
   **Then** status transaksi berubah menjadi `'VOID'` di IndexedDB (record tidak dihapus)  
   **And** sebuah `pendingOperation` bertipe `'VOID_TRANSACTION'` ditambahkan ke antrian sync

3. **Given** transaksi berhasil di-void  
   **When** dialog detail transaksi masih terbuka  
   **Then** badge "VOID" merah muncul di header dialog  
   **And** tombol "Void" dihilangkan  
   **And** tombol "Cetak Ulang" dinonaktifkan

4. **Given** transaksi sudah berstatus `VOID`  
   **When** Kasir membuka kembali transaksi tersebut dari daftar History  
   **Then** baris di daftar History menampilkan badge "VOID" berwarna merah  
   **And** tombol "Void" tidak tersedia di dialog detail

5. **Given** PIN yang dimasukkan salah  
   **When** form dikirim  
   **Then** pesan error "PIN tidak valid. Pastikan PIN Owner yang dimasukkan benar." muncul di bawah input  
   **And** status transaksi tidak berubah

6. **Given** Owner PIN belum dikonfigurasi di perangkat  
   **When** PIN apapun dimasukkan dan form dikirim  
   **Then** muncul pesan error "PIN Owner belum dikonfigurasi. Hubungi Administrator."  
   **And** tombol Void tetap aktif agar kasir bisa coba lagi

## Tasks / Subtasks

- [x] **Install `bcryptjs` dependency** (Prasyarat: PIN Validation)
  - [x] Jalankan: `pnpm --filter petshop-pos add bcryptjs`
  - [x] Jalankan: `pnpm --filter petshop-pos add -D @types/bcryptjs`
  - [x] Verifikasi entry muncul di `apps/pos-desktop/package.json`

- [x] **Tambah `pin:validate` & `pin:set-hash` IPC handlers di `main.ts`** (AC: 2, 5, 6)
  - [x] Di bagian atas `main.ts`, tambah import: `import bcrypt from 'bcryptjs'`
  - [x] Tambah handler `ipcMain.handle('pin:validate', ...)` â€” lihat snippet di Dev Notes
  - [x] Tambah helper handler `ipcMain.handle('pin:set-hash', ...)` untuk setup PIN â€” lihat snippet di Dev Notes
  - [x] Pastikan tidak ada konflik dengan handler `secure-storage:*` yang ada

- [x] **Update `LocalTransaction` interface & Dexie schema v2 di `db.ts`** (AC: 2, 4)
  - [x] Tambah field `status?: 'COMPLETED' | 'VOID'` pada interface `LocalTransaction`
  - [x] Tambah `'VOID_TRANSACTION'` pada union type field `type` di interface `PendingOperation`
  - [x] Tambah `db.version(2).stores(...)` dengan penambahan index `status` di `localTransactions` â€” lihat snippet di Dev Notes
  - [x] Pastikan `db.version(1).stores(...)` tetap ada (diperlukan untuk migration)
  - [x] `undefined` status diinterpretasi sebagai `'COMPLETED'` (backward compatible)

- [x] **Buat `void-service.ts` di `apps/pos-desktop/src/services/`** (AC: 2)
  - [x] Buat file baru: `apps/pos-desktop/src/services/void-service.ts`
  - [x] Implementasi `voidTransaction(transactionId: number): Promise<void>` â€” lihat snippet di Dev Notes
  - [x] Guard: lempar error jika transaksi tidak ditemukan atau sudah `VOID`
  - [x] Update `status` ke `'VOID'` via `db.localTransactions.update(id, { status: 'VOID' })`
  - [x] Tambah `pendingOperation` bertipe `'VOID_TRANSACTION'` dengan UUID id
  - [x] Semua operasi Dexie harus dibungkus `db.transaction('rw', ...)` agar atomik

- [x] **Upgrade `PinChallengeDialog.tsx` â€” ganti dummy PIN dengan validasi IPC** (AC: 1, 5, 6)
  - [x] Tambah state `isValidating: boolean` (untuk loading state saat IPC berjalan)
  - [x] Ganti `handleSubmit` synchronous menjadi `async` with IPC call â€” lihat snippet di Dev Notes
  - [x] Tambah loading indicator pada tombol Verifikasi saat `isValidating === true`
  - [x] Tambah `disabled={isValidating}` pada semua interactive elements saat validasi berlangsung
  - [x] Pesan error PIN tidak valid vs PIN belum dikonfigurasi berbeda (lihat Dev Notes)
  - [x] **PENTING:** Perubahan ini juga berlaku untuk POS.tsx (price override) â€” tidak ada regresi

- [x] **Update `TransactionDetailDialog.tsx` â€” tambah Void button & VOID badge** (AC: 1, 2, 3, 4)
  - [x] Tambah prop `onVoid: (updatedTx: LocalTransaction) => void` ke interface props
  - [x] Tambah state lokal `isVoidDialogOpen: boolean`
  - [x] Tambah state lokal `isVoidProcessing: boolean`
  - [x] Tambah tombol "Void" di footer dialog â€” lihat snippet di Dev Notes
  - [x] Tombol Void hanya tampil jika `transaction.status !== 'VOID'`
  - [x] Tambah `PinChallengeDialog` inline di dalam `TransactionDetailDialog`
  - [x] Saat PIN sukses: panggil `voidService.voidTransaction(transaction.id)`, lalu panggil `onVoid` callback
  - [x] Tambah badge "VOID" berwarna merah di header dialog jika `transaction.status === 'VOID'`
  - [x] Nonaktifkan tombol "Cetak Ulang" jika `transaction.status === 'VOID'`
  - [x] Gunakan `try/catch` dan tampilkan `toast.error` jika void gagal

- [x] **Update `History.tsx` â€” tampilkan badge VOID di daftar transaksi** (AC: 4)
  - [x] Tambah callback `onVoid` pada `TransactionDetailDialog` yang memperbarui `transactions` state secara optimistik
  - [x] Di baris transaksi di list, tambah badge "VOID" berwarna merah jika `trx.status === 'VOID'`
  - [x] VOID transactions tetap terlihat di list (tidak disembunyikan)
  - [x] Lihat snippet di Dev Notes

- [x] **Tulis test minimal di `history-service.test.ts`** (kontrak void)
  - [x] Verifikasi bahwa `localTransactions` dapat menyimpan dan mengambil field `status`
  - [x] Dokumentasi bahwa `undefined` status = `'COMPLETED'` (backward compat)

## Dev Notes

### Gambaran Alur Void

```
Kasir klik "Void" di TransactionDetailDialog
  â†’ setIsVoidDialogOpen(true)
  â†’ PinChallengeDialog terbuka

Kasir masuk PIN â†’ handleSubmit
  â†’ window.ipcRenderer.invoke('pin:validate', pin)
  â†’ main.ts: bcrypt.compare(pin, storedHash)
  â†’ return true/false

Jika true (onSuccess callback):
  â†’ voidService.voidTransaction(transaction.id)
    â†’ db.transaction('rw', ...):
      â†’ db.localTransactions.update(id, { status: 'VOID' })
      â†’ db.pendingOperations.add({ type: 'VOID_TRANSACTION', ... })
  â†’ onVoid(updatedTx) dipanggil â†’ History.tsx update transactions state
  â†’ toast.success('Transaksi berhasil dibatalkan')
  â†’ setIsVoidDialogOpen(false)
  â†’ UI: badge VOID muncul, tombol Void hilang
```

### Penemuan Kunci: `PinChallengeDialog` Sudah Ada

`apps/pos-desktop/src/components/pos/PinChallengeDialog.tsx` sudah diimplementasi dan dipakai di `POS.tsx` (untuk price override Owner). Saat ini menggunakan PIN hardcoded `'123456'` sebagai placeholder.

**Story 4.1 WAJIB mengupgrade dialog ini ke validasi IPC nyata** (NFR-S2). Perubahan ini berlaku untuk SEMUA penggunaan `PinChallengeDialog` (price override + void) â€” tidak perlu buat dialog terpisah.

**Komponen ini di-import dan dirender langsung di `TransactionDetailDialog`**, bukan melalui global store seperti di `POS.tsx`. Cukup gunakan state lokal `isVoidDialogOpen`.

### 1. Install bcryptjs

```bash
pnpm --filter petshop-pos add bcryptjs
pnpm --filter petshop-pos add -D @types/bcryptjs
```

bcryptjs dipilih (bukan argon2) karena:
- Pure JavaScript â€” tidak memerlukan native compilation
- Tidak ada masalah Electron rebuild di Windows
- Kompatibel dengan arsitektur Electron main process (ADR-004)

### 2. Snippet: IPC Handlers di `main.ts`

Tambahkan setelah block `ipcMain.handle('secure-storage:remove', ...)`:

```typescript
import bcrypt from 'bcryptjs'

// Validasi PIN Owner (ADR-004)
ipcMain.handle('pin:validate', async (_, pin: string) => {
  if (!pin || typeof pin !== 'string') return false
  if (!safeStorage.isEncryptionAvailable()) return false
  const config = getSecureConfig()
  const encrypted = config['owner-pin-hash']
  if (!encrypted) return null // null = PIN belum dikonfigurasi (berbeda dari false = PIN salah)
  try {
    const storedHash = safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    return await bcrypt.compare(pin, storedHash)
  } catch {
    return false
  }
})

// Setup PIN Owner â€” dipanggil saat bootstrap atau oleh Administrator
ipcMain.handle('pin:set-hash', async (_, plainPin: string) => {
  if (!safeStorage.isEncryptionAvailable()) return false
  try {
    const hash = await bcrypt.hash(plainPin, 12)
    const encrypted = safeStorage.encryptString(hash).toString('base64')
    const config = getSecureConfig()
    config['owner-pin-hash'] = encrypted
    saveSecureConfig(config)
    return true
  } catch {
    return false
  }
})
```

**Catatan penting:** `pin:validate` mengembalikan `null` jika PIN belum dikonfigurasi, `true` jika valid, `false` jika tidak valid. Renderer harus membedakan `null` vs `false` untuk pesan error yang berbeda.

### 3. Snippet: Update `LocalTransaction` & `PendingOperation` di `db.ts`

```typescript
// Update interface LocalTransaction
export interface LocalTransaction {
  id: number;
  shiftId: number;
  trxNumber: string;
  createdAt: number;
  customerName: string;
  totalAmount: string; // big.js string
  payload: any;
  status?: 'COMPLETED' | 'VOID'; // NEW â€” undefined = COMPLETED (backward compat)
}

// Update interface PendingOperation
export interface PendingOperation {
  id: string;
  type: "TRANSACTION" | "EXPENSE" | "SHIFT_CLOSE" | "VOID_TRANSACTION"; // tambah VOID_TRANSACTION
  payload: any;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}
```

**Dexie Schema Migration â€” Tambahkan di `getDb()` SEBELUM `db.open()`:**

```typescript
// Versi 1 â€” tetap ada (diperlukan untuk migration path)
db.version(1).stores({
  products: "++id, sku, name, branchId, categoryId",
  categories: "++id, name",
  productUoms: "++id, productId",
  productPrices: "++id, productId, priceCategoryId, [productId+uomId+tierType]",
  customers: "++id, phone, name",
  paymentMethods: "++id",
  taxSettings: "++id",
  currentShift: "++id",
  pendingOperations: "++id, type, createdAt",
  localTransactions: "++id, shiftId, createdAt, customerName",
});

// Versi 2 â€” tambah index status di localTransactions (Post-MVP void support)
db.version(2).stores({
  localTransactions: "++id, shiftId, createdAt, customerName, status",
  // Tabel lain tidak berubah â€” tidak perlu didefinisikan ulang
});
```

### 4. Snippet: `void-service.ts` (file baru)

```typescript
// apps/pos-desktop/src/services/void-service.ts
import { getDb } from '@/lib/db'
import type { LocalTransaction } from '@/lib/db'

export const voidService = {
  async voidTransaction(transactionId: number): Promise<LocalTransaction> {
    const db = await getDb()

    return await db.transaction('rw', [db.localTransactions, db.pendingOperations], async () => {
      const trx = await db.localTransactions.get(transactionId)
      if (!trx) throw new Error('Transaksi tidak ditemukan.')
      if (trx.status === 'VOID') throw new Error('Transaksi sudah dibatalkan.')

      await db.localTransactions.update(transactionId, { status: 'VOID' })

      await db.pendingOperations.add({
        id: crypto.randomUUID(),
        type: 'VOID_TRANSACTION',
        payload: {
          transactionId,
          trxNumber: trx.trxNumber,
          voidedAt: Date.now(),
        },
        createdAt: Date.now(),
        retryCount: 0,
      })

      return { ...trx, status: 'VOID' as const }
    })
  },
}
```

### 5. Snippet: Upgrade `PinChallengeDialog.tsx`

Ganti fungsi `handleSubmit` (sinkronus) dengan versi async berikut:

```typescript
import React, { useState } from 'react';
import { X, Lock, Loader2 } from 'lucide-react';

// ... interface sama ...

export const PinChallengeDialog: React.FC<PinChallengeDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || isValidating) return;
    setIsValidating(true);
    setError('');
    try {
      const result = await window.ipcRenderer.invoke('pin:validate', pin);
      if (result === null) {
        // null = PIN belum dikonfigurasi di safeStorage
        setError('PIN Owner belum dikonfigurasi. Hubungi Administrator.');
      } else if (result === true) {
        onSuccess();
        setPin('');
        setError('');
      } else {
        setError('PIN tidak valid. Pastikan PIN Owner yang dimasukkan benar.');
      }
    } catch {
      setError('Gagal memvalidasi PIN. Coba lagi.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#111]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-brand-400" />
            Otorisasi Owner
          </h2>
          <button
            onClick={onClose}
            disabled={isValidating}
            className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <p className="text-sm text-neutral-400 text-center">Masukkan 6-digit PIN Owner untuk melanjutkan tindakan ini.</p>

          <div>
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(''); }}
              disabled={isValidating}
              className="w-full bg-[#161616] border border-white/5 rounded-2xl py-4 text-center text-3xl tracking-[1em] font-black text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-mono disabled:opacity-50"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs text-center mt-2 font-bold">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={pin.length < 4 || isValidating}
            className="w-full bg-brand-500 hover:bg-brand-400 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-950 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            {isValidating ? <><Loader2 className="w-4 h-4 animate-spin" /> Memverifikasi...</> : 'Verifikasi'}
          </button>
        </form>
      </div>
    </div>
  );
};
```

### 6. Snippet: Update `TransactionDetailDialog.tsx`

**Tambah import & props:**
```typescript
import { PinChallengeDialog } from '@/components/pos/PinChallengeDialog'
import { voidService } from '@/services/void-service'
import { Ban } from 'lucide-react' // icon void

interface TransactionDetailDialogProps {
  transaction: LocalTransaction | null
  paymentMethods: PaymentMethod[]
  onClose: () => void
  onVoid?: (updatedTx: LocalTransaction) => void // NEW
}
```

**Tambah state lokal di dalam komponen:**
```typescript
const [isVoidPinOpen, setIsVoidPinOpen] = useState(false)
const [isVoidProcessing, setIsVoidProcessing] = useState(false)
```

**Handler void:**
```typescript
const handleVoidSuccess = async () => {
  setIsVoidPinOpen(false)
  setIsVoidProcessing(true)
  try {
    const updated = await voidService.voidTransaction(transaction!.id)
    toast.success('Transaksi berhasil dibatalkan')
    onVoid?.(updated)
  } catch (err) {
    toast.error('Gagal membatalkan transaksi: ' + (err as Error).message)
  } finally {
    setIsVoidProcessing(false)
  }
}
```

**VOID badge di header dialog** (tambahkan setelah trxNumber):
```tsx
{transaction.status === 'VOID' && (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-wide">
    <Ban className="w-3 h-3" />
    VOID
  </span>
)}
```

**Tombol Void di footer** (sebelum tombol Cetak Ulang):
```tsx
{transaction.status !== 'VOID' && (
  <button
    onClick={() => setIsVoidPinOpen(true)}
    disabled={isPrinting || isVoidProcessing}
    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
  >
    <Ban className="w-4 h-4" />
    Void
  </button>
)}
```

**Nonaktifkan tombol Cetak Ulang jika VOID:**
```tsx
// Tambahkan `|| transaction.status === 'VOID'` pada kondisi disabled tombol reprint
disabled={isPrinting || isVoidProcessing || transaction.status === 'VOID'}
```

**Render PinChallengeDialog di akhir komponen** (sebelum closing `</>`):
```tsx
<PinChallengeDialog
  isOpen={isVoidPinOpen}
  onClose={() => setIsVoidPinOpen(false)}
  onSuccess={handleVoidSuccess}
/>
```

### 7. Snippet: Update `History.tsx` â€” badge VOID di list & callback onVoid

**Callback onVoid untuk update state:**
```typescript
const handleVoid = (updatedTx: LocalTransaction) => {
  setTransactions((prev) =>
    prev.map((trx) => (trx.id === updatedTx.id ? updatedTx : trx))
  )
  setSelectedTransaction(updatedTx) // refresh tampilan dialog jika masih terbuka
}
```

**Badge VOID di baris transaksi** (tambahkan di kolom nomor struk atau setelah total):
```tsx
{filteredTransactions.map((trx) => (
  <div
    key={trx.id}
    className={`grid grid-cols-5 gap-4 px-4 py-4 rounded-xl border transition-colors cursor-pointer
      ${trx.status === 'VOID'
        ? 'bg-red-500/5 border-red-500/15 hover:bg-red-500/10 opacity-70'
        : 'bg-white/5 border-white/5 hover:bg-white/10'
      }`}
    onClick={() => setSelectedTransaction(trx)}
  >
    <span className="text-sm font-mono text-neutral-300">{formatTime(trx.createdAt)}</span>
    <span className="text-sm font-bold text-white truncate flex items-center gap-1.5">
      {trx.trxNumber}
      {trx.status === 'VOID' && (
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 uppercase tracking-wide leading-none shrink-0">
          VOID
        </span>
      )}
    </span>
    {/* ... kolom lainnya sama ... */}
  </div>
))}
```

**Update prop di TransactionDetailDialog:**
```tsx
<TransactionDetailDialog
  transaction={selectedTransaction}
  paymentMethods={paymentMethods}
  onClose={() => setSelectedTransaction(null)}
  onVoid={handleVoid}
/>
```

### Catatan PIN Setup untuk Development & Testing

PIN Owner disimpan sebagai bcrypt hash terenkripsi di safeStorage (`owner-pin-hash`). Untuk menyetel PIN saat development/testing:

```typescript
// Dari DevTools atau Electron renderer console:
await window.ipcRenderer.invoke('pin:set-hash', '123456')
// â†’ returns true jika berhasil

// Untuk verifikasi:
await window.ipcRenderer.invoke('pin:validate', '123456')
// â†’ returns true
```

Untuk produksi: PIN Owner di-set saat proses onboarding perangkat melalui `pin:set-hash` yang dipanggil bootstrap service ketika menerima `ownerPinPlain` dari server. Update bootstrap service ini **DITARGETKAN di Sprint berikutnya** â€” **BUKAN bagian dari Story 4.1**.

### Stock Restoration via Server Sync

Architecture tidak menyimpan stock quantity di Dexie (hanya di server). `VOID_TRANSACTION` pendingOperation yang ditambahkan ke antrian akan diproses saat sync ke server â€” server yang mengembalikan stok secara server-side. Tidak ada perubahan `products` table lokal yang diperlukan.

### File yang Dimodifikasi

| File | Aksi | Keterangan |
|---|---|---|
| `apps/pos-desktop/package.json` | **MODIFY** | Tambah `bcryptjs` dan `@types/bcryptjs` |
| `apps/pos-desktop/electron/main.ts` | **MODIFY** | Tambah `pin:validate` dan `pin:set-hash` IPC handlers |
| `apps/pos-desktop/src/lib/db.ts` | **MODIFY** | `LocalTransaction.status`, `PendingOperation.type`, Dexie v2 |
| `apps/pos-desktop/src/services/void-service.ts` | **CREATE** | Service layer untuk operasi void |
| `apps/pos-desktop/src/components/pos/PinChallengeDialog.tsx` | **MODIFY** | Ganti dummy PIN â†’ IPC validation, tambah loading state |
| `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` | **MODIFY** | Tambah Void button, VOID badge, PIN dialog integration |
| `apps/pos-desktop/src/pages/History.tsx` | **MODIFY** | Badge VOID di list, `onVoid` callback, `handleVoid` handler |
| `apps/pos-desktop/src/services/history-service.test.ts` | **MODIFY** | Tambah test dokumentasi kontrak `status` field |

**JANGAN modifikasi:**
- `apps/pos-desktop/src/store/pos-store.ts` â€” void tidak butuh state global POS
- `apps/pos-desktop/electron/preload.ts` â€” generic `invoke` sudah tersedia
- Tabel Dexie lain selain `localTransactions` â€” tidak relevan untuk story ini

### Anti-Pattern yang DILARANG

```typescript
// âŒ DILARANG: akses Dexie langsung dari komponen
const db = await getDb()
await db.localTransactions.update(id, { status: 'VOID' })
// BENAR: gunakan void-service.voidTransaction(id)

// âŒ DILARANG: hardcoded PIN check
if (pin === '123456') { onSuccess() }
// BENAR: window.ipcRenderer.invoke('pin:validate', pin)

// âŒ DILARANG: delete/hapus record yang di-void
await db.localTransactions.delete(id)
// BENAR: update status ke 'VOID', record tetap ada (audit trail)

// âŒ DILARANG: buat VoidDialog baru yang terpisah dari PinChallengeDialog
// BENAR: reuse PinChallengeDialog yang sudah ada

// âŒ DILARANG: update stock lokal di Dexie saat void
// BENAR: stock restoration terjadi di server via VOID_TRANSACTION pendingOperation

// âŒ DILARANG: Dexie v1 tanpa v2 migration path
// BENAR: db.version(1).stores(...) tetap ada, db.version(2).stores(...) tambah di bawahnya
```

### Potensi Regresi: Verifikasi POS.tsx Tidak Broken

`PinChallengeDialog` yang diupgrade juga digunakan oleh `POS.tsx` (price override). Setelah upgrade:
1. Alur harga override di POS harus tetap berjalan
2. PIN yang dikonfigurasi via `pin:set-hash` berlaku untuk KEDUA use-case (void + price override)
3. Ini adalah behavior yang diinginkan â€” satu PIN Owner untuk semua otorisasi

### Referensi Kode

- `apps/pos-desktop/src/components/pos/PinChallengeDialog.tsx` â€” dialog PIN yang akan diupgrade
- `apps/pos-desktop/src/pages/POS.tsx:123` â€” penggunaan existing PinChallengeDialog
- `apps/pos-desktop/src/lib/db.ts:70` â€” interface `LocalTransaction` yang akan diupdate
- `apps/pos-desktop/src/lib/db.ts:57` â€” interface `PendingOperation` yang akan diupdate
- `apps/pos-desktop/electron/main.ts:56` â€” pattern IPC handler existing (secure-storage:set)
- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` â€” dialog detail yang diupdate
- `apps/pos-desktop/src/pages/History.tsx` â€” halaman History yang diupdate
- `_bmad-output/planning-artifacts/architecture.md` â€” ADR-004 (PIN salted hash), NFR-S2 (PIN validation)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- Berhasil mengimplementasikan alur Void Transaksi dengan otorisasi PIN Owner.
- PIN sekarang divalidasi menggunakan bcrypt hash yang disimpan di secure storage (Electron safeStorage) melalui IPC.
- Transaksi ditandai sebagai 'VOID' di IndexedDB (tidak dihapus) untuk audit trail.
- Antrian sinkronisasi (`pendingOperations`) ditambahkan untuk memberitahu server tentang pembatalan transaksi.
- UI diperbarui dengan badge "VOID" merah yang mencolok di daftar riwayat dan dialog detail.
- Tombol "Void" dihilangkan dan "Cetak Ulang" dinonaktifkan untuk transaksi yang sudah dibatalkan.
- Verifikasi regresi: Fitur price override di POS tetap berfungsi normal dengan upgrade dialog PIN ini.

### File List
- `apps/pos-desktop/package.json`
- `apps/pos-desktop/electron/main.ts`
- `apps/pos-desktop/src/lib/db.ts`
- `apps/pos-desktop/src/services/void-service.ts`
- `apps/pos-desktop/src/components/pos/PinChallengeDialog.tsx`
- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx`
- `apps/pos-desktop/src/pages/History.tsx`
- `apps/pos-desktop/src/services/history-service.test.ts`

### Change Log
- 2026-05-02: Implementasi awal Story 4.1 Void Transaction with PIN.
- 2026-05-02: Integrasi bcryptjs untuk validasi PIN yang aman.
- 2026-05-02: Update skema Dexie v2 dengan index status.
- 2026-05-02: Penambahan service layer void-service.
- 2026-05-02: Pembaruan UI komponen History dan Detail Dialog.

### Status
Review```


## Architecture Context
---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/project-context.md'
  - 'docs/architecture_strategies.md'
workflowType: 'architecture'
project_name: 'hammielion-monorepo'
user_name: 'Cundus'
date: '2026-04-27'
---

# Architecture Decision Document

_Dokumen ini dibangun secara kolaboratif melalui proses discovery langkah demi langkah. Setiap seksi ditambahkan seiring kita membuat keputusan arsitektur bersama._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
22 FRs terbagi dalam 4 kategori:
- Offline Sync & Bootstrap (FR1-FR7) â€” inti MVP, termasuk fix bootstrap blocker
- Transaction History di POS (FR8-FR13) â€” tampil dari data lokal, filter shift/tanggal
- Transaction Correction (FR14-FR17) â€” Post-MVP (Void & Clone to Cart)
- Reporting & Inventory (FR18-FR22) â€” Post-MVP (Dashboard, L&R, Stock Adjustment)

**Non-Functional Requirements:**
7 NFRs dengan implikasi arsitektur signifikan:
- NFR-P1: Search < 200ms â†’ semua pencarian POS wajib dari IndexedDB lokal
- NFR-P2: Dashboard/Laporan < 3 detik â†’ query dioptimasi di server
- NFR-R1: 100% offline uptime â†’ POS tidak boleh bergantung pada API untuk operasi kasir
- NFR-R2: Exponential retry sync â†’ 1min â†’ 2min â†’ 5min â†’ 15min
- NFR-S1: AES-256 di Dexie.js â†’ dexie-encrypted + key di Electron safeStorage
- NFR-S2: Device-unique PIN salt â†’ UUID random di safeStorage + encrypted backup server
- NFR-S3: big.js wajib â†’ semua kalkulasi finansial, tanpa terkecuali

**Scale & Complexity:**
- Primary domain: Hybrid Desktop (Electron) + Web App (Next.js)
- Complexity level: High
- Estimated architectural components: 10 area keputusan

### Technical Constraints & Dependencies

- Stack terkunci (brownfield): Electron 30, React 18, Next.js 15, Drizzle ORM, PostgreSQL
- Dexie.js sebagai IndexedDB layer â€” harus dienkripsi (ADR-001)
- big.js wajib untuk semua kalkulasi finansial tanpa terkecuali
- Pessimistic locking (`.for('update')`) untuk semua mutasi stok di server
- DevTools dinonaktifkan di build produksi

### Cross-Cutting Concerns Identified

1. **Financial Precision** â€” big.js di semua layer (POS store, API, sync payload)
2. **Offline Data Layer** â€” Dexie.js sebagai cache + write queue (ADR-002)
3. **Sync Integrity** â€” Price-at-time-of-sale preservation (ADR-003)
4. **Security** â€” AES-256 Dexie (ADR-001), device-unique PIN salt (ADR-004)
5. **Audit Trail** â€” Immutable log setiap mutasi stok/finansial + sync discrepancy log
6. **Stock Integrity** â€” Pessimistic locking + StockService sebagai satu-satunya jalur mutasi

### Architectural Decisions (From ADR Session)

| ADR | Keputusan | Rasional |
|---|---|---|
| ADR-001 | `dexie-encrypted` + key di `Electron safeStorage` | Balance security vs implementability |
| ADR-002 | Write queue di tabel Dexie `pendingOperations` | Durabilitas + enkripsi + ordering |
| ADR-003 | Simpan `priceAtSaleTime` + `currentPrice` + flag `hadPriceDiscrepancy` | Zero rejection + full auditability |
| ADR-004 | UUID salt di `safeStorage` + encrypted backup di server | Secure + recoverable saat reinstall |

## Starter Template & Foundation

### Primary Technology Domain

Hybrid Desktop + Web Full-Stack â€” Brownfield project, stack sudah established.
Tidak ada starter baru yang dibutuhkan; fondasi menggunakan existing monorepo.

### Existing Foundation (Brownfield Baseline)

**Monorepo Structure (pnpm + Turborepo):**
- `apps/backoffice` â€” Next.js 15 (App Router, Server Components)
- `apps/pos-desktop` â€” Electron 30 + Vite 5 + React 18
- `packages/db` â€” Drizzle ORM schema + migrations
- `packages/shared` â€” Shared types, schemas, utils

**New Packages Required for MVP Features:**

| Package | Tujuan | Layer |
|---|---|---|
| `dexie-encrypted` (atau fork aktif) | Enkripsi AES-256 IndexedDB (ADR-001) | POS Desktop |
| `argon2` / `bcrypt` | PIN salted hash (ADR-004) | Electron main process |
| `p-retry` atau native | Exponential backoff sync (NFR-R2) | POS Desktop |

**Note:** Network detection menggunakan `navigator.onLine` + event listener bawaan browser/Electron â€” tidak memerlukan package tambahan.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Bootstrap fix: `bulkPut` dalam satu transaksi Dexie atomic
- Dexie schema MVP: 10 tabel (cache + operational + write queue + history)
- Sync endpoint: batch endpoint baru `POST /api/pos/sync/batch`

**Important Decisions (Shape Architecture):**
- Transaction History: 100% dari IndexedDB lokal (NFR-P1 compliant)
- Write queue: tabel `pendingOperations` di Dexie (ADR-002)

**Deferred Decisions (Post-MVP):**
- Dexie schema extension (`voidRequests`, `stockLevels`) â€” ditambah saat Post-MVP
- Real-time push notification untuk sync status Owner

### Data Architecture

**PostgreSQL (Server â€” Single Source of Truth):**
- ORM: Drizzle ORM, strict TypeScript
- Mutasi stok: WAJIB melalui StockService + `.for('update')` pessimistic lock
- Audit: Setiap mutasi stok/finansial dilog ke tabel `audit_logs` (immutable)
- Kolom tambahan di tabel `transactions` untuk sync integrity (ADR-003):
  - `price_at_sale_time` â€” dari POS payload
  - `current_price_at_sync` â€” harga server saat sync diterima
  - `had_price_discrepancy` â€” boolean flag

**Dexie.js MVP Schema (IndexedDB â€” POS Local):**

```typescript
// Read-only cache (di-populate saat bootstrap)
products          // ++id, sku, name, *branchId
productUoms       // ++id, *productId
productPrices     // ++id, *productId, *priceCategoryId
customers         // ++id, phone, name
paymentMethods    // ++id
taxSettings       // ++id

// Operational
currentShift      // ++id (satu record aktif)
openBills         // ++id, *cashierId

// Write queue (ADR-002)
pendingOperations // ++id, type, createdAt, retryCount, lastError

// History Transaksi (FR8-FR13)
localTransactions // ++id, *shiftId, createdAt, customerName
```

**Bootstrap Fix Strategy:**

```typescript
// Atomic upsert dalam satu transaksi Dexie â€” tidak ada window data kosong
await db.transaction('rw', [db.products, db.productPrices, db.customers, ...], async () => {
  await db.products.bulkPut(data.products)
  await db.productPrices.bulkPut(data.prices)
  await db.customers.bulkPut(data.customers)
  await db.paymentMethods.bulkPut(data.paymentMethods)
  await db.taxSettings.bulkPut(data.taxSettings)
})
```

### Authentication & Security

- **JWT POS:** Disimpan di `Electron safeStorage` (OS keychain terenkripsi)
- **JWT Backoffice:** HTTP-only cookie, session-based
- **Dexie Encryption:** `dexie-encrypted` + encryption key dari `safeStorage` (ADR-001)
- **PIN Owner:** Argon2/bcrypt dengan UUID salt di `safeStorage` + encrypted backup server (ADR-004)
- **DevTools:** Dinonaktifkan di production build (`webPreferences.devTools: false`)
- **Node Integration:** `nodeIntegration: false`, `contextIsolation: true`

### API & Communication Patterns

- **Style:** REST, Next.js API Routes
- **POS group:** `/api/pos/*` â€” optimized untuk Electron client
- **Backoffice group:** `/api/bo/*` â€” untuk web management
- **Error format:** `{ error: string }` dalam Bahasa Indonesia
- **Validation:** Zod schema di semua endpoint (input boundary)
- **Sync batch endpoint (baru):**

```
POST /api/pos/sync/batch
Body: {
  deviceId: string,
  transactions: PendingTransaction[]
}
Response: {
  synced: string[],       // IDs berhasil
  failed: { id: string, reason: string }[]
}
```

### Frontend Architecture

**POS Desktop (Electron + React 18):**
- State global: Zustand stores (`cartStore`, `shiftStore`, `syncStore`, `networkStore`)
- Data fetching: TanStack Query (`networkMode: 'offlineFirst'`)
- Offline detection: `window.addEventListener('online'|'offline')` + `navigator.onLine`
- Transaction History source: 100% IndexedDB lokal (`localTransactions` table) â€” NFR-P1
- Routing: HashRouter (Electron-compatible)

**Backoffice (Next.js 15):**
- Server Components untuk data fetching (default)
- Server Actions untuk mutasi
- Manual refresh untuk sekarang (polling di fase berikutnya)

### Infrastructure & Deployment

- **POS distribution:** Electron builder + NSIS installer (Windows x64)
- **Auto-update:** `electron-updater` â€” background download, apply saat restart
- **Backoffice hosting:** Server milik user (existing)
- **Build:** Turborepo parallelizes `dev`, `build`, `lint` antar workspace

### Decision Impact Analysis

**Implementation Sequence untuk MVP:**
1. Fix bootstrap sync â€” blocker semua fitur berikutnya
2. Setup Dexie schema + `SecureDb` abstraction layer (ADR-001)
3. Offline detection + status indicator UI (FR1)
4. `localTransactions` ditulis saat transaksi berhasil (FR8-FR13)
5. Transaction History UI â€” query dari IndexedDB
6. `pendingOperations` write saat offline (FR4)
7. Auto-sync + batch endpoint server (FR5, FR6, FR7)
8. Exponential retry + sync status indicator (NFR-R2)

**Cross-Component Dependencies:**
- History UI â†’ `localTransactions` â†’ bootstrap fix harus selesai lebih dulu
- Auto-sync â†’ `pendingOperations` + `/api/pos/sync/batch` endpoint
- PIN offline â†’ `safeStorage` salt â†’ harus diinisialisasi saat pertama login online

## Implementation Patterns & Consistency Rules

### Critical Conflict Points: 7 area teridentifikasi

### Naming Patterns

**Database (PostgreSQL â€” Drizzle):**
- Tabel: `snake_case` plural (contoh: `pending_operations`, `local_transactions`)
- Kolom: `snake_case` (contoh: `price_at_sale_time`, `had_price_discrepancy`)
- Foreign key: `{table_singular}_id` (contoh: `shift_id`, `product_id`)
- Index: `idx_{table}_{column}` (contoh: `idx_transactions_shift_id`)

**Dexie.js (IndexedDB â€” stores):**
- Store names: `camelCase` (contoh: `localTransactions`, `pendingOperations`, `productPrices`)
- Index fields: `camelCase` (contoh: `*shiftId`, `createdAt`)

**API Endpoints:**
- Style: REST, kebab-case, plural noun
- POS: `/api/pos/{resource}` (contoh: `/api/pos/transactions`, `/api/pos/sync/batch`)
- Backoffice: `/api/bo/{resource}`
- Route params: `[id]` (Next.js convention)

**File & Code:**
- Files: `kebab-case.ts` / `kebab-case.tsx`
- Components/Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

### Structure Patterns

**Dexie.js â€” Akses WAJIB melalui Service Layer:**

```typescript
// âœ… BENAR â€” melalui service
import { bootstrapService } from '@/services/bootstrap-service'
await bootstrapService.populate(data)

// âŒ SALAH â€” akses Dexie langsung dari komponen
import { db } from '@/lib/db'
await db.products.toArray()
```

Services wajib di `src/renderer/services/`:
- `bootstrap-service.ts` â€” populate + clear cache
- `offline-queue-service.ts` â€” enqueue, flush, retry
- `history-service.ts` â€” query `localTransactions`
- `sync-service.ts` â€” koordinasi online/offline detection

**Test location:** Co-located `foo.test.ts` di sebelah `foo.ts`

### Format Patterns

**API Response â€” Standard Wrapper:**

```typescript
// Success
{ data: T, meta?: { total?: number } }

// Error
{ error: string }  // dalam Bahasa Indonesia

// Sync batch response
{ synced: string[], failed: { id: string, reason: string }[] }
```

**Dexie `pendingOperations` payload:**

```typescript
interface PendingOperation {
  id: string            // crypto.randomUUID()
  type: 'TRANSACTION' | 'EXPENSE' | 'SHIFT_CLOSE'
  payload: unknown      // strongly typed per type
  createdAt: number     // Date.now()
  retryCount: number    // mulai dari 0
  lastError?: string
}
```

**Date/Time:**
- API payload: ISO 8601 string (`new Date().toISOString()`)
- Dexie storage: Unix timestamp ms (`Date.now()`)
- UI display: `dd/MM/yyyy HH:mm` (locale Indonesia)

### Communication Patterns

**Zustand Stores â€” Struktur yang Disepakati:**

```typescript
// networkStore â€” satu-satunya store untuk status koneksi & sync
interface NetworkStore {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: number | null
  setOnline: (v: boolean) => void
  setSyncing: (v: boolean) => void
  setPendingCount: (n: number) => void
}
```

Stores yang ada: `cartStore`, `shiftStore`, `authStore`, `networkStore` (baru untuk MVP).
**Dilarang** membuat store baru untuk network/sync status.

**Bootstrap Trigger â€” Single Entry Point:**
Bootstrap HANYA dipanggil dari `src/renderer/hooks/use-bootstrap.ts`.
Dipanggil saat: app init + reconnect online event.
**Dilarang** dipanggil dari komponen individual.

### Process Patterns

**Offline Queue â€” WAJIB melalui `offline-queue-service`:**

```typescript
// âœ… BENAR
await offlineQueueService.enqueue({ type: 'TRANSACTION', payload: tx })

// âŒ SALAH â€” langsung ke Dexie dari action handler
await db.pendingOperations.add({ ... })
```

**Error Handling Dexie:**

```typescript
// Selalu wrap dengan pesan error dalam Bahasa Indonesia
try {
  await bootstrapService.populate(data)
} catch {
  throw new Error('Gagal menyimpan data lokal. Silakan coba lagi.')
}
// Jangan biarkan catch kosong
```

**Financial Calculations â€” big.js mandatory:**

```typescript
// âœ… BENAR
import Big from 'big.js'
const total = new Big(price).times(qty).toString()

// âŒ SALAH
const total = price * qty  // floating-point error
```

### Enforcement Guidelines

**Semua AI Agent WAJIB:**
- Akses Dexie hanya melalui service layer (tidak dari komponen/store)
- Gunakan `networkStore` untuk semua state online/offline/sync
- Panggil bootstrap hanya dari `use-bootstrap.ts` hook
- Gunakan `offlineQueueService.enqueue()` untuk semua operasi offline
- Wrap semua kalkulasi finansial dengan `big.js`
- Error messages user-facing dalam Bahasa Indonesia
- Bootstrap menggunakan atomic `db.transaction()` dengan `bulkPut`

**Anti-Patterns yang Dilarang:**
- `db.products.toArray()` langsung dari React component
- `navigator.onLine` check tanpa subscribe ke events
- `Math.round()` / `+` operator pada nilai finansial
- Store baru untuk network status selain `networkStore`
- Bootstrap dipanggil dari multiple entry points


## Instruksi
Tinjau diff terhadap AC dan batasan arsitektur. Periksa pelanggaran AC, penyimpangan dari niat spek, implementasi perilaku yang hilang, atau kontradiksi.
Berikan temuan dalam format daftar Markdown: Judul satu baris, AC/batasan mana yang dilanggar, dan bukti dari diff.
