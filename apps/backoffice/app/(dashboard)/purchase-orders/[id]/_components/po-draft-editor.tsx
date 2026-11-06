'use client';

import { useState } from 'react';
import PoProductPicker, { type PoPickChoice, type PoProduct } from '../../_components/po-product-picker';
import { digitsOnly, formatRupiahInput, parseRupiahInput } from '@/lib/number-input';

export interface DraftItem {
  productId: number;
  uomId: number;
  productName: string;
  uomCode: string;
  qty: string;
  unitCost: string;
  qtyUnloaded: number | null;
}

/** Ubah isi Draft PO (keputusan owner 2026-11-06 butir 4): jumlah, harga, tambah/hapus barang. */
export function PoDraftEditor({
  poId,
  branchId,
  initialItems,
  onSaved,
}: {
  poId: number;
  branchId: number;
  initialItems: DraftItem[];
  onSaved: (message: string) => void;
}) {
  const [items, setItems] = useState(initialItems);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (index: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const pick = (product: PoProduct, choice: PoPickChoice) => {
    const uom = product.uoms.find((u) => u.uomId === choice.uomId);
    setItems((prev) => {
      if (prev.some((p) => p.productId === product.id && p.uomId === choice.uomId)) return prev;
      return [...prev, {
        productId: product.id, uomId: choice.uomId, productName: product.name, uomCode: uom?.code ?? '',
        qty: digitsOnly(choice.qty) || '1', unitCost: digitsOnly(choice.unitCost), qtyUnloaded: null,
      }];
    });
  };

  const total = items.reduce((sum, i) => sum + (Number(i.qty) || 0) * parseRupiahInput(i.unitCost), 0);

  const save = async () => {
    setError('');
    if (!items.length) { setError('Draft PO minimal berisi satu barang.'); return; }
    if (items.some((i) => !(Number(i.qty) > 0))) { setError('Jumlah tiap barang harus lebih dari 0.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/bo/purchase-orders/${poId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, uomId: i.uomId, qtyOrdered: Number(i.qty), unitCost: parseRupiahInput(i.unitCost) })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      onSaved('Isi Draft PO disimpan');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden print:hidden">
      <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-foreground">Ubah isi Draft</h2>
          <p className="text-xs text-muted-foreground">Periksa jumlah, isi harga (kosong = harga menyusul dari faktur), lalu simpan sebelum menyetujui.</p>
        </div>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted/50"
        >
          + Tambah barang
        </button>
      </div>

      {picking && (
        <PoProductPicker
          branchId={String(branchId)}
          addedIds={new Set(items.map((i) => i.productId))}
          onPick={pick}
          onClose={() => setPicking(false)}
        />
      )}

      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Produk</th>
            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Bongkaran</th>
            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Qty</th>
            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Harga Beli</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item, index) => (
            <tr key={`${item.productId}:${item.uomId}`}>
              <td className="px-4 py-2">{item.productName} <span className="text-muted-foreground">({item.uomCode})</span></td>
              <td className="px-4 py-2 text-right text-muted-foreground">{item.qtyUnloaded ?? '-'}</td>
              <td className="px-4 py-2 text-right">
                <input
                  inputMode="numeric"
                  value={item.qty}
                  onChange={(e) => update(index, { qty: digitsOnly(e.target.value) })}
                  className="w-20 border border-border rounded-md px-2 py-1 text-right bg-background"
                />
              </td>
              <td className="px-4 py-2 text-right">
                <input
                  inputMode="numeric"
                  value={formatRupiahInput(item.unitCost)}
                  placeholder="menyusul"
                  onChange={(e) => update(index, { unitCost: digitsOnly(e.target.value) })}
                  className="w-32 border border-border rounded-md px-2 py-1 text-right bg-background"
                />
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  className="text-xs text-destructive hover:underline"
                >
                  Hapus
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-6 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">Total: <span className="font-semibold">Rp {total.toLocaleString('id-ID')}</span></p>
        <div className="flex items-center gap-3">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan isi Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}
