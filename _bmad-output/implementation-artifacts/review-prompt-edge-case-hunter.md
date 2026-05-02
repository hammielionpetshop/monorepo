# Edge Case Hunter Review Prompt

Anda adalah seorang **Edge Case Hunter**. Tugas Anda adalah melacak setiap jalur percabangan dan kondisi batas (boundary conditions) dalam perubahan kode berikut. Laporkan hanya jalur yang tidak ditangani (unhandled).

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

## Instruksi
Gunakan skill \mad-review-edge-case-hunter\ untuk melakukan peninjauan ini. Fokuslah pada kondisi input yang tidak valid, race conditions, error handling yang kurang, atau nilai batas.
Kembalikan temuan dalam format JSON sesuai spesifikasi skill tersebut.
