You are a Blind Hunter adversarial code reviewer. You receive NO project context and NO spec. Your task is to find bugs, security vulnerabilities, and code quality issues based ONLY on the provided diff.

### DIFF OUTPUT

```diff
diff --git a/apps/backoffice/app/(dashboard)/layout.tsx b/apps/backoffice/app/(dashboard)/layout.tsx
index 32ad0dd..b605190 100644
--- a/apps/backoffice/app/(dashboard)/layout.tsx
+++ b/apps/backoffice/app/(dashboard)/layout.tsx
@@ -45,6 +45,13 @@ export default async function DashboardLayout({
             <span>📈</span>
             Laporan Laba Rugi
           </a>
+          <a
+            href="/reports/stock-valuation"
+            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
+          >
+            <span>📦</span>
+            Laporan Nilai Stok
+          </a>
         </nav>
       </aside>
 
diff --git a/apps/backoffice/lib/services/report-service.ts b/apps/backoffice/lib/services/report-service.ts
index 0cb40a1..00450aa 100644
--- a/apps/backoffice/lib/services/report-service.ts
+++ b/apps/backoffice/lib/services/report-service.ts
@@ -4,8 +4,11 @@ import {
   transactions,
   transactionItems,
   branches,
+  products,
+  productStockBatches,
   eq,
   and,
+  gt,
   sql,
 } from '@/lib/db'
 
@@ -125,3 +128,66 @@ export async function getProfitLossReport(params: {
     totalTransactionCount,
   }
 }
+
+export interface StockValuationItem {
+  productId: number
+  productName: string
+  sku: string | null
+  branchId: number
+  branchName: string
+  totalQty: string
+  totalValue: string
+}
+
+export interface StockValuationData {
+  generatedAt: string
+  items: StockValuationItem[]
+  totalValue: string
+}
+
+export async function getStockValuationReport(): Promise<StockValuationData> {
+  const rows = await db
+    .select({
+      productId: products.id,
+      productName: products.name,
+      sku: products.sku,
+      branchId: branches.id,
+      branchName: branches.name,
+      totalQty: sql<string>`COALESCE(SUM(${productStockBatches.qtyRemaining}), '0')`,
+      totalValue: sql<string>`COALESCE(SUM(${productStockBatches.qtyRemaining} * ${productStockBatches.costPrice}), '0')`,
+    })
+    .from(productStockBatches)
+    .innerJoin(
+      products,
+      and(
+        eq(productStockBatches.productId, products.id),
+        eq(products.isActive, true)
+      )
+    )
+    .innerJoin(branches, eq(productStockBatches.branchId, branches.id))
+    .where(gt(productStockBatches.qtyRemaining, '0'))
+    .groupBy(products.id, products.name, products.sku, branches.id, branches.name)
+    .orderBy(branches.name, products.name)
+
+  let grandTotal = new Big(0)
+
+  const items: StockValuationItem[] = rows.map((row) => {
+    const value = new Big(row.totalValue)
+    grandTotal = grandTotal.plus(value)
+    return {
+      productId: row.productId,
+      productName: row.productName,
+      sku: row.sku,
+      branchId: row.branchId,
+      branchName: row.branchName,
+      totalQty: new Big(row.totalQty).toString(),
+      totalValue: value.toString(),
+    }
+  })
+
+  return {
+    generatedAt: new Date().toISOString(),
+    items,
+    totalValue: grandTotal.toString(),
+  }
+}
diff --git a/apps/backoffice/app/(dashboard)/reports/stock-valuation/page.tsx b/apps/backoffice/app/(dashboard)/reports/stock-valuation/page.tsx
new file mode 100644
index 0000000..31890f1
--- /dev/null
+++ b/apps/backoffice/app/(dashboard)/reports/stock-valuation/page.tsx
@@ -0,0 +1,122 @@
+import Big from 'big.js'
+import { getStockValuationReport, type StockValuationData } from '@/lib/services/report-service'
+
+function formatRupiah(value: string): string {
+  try {
+    return new Intl.NumberFormat('id-ID', {
+      style: 'currency',
+      currency: 'IDR',
+      minimumFractionDigits: 0,
+      maximumFractionDigits: 0,
+    }).format(new Big(value).toNumber())
+  } catch {
+    return 'Rp 0'
+  }
+}
+
+function formatQty(value: string): string {
+  try {
+    return new Big(value).toFixed(2)
+  } catch {
+    return '0.00'
+  }
+}
+
+export default async function StockValuationPage() {
+  let reportData: StockValuationData | null = null
+  let error: string | null = null
+
+  try {
+    reportData = await getStockValuationReport()
+  } catch {
+    error = 'Gagal mengambil data laporan. Silakan coba lagi.'
+  }
+
+  return (
+    <div className="p-6 max-w-7xl mx-auto">
+      <div className="mb-8 flex items-start justify-between">
+        <div>
+          <h1 className="text-2xl font-bold text-foreground">Laporan Nilai Stok FIFO</h1>
+          <p className="text-sm text-muted-foreground mt-1">
+            Nilai inventaris saat ini berdasarkan metode First-In First-Out
+          </p>
+        </div>
+        {reportData && (
+          <a
+            href="/api/bo/reports/stock-valuation/export"
+            className="px-4 py-2 text-sm font-bold text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-all"
+          >
+            Export CSV
+          </a>
+        )}
+      </div>
+
+      {/* Error State */}
+      {error && (
+        <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-medium">
+          {error}
+        </div>
+      )}
+
+      {/* Tabel Laporan */}
+      {reportData && (
+        <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xs">
+          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
+            <h2 className="text-sm font-bold text-card-foreground">
+              {reportData.items.length} produk dengan stok aktif
+            </h2>
+            <p className="text-xs text-muted-foreground">
+              Dibuat pada: {new Date(reportData.generatedAt).toLocaleString('id-ID')}
+            </p>
+          </div>
+
+          {reportData.items.length === 0 ? (
+            <div className="px-6 py-12 text-center text-muted-foreground text-sm">
+              Tidak ada produk dengan stok tersedia saat ini
+            </div>
+          ) : (
+            <div className="overflow-x-auto">
+              <table className="w-full text-sm">
+                <thead>
+                  <tr className="bg-muted/30 text-muted-foreground border-b border-border">
+                    <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Nama Produk</th>
+                    <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">SKU</th>
+                    <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Cabang</th>
+                    <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Stok (Base UOM)</th>
+                    <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Nilai FIFO</th>
+                  </tr>
+                </thead>
+                <tbody className="divide-y divide-border">
+                  {reportData.items.map((item) => (
+                    <tr
+                      key={`${item.productId}-${item.branchId}`}
+                      className="hover:bg-muted/20 transition-colors"
+                    >
+                      <td className="px-6 py-4 font-semibold text-card-foreground">{item.productName}</td>
+                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{item.sku ?? '-'}</td>
+                      <td className="px-6 py-4 text-card-foreground">{item.branchName}</td>
+                      <td className="px-6 py-4 text-right font-medium text-card-foreground">
+                        {formatQty(item.totalQty)}
+                      </td>
+                      <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
+                        {formatRupiah(item.totalValue)}
+                      </td>
+                    </tr>
+                  ))}
+                </tbody>
+                <tfoot>
+                  <tr className="border-t-2 border-border bg-muted/40">
+                    <td className="px-6 py-4 font-bold text-card-foreground" colSpan={4}>TOTAL</td>
+                    <td className="px-6 py-4 text-right font-bold text-primary">
+                      {formatRupiah(reportData.totalValue)}
+                    </td>
+                  </tr>
+                </tfoot>
+              </table>
+            </div>
+          )}
+        </div>
+      )}
+    </div>
+  )
+}
+diff --git a/apps/backoffice/app/api/bo/reports/stock-valuation/export/route.ts b/apps/backoffice/app/api/bo/reports/stock-valuation/export/route.ts
new file mode 100644
index 0000000..566cfe5
--- /dev/null
+++ b/apps/backoffice/app/api/bo/reports/stock-valuation/export/route.ts
@@ -0,0 +1,53 @@
+import { NextResponse } from 'next/server'
+import { cookies } from 'next/headers'
+import { verifyAccessToken } from '@/lib/auth'
+import { getStockValuationReport } from '@/lib/services/report-service'
+
+export const dynamic = 'force-dynamic'
+
+function escapeCsvCell(val: string): string {
+  const sanitized =
+    val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')
+      ? `'${val}`
+      : val
+  return `"${sanitized.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
+}
+
+export async function GET() {
+  try {
+    const cookieStore = await cookies()
+    const token = cookieStore.get('accessToken')?.value
+    const payload = token ? await verifyAccessToken(token) : null
+    if (!payload) {
+      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
+    }
+
+    const data = await getStockValuationReport()
+    const today = new Date().toISOString().split('T')[0]
+
+    const rows = [
+      ['Nama Produk', 'SKU', 'Cabang', 'Stok (Base UOM)', 'Nilai FIFO (IDR)'],
+      ...data.items.map((item) => [
+        item.productName,
+        item.sku ?? '',
+        item.branchName,
+        item.totalQty,
+        item.totalValue,
+      ]),
+      ['TOTAL', '', '', '', data.totalValue],
+    ]
+
+    const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
+    const filename = `laporan-nilai-stok-${today}.csv`
+
+    return new Response(csv, {
+      headers: {
+        'Content-Type': 'text/csv; charset=utf-8',
+        'Content-Disposition': `attachment; filename="${filename}"`,
+      },
+    })
+  } catch (error: unknown) {
+    const message = error instanceof Error ? error.message : 'Gagal mengekspor laporan'
+    return NextResponse.json({ error: message }, { status: 500 })
+  }
+}
+```

Output findings as a Markdown list. Each finding should have a clear title and explanation of the issue.
