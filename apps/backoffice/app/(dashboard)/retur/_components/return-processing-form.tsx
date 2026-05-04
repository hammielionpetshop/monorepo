'use client';

import { useState, useMemo } from 'react';
import Big from 'big.js';
import type { TransactionWithReturInfo } from '@/lib/services/retur-service';

export default function ReturnProcessingForm({ 
  transaction, 
  onSuccess 
}: { 
  transaction: TransactionWithReturInfo; 
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [returnQtys, setReturnQtys] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ returnNumber: string } | null>(null);

  // Filter items that have return quantity > 0
  const selectedItems = useMemo(() => {
    return Object.entries(returnQtys)
      .filter(([_, qty]) => {
        try {
          return qty && new Big(qty).gt(0);
        } catch {
          return false;
        }
      })
      .map(([id, qty]) => ({
        transactionItemId: Number(id),
        qty: qty
      }));
  }, [returnQtys]);

  // Calculate total refund estimate
  const totalRefund = useMemo(() => {
    let total = new Big(0);
    for (const item of selectedItems) {
      const trxItem = transaction.items.find(i => i.transactionItemId === item.transactionItemId);
      if (trxItem) {
        try {
          total = total.plus(new Big(item.qty).times(new Big(trxItem.unitPrice)));
        } catch (e) {
          // Ignore invalid numbers during typing
        }
      }
    }
    return total.toString();
  }, [selectedItems, transaction.items]);

  const handleQtyChange = (itemId: number, qty: string, max: string) => {
    try {
      if (qty && new Big(qty).gt(new Big(max))) {
        qty = max;
      }
      setReturnQtys(prev => ({ ...prev, [itemId]: qty }));
    } catch {
      setReturnQtys(prev => ({ ...prev, [itemId]: qty }));
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedItems.length === 0) {
      setError('Pilih minimal satu item untuk diretur');
      return;
    }
    if (!reason.trim()) {
      setError('Alasan retur wajib diisi');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/bo/retur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: transaction.id,
          reason,
          items: selectedItems
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses retur');
      }

      setSuccessData({ returnNumber: data.returnNumber });
      setReason('');
      setReturnQtys({});
      
      // Notify parent to refresh or handle success
      setTimeout(() => {
        onSuccess();
        setSuccessData(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-foreground">Produk</th>
              <th className="px-4 py-3 font-semibold text-foreground text-right">Harga Satuan</th>
              <th className="px-4 py-3 font-semibold text-foreground text-right">Qty Beli</th>
              <th className="px-4 py-3 font-semibold text-foreground text-right">Sisa Bisa Retur</th>
              <th className="px-4 py-3 font-semibold text-foreground text-right w-32">Qty Retur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {transaction.items.map((item) => {
              const isFull = new Big(item.remainingQty).lte(0);
              return (
                <tr key={item.transactionItemId} className={`hover:bg-muted/5 transition-colors ${isFull ? 'opacity-60 bg-muted/20' : ''}`}>
                  <td className="px-4 py-4">
                    <div className="font-medium text-foreground">{item.productName}</div>
                    <div className="text-xs text-muted-foreground">{item.sku || '-'}</div>
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    Rp {Number(item.unitPrice).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    {item.qty}
                  </td>
                  <td className="px-4 py-4 text-right font-medium tabular-nums text-primary">
                    {item.remainingQty}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      disabled={transaction.isFullyReturned || isFull}
                      value={returnQtys[item.transactionItemId] || ''}
                      onChange={(e) => handleQtyChange(item.transactionItemId, e.target.value, item.remainingQty)}
                      placeholder="0"
                      className="w-full bg-background border border-input rounded px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted/50 transition-all"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">Alasan Pengembalian</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={transaction.isFullyReturned}
            placeholder="Contoh: Barang cacat saat diterima, Salah ukuran, dll"
            className="w-full bg-background border border-input rounded-md px-4 py-2 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted/50 transition-all"
            required
          />
        </div>
        
        <div className="bg-primary/5 p-6 rounded-xl border border-primary/10 flex flex-col justify-center items-center text-center">
          <p className="text-sm text-muted-foreground font-medium">Estimasi Total Refund</p>
          <h2 className="text-4xl font-black text-primary mt-2">
            Rp {Number(totalRefund).toLocaleString('id-ID')}
          </h2>
          <div className="mt-6 flex items-start gap-2 text-left bg-background/50 p-3 rounded-lg border border-border/50">
            <span className="text-amber-500">⚠️</span>
            <p className="text-[10px] leading-relaxed text-muted-foreground uppercase font-bold tracking-tight">
              PENGEMBALIAN DANA DILAKUKAN SECARA MANUAL DI LUAR SISTEM INI. PASTIKAN STOK FISIK TELAH DITERIMA KEMBALI.
            </p>
          </div>
        </div>
      </div>

      {successData && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-700 px-4 py-4 rounded-lg text-sm font-bold flex items-center gap-3 animate-in fade-in zoom-in-95">
          <span className="text-xl">✅</span>
          <div>
            <p>Retur Berhasil Diproses!</p>
            <p className="text-xs font-medium opacity-80">Nomor Retur: {successData.returnNumber}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm font-medium animate-in fade-in slide-in-from-top-1">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          type="submit"
          disabled={isSubmitting || transaction.isFullyReturned || selectedItems.length === 0}
          className="bg-primary text-primary-foreground px-10 py-3.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 hover:translate-y-[-2px] disabled:opacity-50 disabled:translate-y-0 transition-all active:scale-95"
        >
          {isSubmitting ? 'Memproses Transaksi...' : 'Konfirmasi Retur Barang'}
        </button>
      </div>
    </form>
  );
}
