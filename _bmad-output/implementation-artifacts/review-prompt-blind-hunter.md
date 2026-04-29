You are a Blind Hunter code reviewer. Your goal is to find bugs, anti-patterns, performance issues, and security vulnerabilities in the provided diff. 

You have NO context about the project or the requirements. Focus ONLY on the code quality and logic in the diff itself.

### Diff to Review:
```diff
diff --git a/apps/pos-desktop/src/pages/History.tsx b/apps/pos-desktop/src/pages/History.tsx
index 647507c..6911a51 100644
--- a/apps/pos-desktop/src/pages/History.tsx
+++ b/apps/pos-desktop/src/pages/History.tsx
@@ -9,22 +9,46 @@ import { toast } from 'sonner'
 import { TransactionDetailDialog } from '@/components/history/TransactionDetailDialog'
 import { PaymentMethod } from '@petshop/shared'
 
+function formatDateForInput(date: Date): string {
+  const y = date.getFullYear()
+  const m = String(date.getMonth() + 1).padStart(2, '0')
+  const d = String(date.getDate()).padStart(2, '0')
+  return `${y}-${m}-${d}`
+}
+
 export const HistoryPage: React.FC = () => {
   const { paymentMethods } = usePOSStore()
   const [transactions, setTransactions] = useState<LocalTransaction[]>([])
   const [isLoading, setIsLoading] = useState(true)
   const [selectedTransaction, setSelectedTransaction] = useState<LocalTransaction | null>(null)
   const [searchQuery, setSearchQuery] = useState('')
+  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
 
   useEffect(() => {
-    historyService.getTodayTransactions()
-      .then(setTransactions)
+    let isCancelled = false
+    setIsLoading(true)
+    historyService.getTransactionsByDate(selectedDate)
+      .then((data) => {
+        if (!isCancelled) {
+          setTransactions(data)
+        }
+      })
       .catch((err) => {
-        console.error(err)
-        toast.error('Gagal memuat riwayat transaksi')
+        if (!isCancelled) {
+          console.error(err)
+          toast.error('Gagal memuat riwayat transaksi')
+        }
       })
-      .finally(() => setIsLoading(false))
-  }, [])
+      .finally(() => {
+        if (!isCancelled) {
+          setIsLoading(false)
+        }
+      })
+
+    return () => {
+      isCancelled = true
+    }
+  }, [selectedDate])
 
   const getPaymentMethodName = (trx: LocalTransaction): string => {
     const payments = trx.payload?.payments ?? []
@@ -46,7 +70,7 @@ export const HistoryPage: React.FC = () => {
       )
     : transactions
 
-  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
+  const dateLabel = selectedDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
 
   return (
     <POSLayout>
@@ -57,31 +81,46 @@ export const HistoryPage: React.FC = () => {
             <ClipboardList className="w-6 h-6 text-brand-400" />
             <h1 className="text-2xl font-black text-white">Riwayat Transaksi</h1>
           </div>
-          <p className="text-neutral-500 text-sm font-medium">{today}</p>
+          <p className="text-neutral-500 text-sm font-medium">{dateLabel}</p>
         </div>
 
-        {/* Search Bar */}
-        <div className="mb-6 relative">
-          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
-          <input
+        {/* Filter Bar */}
+        <div className="mb-6 flex gap-3 items-center">
+          {/* Search Bar */}
+          <div className="flex-1 relative">
+            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
+            <input
+              type="text"
+              placeholder="Cari nama pelanggan..."
+              value={searchQuery}
+              onChange={(e) => setSearchQuery(e.target.value)}
+              disabled={isLoading}
+              maxLength={100}
+              className="w-full pl-9 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
+            />
+            {searchQuery && (
+              <button
+                onClick={() => setSearchQuery('')}
+                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
+              >
+                <X className="w-4 h-4" />
+              </button>
+            )}
+          </div>
+
+          {/* Date Picker */}
+          <input
+            type="date"
+            value={formatDateForInput(selectedDate)}
+            max={formatDateForInput(new Date())}
+            onChange={(e) => {
+              if (e.target.value) {
+                setSelectedDate(new Date(e.target.value + 'T00:00:00'))
+              }
+            }}
             disabled={isLoading}
-            maxLength={100}
-            className="w-full pl-9 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
+            className="py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:dark]"
           />
-
-          {searchQuery && (
-            <button
-              onClick={() => setSearchQuery('')}
-              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
-            >
-              <X className="w-4 h-4" />
-            </button>
-          )}
         </div>
 
         {/* Content */}
@@ -99,7 +138,7 @@ export const HistoryPage: React.FC = () => {
               </>
             ) : (
               <>
-                <p className="text-neutral-500 font-bold">Tidak ada transaksi hari ini</p>
+                <p className="text-neutral-500 font-bold">Tidak ada transaksi pada tanggal ini</p>
                 <p className="text-neutral-600 text-sm mt-1">Transaksi yang diproses akan muncul di sini</p>
               </>
             )}
diff --git a/apps/pos-desktop/src/services/history-service.test.ts b/apps/pos-desktop/src/services/history-service.test.ts
index d3d817e..491d66d 100644
--- a/apps/pos-desktop/src/services/history-service.test.ts
+++ b/apps/pos-desktop/src/services/history-service.test.ts
@@ -77,6 +77,12 @@ describe('HistoryService', () => {
       expect(start.getDate()).toBe(20)
       expect(start.getHours()).toBe(0)
     })
+
+    it('should return empty array when no transactions on selected date', async () => {
+      mockDb.localTransactions.toArray.mockResolvedValue([])
+      const result = await historyService.getTransactionsByDate(new Date('2026-01-01T00:00:00'))
+      expect(result).toEqual([])
+    })
   })
 
   describe('searchByCustomerName', () => {
```

Please provide your findings as a Markdown list.
Each finding should include:
- A clear, one-line title
- Description of the issue
- Recommended fix
