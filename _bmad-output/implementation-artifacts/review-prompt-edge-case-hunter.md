# Edge Case Hunter Review Prompt

You are an Edge Case Hunter. Walk every branching path and boundary condition in the diff below. Report only unhandled edge cases.

## Diff to Review

```patch
--- a/apps/pos-desktop/src/pages/History.tsx
+++ b/apps/pos-desktop/src/pages/History.tsx
@@ -14,6 +14,7 @@ export const HistoryPage: React.FC = () => {
   const [transactions, setTransactions] = useState<LocalTransaction[]>([])
   const [isLoading, setIsLoading] = useState(true)
   const [selectedTransaction, setSelectedTransaction] = useState<LocalTransaction | null>(null)
+  const [searchQuery, setSearchQuery] = useState('')
 
   useEffect(() => {
     historyService.getTodayTransactions()
@@ -38,6 +39,12 @@ export const HistoryPage: React.FC = () => {
     return new Date(timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
   }
 
+  const filteredTransactions = searchQuery.trim()
+    ? transactions.filter((trx) =>
+        (trx.customerName ?? '').toLowerCase().includes(searchQuery.toLowerCase().trim())
+      )
+    : transactions
+
   const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
 
   return (
@@ -52,16 +59,45 @@ export const HistoryPage: React.FC = () => {
           <p className="text-neutral-500 text-sm font-medium">{today}</p>
         </div>
 
+        {/* Search Bar */}
+        <div className="mb-6 relative">
+          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
+          <input
+            type="text"
+            placeholder="Cari nama pelanggan..."
+            value={searchQuery}
+            onChange={(e) => setSearchQuery(e.target.value)}
+            className="w-full pl-9 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-brand-500/50 transition-colors"
+          />
+          {searchQuery && (
+            <button
+              onClick={() => setSearchQuery('')}
+              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
+            >
+              <X className="w-4 h-4" />
+            </button>
+          )}
+        </div>
+
         {/* Content */}
         {isLoading ? (
           <div className="flex items-center justify-center py-20">
             <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
           </div>
-        ) : transactions.length === 0 ? (
+        ) : filteredTransactions.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-center">
             <ClipboardList className="w-12 h-12 text-neutral-700 mb-4" />
-            <p className="text-neutral-500 font-bold">Tidak ada transaksi hari ini</p>
-            <p className="text-neutral-600 text-sm mt-1">Transaksi yang diproses akan muncul di sini</p>
+            {searchQuery ? (
+              <>
+                <p className="text-neutral-500 font-bold">Tidak ada transaksi untuk "{searchQuery}"</p>
+                <p className="text-neutral-600 text-sm mt-1">Coba kata kunci lain atau kosongkan pencarian</p>
+              </>
+            ) : (
+              <>
+                <p className="text-neutral-500 font-bold">Tidak ada transaksi hari ini</p>
+                <p className="text-neutral-600 text-sm mt-1">Transaksi yang diproses akan muncul di sini</p>
+              </>
+            )}
           </div>
         ) : (
           <div className="space-y-2">
@@ -75,7 +111,7 @@ export const HistoryPage: React.FC = () => {
             </div>
 
             {/* Transaction Rows */}
-            {transactions.map((trx) => (
+            {filteredTransactions.map((trx) => (
               <div
                 key={trx.id}
                 className="grid grid-cols-5 gap-4 px-4 py-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
diff --git a/apps/pos-desktop/src/services/history-service.test.ts b/apps/pos-desktop/src/services/history-service.test.ts
index 9ecdb1f..73ade6b 100644
--- a/apps/pos-desktop/src/services/history-service.test.ts
+++ b/apps/pos-desktop/src/services/history-service.test.ts
@@ -18,7 +18,7 @@ describe('HistoryService', () => {
 
   beforeEach(() => {
     vi.clearAllMocks()
-    ;(getDb as any).mockResolvedValue(mockDb)
+    vi.mocked(getDb).mockResolvedValue(mockDb as never)
   })
 
   describe('getTodayTransactions', () => {
@@ -70,7 +70,7 @@ describe('HistoryService', () => {
 
       expect(result).toEqual(mockData)
       
-      const [startMs, endMs] = mockDb.localTransactions.between.mock.calls[0]
+      const [startMs] = mockDb.localTransactions.between.mock.calls[0]
       const start = new Date(startMs)
       expect(start.getFullYear()).toBe(2026)
       expect(start.getMonth()).toBe(3) // April is 3
@@ -78,4 +78,59 @@ describe('HistoryService', () => {
       expect(start.getHours()).toBe(0)
     })
   })
+
+  describe('searchByCustomerName', () => {
+    it('should filter transactions by customer name (partial match, case insensitive)', async () => {
+      const mockData = [
+        { id: 1, customerName: 'Budi Santoso', createdAt: Date.now() },
+        { id: 2, customerName: 'Andi Budiman', createdAt: Date.now() },
+        { id: 3, customerName: 'Charlie', createdAt: Date.now() },
+      ]
+      mockDb.localTransactions.toArray.mockResolvedValue(mockData)
+
+      const result = await historyService.searchByCustomerName('budi')
+
+      expect(result).toHaveLength(2)
+      expect(result[0].customerName).toBe('Budi Santoso')
+      expect(result[1].customerName).toBe('Andi Budiman')
+    })
+
+    it('should return empty array if no matches found', async () => {
+      const mockData = [
+        { id: 1, customerName: 'Budi', createdAt: Date.now() },
+      ]
+      mockDb.localTransactions.toArray.mockResolvedValue(mockData)
+
+      const result = await historyService.searchByCustomerName('zara')
+
+      expect(result).toHaveLength(0)
+    })
+
+    it('should return all transactions if keyword is empty', async () => {
+      const mockData = [
+        { id: 1, customerName: 'Budi', createdAt: Date.now() },
+      ]
+      mockDb.localTransactions.toArray.mockResolvedValue(mockData)
+
+      const result = await historyService.searchByCustomerName('')
+
+      expect(result).toEqual(mockData)
+      // Should fallback to getTransactionsByDate which calls reverse()
+      expect(mockDb.localTransactions.reverse).toHaveBeenCalled()
+    })
+
+    it('should handle null or undefined customer names safely', async () => {
+      const mockData = [
+        { id: 1, customerName: null, createdAt: Date.now() },
+        { id: 2, customerName: undefined, createdAt: Date.now() },
+        { id: 3, customerName: 'Budi', createdAt: Date.now() },
+      ]
+      mockDb.localTransactions.toArray.mockResolvedValue(mockData)
+
+      const result = await historyService.searchByCustomerName('budi')
+
+      expect(result).toHaveLength(1)
+      expect(result[0].customerName).toBe('Budi')
+    })
+  })
 })
diff --git a/apps/pos-desktop/src/services/history-service.ts b/apps/pos-desktop/src/services/history-service.ts
index fe6064a..5356c29 100644
--- a/apps/pos-desktop/src/services/history-service.ts
+++ b/apps/pos-desktop/src/services/history-service.ts
@@ -28,4 +28,24 @@ export const historyService = {
       throw new Error('Gagal memuat riwayat transaksi.', { cause: error })
     }
   },
+
+  async searchByCustomerName(keyword: string, date?: Date): Promise<LocalTransaction[]> {
+    if (!keyword.trim()) {
+      return historyService.getTransactionsByDate(date ?? new Date())
+    }
+    const db = await getDb()
+    const { startMs, endMs } = getDayRange(date ?? new Date())
+    try {
+      const allInRange = await db.localTransactions
+        .where('createdAt')
+        .between(startMs, endMs, true, true)
+        .toArray()
+      const lowerKeyword = keyword.toLowerCase().trim()
+      return allInRange.filter((trx) =>
+        (trx.customerName ?? '').toLowerCase().includes(lowerKeyword)
+      )
+    } catch (error) {
+      throw new Error('Gagal mencari transaksi.', { cause: error })
+    }
+  },
 }
```

## Instructions

Return ONLY a valid JSON array of objects. Each object must contain exactly these four fields and nothing else:

```json
[{
  "location": "file:start-end (or file:line when single line, or file:hunk when exact line unavailable)",
  "trigger_condition": "one-line description (max 15 words)",
  "guard_snippet": "minimal code sketch that closes the gap (single-line escaped string, no raw newlines or unescaped quotes)",
  "potential_consequence": "what could actually go wrong (max 15 words)"
}]
```
