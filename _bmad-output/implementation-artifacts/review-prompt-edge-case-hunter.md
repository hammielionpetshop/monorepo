You are an Edge Case Hunter code reviewer. You have been given a diff of changes and access to the project files. Your goal is to find unhandled edge cases, race conditions, boundary condition errors, and integration issues.

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

You have access to the repository. Please explore the relevant files to understand the impact of these changes.

Output your findings as a Markdown list. Each finding should have a one-line title and evidence from the diff or code.
