'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog';
import { digitsOnly, formatRupiahInput } from '@/lib/number-input';
import { COST_JUMP_THRESHOLD, receivingWarnings, type ReceivingWarning } from './receiving-warnings';

interface POItem {
  id: number;
  productId: number;
  productName: string | null;
  productSku: string | null;
  uomId: number;
  uomCode: string | null;
  qtyOrdered: number;
  qtyReceived: number;
  qtyDamaged: number;
  /** Harga rencana saat PO dibuat (0 = tidak diisi). */
  unitCost: number;
  /** Harga faktur yang sudah tersimpan (penerimaan sebelumnya / Cocokkan Faktur). */
  invoiceUnitCost: number | null;
  /** Modal terakhir satuan ini di cabang PO (Manajemen Harga). */
  lastCost: number | null;
}

interface PO {
  id: number;
  poNumber: string;
  status: string;
  totalAmount: number;
  supplier: { id: number | null; name: string; phone: string | null };
  branch: { id: number; name: string };
  items: POItem[];
}

interface ReceivingItemState {
  poItemId: number;
  qtyReceived: string;
  qtyDamaged: string;
  unitPrice: string;
  expiryDate: string;
}

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

export function ReceivePOClient({ po }: { po: PO }) {
  const router = useRouter();
  // Qty & harga sengaja mulai KOSONG: dulu qty terisi otomatis = qty pesan dan tidak pernah
  // diubah (131 dari 131 item), jadi barang tidak benar-benar dihitung saat datang.
  const [receivingItems, setReceivingItems] = useState<ReceivingItemState[]>(
    po.items.map(item => ({
      poItemId: item.id,
      qtyReceived: '',
      qtyDamaged: '',
      unitPrice: item.invoiceUnitCost && item.invoiceUnitCost > 0 ? String(item.invoiceUnitCost) : '',
      expiryDate: '',
    })),
  );
  const [invoiceReceived, setInvoiceReceived] = useState(false);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pendingWarnings, setPendingWarnings] = useState<ReceivingWarning[]>([]);

  const handleItemChange = (index: number, field: keyof ReceivingItemState, value: string) => {
    setReceivingItems(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const fillPlanPrices = () => {
    setReceivingItems(prev =>
      prev.map((ri, i) => {
        const plan = po.items[i].unitCost;
        return !ri.unitPrice && plan > 0 ? { ...ri, unitPrice: String(plan) } : ri;
      }),
    );
  };

  const remainingOf = (item: POItem) => item.qtyOrdered - item.qtyReceived;
  const num = (v: string) => (v ? parseInt(v, 10) || 0 : 0);
  const planPriceCount = po.items.filter((item, i) => item.unitCost > 0 && !receivingItems[i].unitPrice && remainingOf(item) > 0).length;

  const lines = po.items.map((item, i) => {
    const ri = receivingItems[i];
    return {
      item,
      qty: num(ri.qtyReceived),
      damaged: num(ri.qtyDamaged),
      price: num(ri.unitPrice),
      remaining: remainingOf(item),
    };
  });
  const totalInvoice = lines.reduce((s, l) => s + Math.max(l.qty - l.damaged, 0) * l.price, 0);
  const missingPriceCount = lines.filter(l => l.qty - l.damaged > 0 && l.price <= 0).length;

  const validate = (): boolean => {
    setError('');
    for (const l of lines) {
      if (l.damaged > l.qty) {
        setError(`Qty rusak tidak boleh melebihi qty terima untuk ${l.item.productName}`);
        return false;
      }
      if (l.qty > l.remaining) {
        setError(`Qty terima ${l.item.productName} melebihi sisa pesanan (${l.remaining})`);
        return false;
      }
    }
    if (!lines.some(l => l.qty > 0)) {
      setError('Masukkan qty yang diterima minimal untuk satu item');
      return false;
    }
    return true;
  };

  const handleSubmitClick = () => {
    if (!validate()) return;
    const warnings = receivingWarnings(
      lines.map(l => ({
        name: l.item.productName ?? '-',
        uomCode: l.item.uomCode ?? '',
        remaining: l.remaining,
        qty: l.qty,
        damaged: l.damaged,
        price: l.price,
        referencePrice: l.item.lastCost && l.item.lastCost > 0 ? l.item.lastCost : l.item.unitCost,
      })),
    );
    if (warnings.length > 0) setPendingWarnings(warnings);
    else void submit();
  };

  const acceptWarning = () => {
    const rest = pendingWarnings.slice(1);
    setPendingWarnings(rest);
    if (rest.length === 0) void submit();
  };

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/bo/purchase-orders/${po.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceReceived,
          note: note.trim() || null,
          items: lines.map((l, i) => ({
            poItemId: l.item.id,
            qtyReceived: l.qty,
            qtyDamaged: l.damaged,
            // 0 = harga dikosongkan → PO masuk "Belum Ada Harga" sampai faktur diisi.
            unitPrice: l.price,
            expiryDate: receivingItems[i].expiryDate || null,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal menyimpan penerimaan');
        return;
      }

      router.push(`/purchase-orders/${po.id}`);
      router.refresh();
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const warning = pendingWarnings[0];

  return (
    <div className="space-y-6">
      <Link href={`/purchase-orders/${po.id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Kembali ke detail PO
      </Link>

      <div>
        <h1 className="text-xl font-semibold font-mono">{po.poNumber}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {po.supplier.name} · {po.branch.name}
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-medium text-foreground text-sm">Catat Penerimaan Barang</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hitung barang yang benar-benar datang. Harga beli diisi dari faktur/surat jalan — kosongkan bila faktur belum ada.
            </p>
          </div>
          {planPriceCount > 0 && (
            <button
              type="button"
              onClick={fillPlanPrices}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs border border-border rounded-md text-foreground hover:bg-muted disabled:opacity-50"
            >
              Samakan harga kosong dengan harga rencana ({planPriceCount})
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Barang</th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-14">Sisa</th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-24">Qty Datang</th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-20">Rusak</th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-36">Harga Beli</th>
                <th className="text-left px-2 py-2.5 font-medium text-muted-foreground">Pengingat</th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-32">Exp. Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {po.items.map((item, i) => {
                const remaining = remainingOf(item);
                const ri = receivingItems[i];
                const disabled = remaining <= 0 || isSubmitting;
                return (
                  <tr key={item.id} className={remaining <= 0 ? 'opacity-50' : ''}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-foreground text-xs">
                        {item.productName ?? '-'} <span className="text-muted-foreground">({item.uomCode})</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.productSku ?? '-'} · pesan {item.qtyOrdered}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center text-xs font-medium text-foreground">{remaining}</td>
                    <td className="px-2 py-2.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={ri.qtyReceived ? num(ri.qtyReceived).toLocaleString('id-ID') : ''}
                        onChange={e => handleItemChange(i, 'qtyReceived', digitsOnly(e.target.value))}
                        disabled={disabled}
                        placeholder="0"
                        aria-label={`Qty datang ${item.productName ?? ''}`}
                        className="w-full border border-border rounded px-2 py-1 text-xs text-center bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={ri.qtyDamaged ? num(ri.qtyDamaged).toLocaleString('id-ID') : ''}
                        onChange={e => handleItemChange(i, 'qtyDamaged', digitsOnly(e.target.value))}
                        disabled={disabled}
                        placeholder="0"
                        aria-label={`Qty rusak ${item.productName ?? ''}`}
                        className="w-full border border-border rounded px-2 py-1 text-xs text-center bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatRupiahInput(ri.unitPrice)}
                        onChange={e => handleItemChange(i, 'unitPrice', digitsOnly(e.target.value))}
                        disabled={disabled}
                        placeholder="belum ada"
                        aria-label={`Harga beli ${item.productName ?? ''}`}
                        className="w-full border border-border rounded px-2 py-1 text-xs text-right bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      rencana {item.unitCost > 0 ? rupiah(item.unitCost) : '—'} · terakhir{' '}
                      {item.lastCost && item.lastCost > 0 ? rupiah(item.lastCost) : '—'}
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        type="date"
                        value={ri.expiryDate}
                        onChange={e => handleItemChange(i, 'expiryDate', e.target.value)}
                        disabled={disabled}
                        className="w-full border border-border rounded px-1.5 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Total faktur (barang bagus × harga): <span className="font-semibold text-foreground">{rupiah(totalInvoice)}</span>
          </span>
          {missingPriceCount > 0 && (
            <span className="text-xs text-amber-700">{missingPriceCount} barang belum ada harga → masuk &quot;Belum Ada Harga&quot;</span>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={invoiceReceived}
            onChange={e => setInvoiceReceived(e.target.checked)}
            disabled={isSubmitting}
            className="w-4 h-4 rounded border-border"
          />
          <span className="text-sm text-foreground">Invoice/surat jalan diterima</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Catatan (opsional)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            disabled={isSubmitting}
            rows={2}
            placeholder="Catatan kondisi barang, dll."
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none disabled:opacity-50"
          />
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Link
          href={`/purchase-orders/${po.id}`}
          className="px-4 py-2 text-sm border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Batal
        </Link>
        <button
          onClick={handleSubmitClick}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSubmitting ? 'Menyimpan...' : 'Simpan Penerimaan'}
        </button>
      </div>

      {warning && (
        <RequiredChoiceDialog
          title={warning.title}
          tone="warning"
          actions={[
            { label: warning.backLabel, onClick: () => setPendingWarnings([]) },
            { label: warning.continueLabel, onClick: acceptWarning, variant: 'primary' },
          ]}
        >
          <p>{warning.message}</p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-0.5 max-h-48 overflow-auto">
            {warning.lines.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {warning.kind === 'COST_JUMP' && (
            <p className="text-xs text-muted-foreground">
              Batas peringatan: selisih ≥ {Math.round(COST_JUMP_THRESHOLD * 100)}% dari harga terakhir (atau harga rencana).
            </p>
          )}
        </RequiredChoiceDialog>
      )}
    </div>
  );
}
