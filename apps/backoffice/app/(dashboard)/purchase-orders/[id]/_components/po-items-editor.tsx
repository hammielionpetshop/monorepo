'use client';

import { useState } from 'react';
import PoProductPicker, { type PoPickChoice, type PoProduct } from '../../_components/po-product-picker';
import { digitsOnly, formatRupiahInput, parseRupiahInput } from '@/lib/number-input';
import { NewBadge } from '@/components/ui/new-badge';
import { needsReapproval } from '@/lib/services/po-item-edit-rules';

export interface EditableItem {
  productId: number;
  uomId: number;
  productName: string;
  uomCode: string;
  qty: string;
  unitCost: string;
  qtyUnloaded: number | null;
  /** Jumlah yang sudah diinput di Terima Barang — batas bawah qty, baris tidak bisa dihapus. */
  qtyReceived: number;
}

const RECEIVING_STATUSES = ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED'];

/**
 * Ubah isi PO selama penerimaan belum disetujui (spec 2026-11-06-po-edit-items-design):
 * Draft bongkaran selalu terbuka; status lain dibuka lewat tombol "Ubah Isi PO" (OWNER/GM).
 */
export function PoItemsEditor({
  poId,
  branchId,
  status,
  initialItems,
  onSaved,
}: {
  poId: number;
  branchId: number;
  status: string;
  initialItems: EditableItem[];
  onSaved: (message: string) => void;
}) {
  const isDraft = status === 'DRAFT';
  const [open, setOpen] = useState(isDraft);
  const [items, setItems] = useState(initialItems);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const backToApproval = needsReapproval(status);
  const receiving = RECEIVING_STATUSES.includes(status);
  const showUnloaded = items.some((i) => i.qtyUnloaded != null);
  const showReceived = items.some((i) => i.qtyReceived > 0);

  const update = (index: number, patch: Partial<EditableItem>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const pick = (product: PoProduct, choice: PoPickChoice) => {
    const uom = product.uoms.find((u) => u.uomId === choice.uomId);
    setItems((prev) => {
      if (prev.some((p) => p.productId === product.id && p.uomId === choice.uomId)) return prev;
      return [...prev, {
        productId: product.id, uomId: choice.uomId, productName: product.name, uomCode: uom?.code ?? '',
        qty: digitsOnly(choice.qty) || '1', unitCost: digitsOnly(choice.unitCost), qtyUnloaded: null, qtyReceived: 0,
      }];
    });
  };

  const total = items.reduce((sum, i) => sum + (Number(i.qty) || 0) * parseRupiahInput(i.unitCost), 0);

  const save = async () => {
    setError('');
    if (!items.length) { setError('PO minimal berisi satu barang.'); return; }
    if (items.some((i) => !(Number(i.qty) > 0))) { setError('Jumlah tiap barang harus lebih dari 0.'); return; }
    const short = items.find((i) => Number(i.qty) < i.qtyReceived);
    if (short) { setError(`Qty ${short.productName} tidak boleh kurang dari yang sudah diterima (${short.qtyReceived}).`); return; }
    if (backToApproval && !window.confirm('PO ini sudah disetujui. Setelah disimpan, PO kembali ke "Menunggu Persetujuan" dan harus disetujui ulang. Lanjutkan?')) return;
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
      if (!data.changed) onSaved('Tidak ada perubahan isi PO');
      else if (data.backToApproval) onSaved('Isi PO disimpan — PO kembali Menunggu Persetujuan');
      else onSaved(isDraft ? 'Isi Draft PO disimpan' : 'Isi PO disimpan');
      if (!isDraft) setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="print:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-2 border border-primary text-primary text-sm font-medium rounded-md hover:bg-primary/10 transition-colors"
        >
          Ubah Isi PO / Tambah Barang <NewBadge feature="fitur/ubah-isi-po" />
        </button>
      </div>
    );
  }

  const hint = isDraft
    ? 'Periksa jumlah, isi harga (kosong = harga menyusul dari faktur), lalu simpan sebelum menyetujui.'
    : receiving
      ? 'Barang yang lupa dimasukkan atau datang lebih bisa ditambahkan, lalu dicatat lewat "Lanjutkan Penerimaan". Barang yang sudah diterima tidak bisa dihapus dan qty-nya tidak boleh kurang dari yang diterima.'
      : backToApproval
        ? 'Setelah disimpan, PO kembali ke "Menunggu Persetujuan" dan harus disetujui ulang.'
        : 'Tambah barang yang lupa, ubah jumlah atau harga, lalu simpan.';

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden print:hidden">
      <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-foreground">{isDraft ? 'Ubah isi Draft' : 'Ubah Isi PO'}</h2>
          <p className={`text-xs ${backToApproval ? 'text-amber-700' : 'text-muted-foreground'}`}>{hint}</p>
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Produk</th>
              {showUnloaded && <th className="text-right px-4 py-2 font-medium text-muted-foreground">Bongkaran</th>}
              {showReceived && <th className="text-right px-4 py-2 font-medium text-muted-foreground">Diterima</th>}
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Qty</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Harga Beli</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item, index) => (
              <tr key={`${item.productId}:${item.uomId}`}>
                <td className="px-4 py-2">{item.productName} <span className="text-muted-foreground">({item.uomCode})</span></td>
                {showUnloaded && <td className="px-4 py-2 text-right text-muted-foreground">{item.qtyUnloaded ?? '-'}</td>}
                {showReceived && <td className="px-4 py-2 text-right text-muted-foreground">{item.qtyReceived || '-'}</td>}
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
                  {item.qtyReceived > 0 ? (
                    <span className="text-xs text-muted-foreground">sudah diterima</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      className="text-xs text-destructive hover:underline"
                    >
                      Hapus
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">Total: <span className="font-semibold">Rp {total.toLocaleString('id-ID')}</span></p>
        <div className="flex flex-wrap items-center gap-3">
          {error && <p className="text-xs text-destructive">{error}</p>}
          {!isDraft && (
            <button
              type="button"
              onClick={() => { setItems(initialItems); setError(''); setOpen(false); }}
              disabled={saving}
              className="px-4 py-2 border border-border text-sm rounded-md hover:bg-muted/50 disabled:opacity-50"
            >
              Batal
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : isDraft ? 'Simpan isi Draft' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  );
}
