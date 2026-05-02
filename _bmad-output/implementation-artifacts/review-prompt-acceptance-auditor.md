You are an Acceptance Auditor. Review this diff against the spec and context docs. Check for: violations of acceptance criteria, deviations from spec intent, missing implementation of specified behavior, contradictions between spec constraints and actual code. 

Spec:
```markdown
---
epic_id: 4
story_id: 4.3
story_key: 4-3-clone-to-cart
status: review
created_at: 2026-05-02
---

# Story 4.3: Clone to Cart

## Story

As a Kasir,
I want menyalin barang-barang dari transaksi yang baru saja di-void ke keranjang aktif,
So that saya tidak perlu memasukkan ulang semua barang satu per satu hanya untuk memperbaiki kesalahan kecil.

## Acceptance Criteria

1. **Given** sebuah transaksi berstatus `VOID` (baru di-void atau sudah lama)
   **When** Kasir melihat rincian transaksi tersebut di `TransactionDetailDialog`
   **Then** tombol "Clone to Cart" tampil di footer dialog

2. **Given** Kasir menekan tombol "Clone to Cart" pada transaksi VOID
   **When** aksi dieksekusi
   **Then** keranjang aktif dikosongkan terlebih dahulu
   **And** seluruh item dari `transaction.payload.items` dimuat ke keranjang dengan qty, unitPrice, dan discountAmount asli dari transaksi
   **And** navigasi otomatis ke halaman `/pos`
   **And** toast sukses muncul menginformasikan jumlah item yang disalin

3. **Given** transaksi VOID tidak memiliki item (payload.items kosong atau undefined)
   **When** Kasir menekan tombol "Clone to Cart"
   **Then** toast error muncul dengan pesan yang jelas
   **And** tidak ada navigasi yang terjadi

4. **Given** sebuah transaksi berstatus bukan VOID (status COMPLETED / undefined)
   **When** Kasir melihat rincian transaksi tersebut
   **Then** tombol "Clone to Cart" TIDAK tampil (hanya tombol Void dan Cetak Ulang yang tampil sesuai Story 4.1/4.2)
```

Diff:
```diff
warning: in the working copy of 'apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx', LF will be replaced by CRLF the next time Git touches it
diff --git a/apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx b/apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx
index 110abe0..07927a8 100644
--- a/apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx
+++ b/apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx
@@ -1,5 +1,7 @@
 import React, { useState } from "react";
-import { X, Printer, Loader2, Ban } from "lucide-react";
+import { X, Printer, Loader2, Ban, ShoppingCart } from "lucide-react";
+import { useNavigate } from "react-router-dom";
+import { useCartStore } from "@/store/cart-store";
 import { toast } from "sonner";
 import type { LocalTransaction, PaymentMethod } from "@/lib/db";
 import { formatRupiah } from "@/lib/utils";
@@ -24,6 +26,9 @@ export const TransactionDetailDialog: React.FC<
   const [isVoidPinOpen, setIsVoidPinOpen] = useState(false);
   const [isVoidProcessing, setIsVoidProcessing] = useState(false);
 
+  const navigate = useNavigate();
+  const clearCart = useCartStore((state) => state.clearCart);
+
   if (!transaction) return null;
 
   const canVoid = activeShiftId != null && transaction.shiftId === activeShiftId;
@@ -100,6 +105,19 @@ export const TransactionDetailDialog: React.FC<
     }
   };
 
+  const handleCloneToCart = () => {
+    const originalItems: CartItem[] = payload.items ?? [];
+    if (originalItems.length === 0) {
+      toast.error("Tidak ada item yang dapat disalin ke keranjang.");
+      return;
+    }
+    clearCart();
+    useCartStore.setState({ items: originalItems });
+    toast.success(`${originalItems.length} item berhasil disalin ke keranjang`);
+    onClose();
+    navigate("/pos");
+  };
+
   return (
     <>
       {/* Backdrop */}
@@ -258,37 +276,52 @@ export const TransactionDetailDialog: React.FC<
         </div>
 
         {/* Footer */}
-        {transaction.status !== "VOID" && canVoid && (
+        <div className="flex items-center gap-2 p-4 border-t border-white/5 shrink-0">
+          {transaction.status !== "VOID" && canVoid && (
+            <button
+              onClick={() => setIsVoidPinOpen(true)}
+              disabled={isPrinting || isVoidProcessing}
+              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
+            >
+              <Ban className="w-4 h-4" />
+              Void
+            </button>
+          )}
+
+          {transaction.status === "VOID" && (
+            <button
+              onClick={handleCloneToCart}
+              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500/20 border border-brand-500/40 text-brand-400 hover:bg-brand-500/30 transition-all text-sm font-bold"
+            >
+              <ShoppingCart className="w-4 h-4" />
+              Clone to Cart
+            </button>
+          )}
+
+          <div className="flex-1" />
+
           <button
-            onClick={() => setIsVoidPinOpen(true)}
-            disabled={isPrinting || isVoidProcessing}
-            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
+            onClick={handleReprint}
+            disabled={
+              isPrinting || isVoidProcessing || transaction.status === "VOID"
+            }
+            className="py-2.5 px-6 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
           >
-            <Ban className="w-4 h-4" />
-            Void
+            {isPrinting ? (
+              <Loader2 className="w-4 h-4 animate-spin" />
+            ) : (
+              <Printer className="w-4 h-4" />
+            )}
+            {isPrinting ? "Mencetak..." : "Cetak Ulang"}
           </button>
-        )}
-        <button
-          onClick={handleReprint}
-          disabled={
-            isPrinting || isVoidProcessing || transaction.status === "VOID"
-          }
-          className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
-        >
-          {isPrinting ? (
-            <Loader2 className="w-4 h-4 animate-spin" />
-          ) : (
-            <Printer className="w-4 h-4" />
-          )}
-          {isPrinting ? "Mencetak..." : "Cetak Ulang"}
-        </button>
-        <button
-          onClick={onClose}
-          disabled={isPrinting}
-          className="w-32 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
-        >
-          Tutup
-        </button>
+          <button
+            onClick={onClose}
+            disabled={isPrinting}
+            className="w-24 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
+          >
+            Tutup
+          </button>
+        </div>
       </div>
 
       <PinChallengeDialog
```

Output findings as a Markdown list. Each finding: one-line title, which AC/constraint it violates, and evidence from the diff.
