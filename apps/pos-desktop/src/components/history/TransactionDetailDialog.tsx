import React, { useState } from "react";
import { X, Printer, Loader2, Ban } from "lucide-react";
import { toast } from "sonner";
import type { LocalTransaction, PaymentMethod } from "@/lib/db";
import { formatRupiah } from "@/lib/utils";
import type { CartItem, CartTotals } from "@petshop/shared";
import type { TransactionPayment } from "@petshop/shared";
import { printService } from "@/lib/print-service";
import { PinChallengeDialog } from "@/components/pos/PinChallengeDialog";
import { voidService } from "@/services/void-service";

interface TransactionDetailDialogProps {
  transaction: LocalTransaction | null;
  paymentMethods: PaymentMethod[];
  onClose: () => void;
  onVoid?: (updatedTx: LocalTransaction) => void; // NEW
}

export const TransactionDetailDialog: React.FC<
  TransactionDetailDialogProps
> = ({ transaction, paymentMethods, onClose, onVoid }) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isVoidPinOpen, setIsVoidPinOpen] = useState(false);
  const [isVoidProcessing, setIsVoidProcessing] = useState(false);

  if (!transaction) return null;

  const payload = transaction.payload ?? {};
  const items: CartItem[] = payload.items ?? [];
  const totals: CartTotals = payload.totals ?? {};
  const payments: TransactionPayment[] = payload.payments ?? [];
  const amountPaid: number = payload.amountPaid ?? 0;
  const change: number = payload.change ?? 0;

  const taxAmount =
    (totals.grandTotal ?? 0) -
    ((totals.subtotal ?? 0) - (totals.discountTotal ?? 0));
  const showTax = taxAmount > 0.001;

  const formatDateTime = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) return "—";
    return new Date(timestamp).toLocaleString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getMethodName = (paymentMethodId: number) =>
    paymentMethods.find((m: PaymentMethod) => m.id === paymentMethodId)?.name ??
    "—";

  const handleReprint = async () => {
    setIsPrinting(true);
    try {
      const result = await printService.printReceipt({
        trxNumber: transaction.trxNumber,
        items,
        totals,
        payments,
        isReprint: true,
      });
      if (result.success) {
        toast.success("Struk berhasil dicetak ulang");
      } else {
        toast.error(
          `Gagal mencetak struk: ${result.error ?? "Printer tidak merespons"}`,
        );
      }
    } catch (err) {
      toast.error("Gagal mencetak struk: " + (err as Error).message);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleVoidSuccess = async () => {
    if (!transaction) return;
    setIsVoidPinOpen(false);
    setIsVoidProcessing(true);
    try {
      const updated = await voidService.voidTransaction(transaction.id);
      toast.success("Transaksi berhasil dibatalkan");
      onVoid?.(updated);
    } catch (err) {
      console.error("[VoidError]", err);
      const msg = (err as Error).message;
      toast.error(
        msg.includes("Dexie") || msg.includes("Database")
          ? "Gagal memproses ke database. Silakan coba lagi."
          : msg,
      );
    } finally {
      setIsVoidProcessing(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm ${isPrinting ? "cursor-not-allowed" : "cursor-pointer"}`}
        onClick={() => !isPrinting && onClose()}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/5 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black text-white">
                {transaction.trxNumber}
              </h2>
              {transaction.status === "VOID" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-wide">
                  <Ban className="w-3 h-3" />
                  VOID
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-500 mt-0.5">
              {formatDateTime(transaction.createdAt)}
            </p>
            {transaction.customerName && (
              <p className="text-sm text-brand-400 mt-0.5">
                {transaction.customerName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isPrinting}
            className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
          {/* Items Table */}
          <div>
            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">
              Item Pembelian
            </h3>
            <div className="space-y-1">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] font-black text-neutral-600 uppercase tracking-widest">
                <span className="col-span-1">#</span>
                <span className="col-span-4">Produk</span>
                <span className="col-span-2 text-right">Qty</span>
                <span className="col-span-2 text-right">Harga</span>
                <span className="col-span-1 text-right">Disc</span>
                <span className="col-span-2 text-right">Subtotal</span>
              </div>
              {items.map((item: CartItem, idx: number) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-white/5 rounded-lg text-sm"
                >
                  <span className="col-span-1 text-neutral-600">{idx + 1}</span>
                  <span className="col-span-4 text-white font-medium leading-tight">
                    {item.productName}
                  </span>
                  <span className="col-span-2 text-right text-neutral-300">
                    {item.qty}{" "}
                    <span className="text-neutral-600 text-xs">
                      {item.uomCode}
                    </span>
                  </span>
                  <span className="col-span-2 text-right text-neutral-300">
                    {formatRupiah(item.unitPrice)}
                  </span>
                  <span className="col-span-1 text-right text-red-400 text-xs">
                    {item.discountAmount > 0
                      ? `-${formatRupiah(item.discountAmount)}`
                      : "—"}
                  </span>
                  <span className="col-span-2 text-right text-white font-bold">
                    {formatRupiah(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">
              Ringkasan
            </h3>
            <div className="bg-white/5 rounded-xl px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Subtotal</span>
                <span className="text-white">
                  {formatRupiah(totals.subtotal ?? 0)}
                </span>
              </div>
              {(totals.discountTotal ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Diskon</span>
                  <span className="text-red-400">
                    -{formatRupiah(totals.discountTotal)}
                  </span>
                </div>
              )}
              {showTax && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Pajak</span>
                  <span className="text-white">{formatRupiah(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black pt-2 border-t border-white/10">
                <span className="text-white">Grand Total</span>
                <span className="text-emerald-400">
                  {formatRupiah(totals.grandTotal ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div>
            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">
              Pembayaran
            </h3>
            <div className="bg-white/5 rounded-xl px-5 py-4 space-y-2">
              {payments.map((p: TransactionPayment, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-neutral-400">
                    {getMethodName(p.paymentMethodId)}
                  </span>
                  <span className="text-white">{formatRupiah(p.amount)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Total Dibayar</span>
                  <span className="text-white font-bold">
                    {formatRupiah(amountPaid)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Kembalian</span>
                  <span className="text-white font-bold">
                    {formatRupiah(change)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        {transaction.status !== "VOID" && (
          <button
            onClick={() => setIsVoidPinOpen(true)}
            disabled={isPrinting || isVoidProcessing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
          >
            <Ban className="w-4 h-4" />
            Void
          </button>
        )}
        <button
          onClick={handleReprint}
          disabled={
            isPrinting || isVoidProcessing || transaction.status === "VOID"
          }
          className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {isPrinting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Printer className="w-4 h-4" />
          )}
          {isPrinting ? "Mencetak..." : "Cetak Ulang"}
        </button>
        <button
          onClick={onClose}
          disabled={isPrinting}
          className="w-32 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
        >
          Tutup
        </button>
      </div>

      <PinChallengeDialog
        isOpen={isVoidPinOpen}
        onClose={() => setIsVoidPinOpen(false)}
        onSuccess={handleVoidSuccess}
      />
    </>
  );
};
