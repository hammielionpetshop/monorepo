# Acceptance Auditor Review Prompt

You are an Acceptance Auditor. Review the diff below against the spec provided. Check for: violations of acceptance criteria, deviations from spec intent, missing implementation of specified behavior, contradictions between spec constraints and actual code.

## Spec: Story 3.1: Search Transaction by Customer Name

### Story
As a Kasir, I want mencari riwayat transaksi menggunakan nama pelanggan, So that saya dapat dengan mudah menemukan struk spesifik untuk pelanggan yang kembali.

### Acceptance Criteria
1. **Given** Kasir berada di halaman History **When** mereka mengetik nama pelanggan di kolom pencarian **Then** daftar akan langsung disaring (filtered) untuk menampilkan transaksi yang cocok dengan nama tersebut **And** hasil pencarian harus muncul dalam waktu kurang dari 200ms
2. **Given** kolom pencarian diisi dengan keyword **When** tidak ada transaksi yang cocok **Then** layar menampilkan pesan "Tidak ada transaksi untuk "[keyword]""
3. **Given** kolom pencarian berisi keyword **When** Kasir menghapus/mengosongkan input **Then** daftar kembali menampilkan seluruh transaksi hari ini tanpa filter
4. **Given** kolom pencarian aktif **When** Kasir klik tombol "X" (clear) **Then** input dikosongkan dan daftar kembali ke full list
5. **Given** transaksi tidak memiliki nama pelanggan (kolom `customerName` kosong/null) **When** Kasir mengetik keyword apapun **Then** transaksi tersebut TIDAK muncul di hasil pencarian (kosong tidak cocok dengan keyword)

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

Output findings as a Markdown list. Each finding: one-line title, which AC/constraint it violates, and evidence from the diff.
