'use client';

import { useState, useEffect } from 'react';
import PoProductPicker, { type PoPickChoice, type PoProduct } from './po-product-picker';
import { defaultUnitCost, type PoProductUom } from './po-item-defaults';
import { digitsOnly, formatRupiahInput } from '@/lib/number-input';
import { NewBadge } from '@/components/ui/new-badge';

/** Pengingat modal terakhir satuan terpilih (dari Manajemen Harga), di samping kolom harga. */
function lastCostLabel(uoms: PoProductUom[], uomId: number): string {
  const cost = defaultUnitCost(uoms, uomId);
  return cost && cost > 0 ? `Rp ${cost.toLocaleString('id-ID')}` : '—';
}

interface Supplier { id: number; name: string }
interface Branch { id: number; name: string }

interface POItem {
  productId: number;
  productName: string;
  availableUoms: PoProductUom[];
  uomId: number;
  qtyOrdered: string;
  unitCost: string;
}

interface CreatePODialogProps {
  suppliers: Supplier[];
  branches: Branch[];
  currentUserId: number;
  role: string;
  onClose: () => void;
  onSuccess: (poId: number) => void;
  /** Boleh membuat PO Barang kembali (hak po.returned_goods). */
  canReturnedGoods?: boolean;
  /**
   * Isian awal, mis. "Buat PO Tambahan" dari PO Selesai (supplier & cabang sama, catatan rujukan)
   * atau "Duplikat PO" (ikut barang, qty, harga, dan tanda Barang kembali).
   */
  initial?: {
    supplierId?: number | null;
    branchId?: number;
    notes?: string;
    title?: string;
    items?: { productId: number; uomId: number; qtyOrdered: number; unitCost: number }[];
    keepCurrentCost?: boolean;
  };
}

type InitialItem = NonNullable<NonNullable<CreatePODialogProps['initial']>['items']>[number];

/** Muat satuan & modal terakhir cabang untuk barang isian awal (Duplikat PO). */
async function loadInitialItems(branchId: string, initialItems: InitialItem[]): Promise<{ items: POItem[]; skipped: number }> {
  const ids = initialItems.map(i => i.productId).join(',');
  const res = await fetch(`/api/bo/purchase-orders/products?branchId=${branchId}&ids=${ids}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Gagal memuat barang');
  const products = new Map((data as PoProduct[]).map(p => [p.id, p]));
  const items: POItem[] = [];
  for (const it of initialItems) {
    const product = products.get(it.productId);
    if (!product || !product.uoms.some(u => u.uomId === it.uomId)) continue;
    items.push({
      productId: product.id,
      productName: product.name,
      availableUoms: product.uoms,
      uomId: it.uomId,
      qtyOrdered: String(it.qtyOrdered),
      unitCost: it.unitCost > 0 ? String(it.unitCost) : '',
    });
  }
  return { items, skipped: initialItems.length - items.length };
}

export function CreatePODialog({
  suppliers,
  branches,
  currentUserId,
  role,
  onClose,
  onSuccess,
  canReturnedGoods = false,
  initial,
}: CreatePODialogProps) {
  // Supplier yang sudah nonaktif tidak ada di daftar — biarkan kosong supaya dipilih ulang.
  const [supplierId, setSupplierId] = useState(() =>
    initial?.supplierId && suppliers.some(s => s.id === initial.supplierId) ? String(initial.supplierId) : '');
  const [branchId, setBranchId] = useState(() =>
    initial?.branchId && branches.some(b => b.id === initial.branchId) ? String(initial.branchId) : '');
  const [targetDeliveryDate, setTargetDeliveryDate] = useState('');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [items, setItems] = useState<POItem[]>([]);
  const [keepCurrentCost, setKeepCurrentCost] = useState(() => canReturnedGoods && initial?.keepCurrentCost === true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [initialNote, setInitialNote] = useState('');

  // Duplikat PO: barang diisi dari PO asal (satuan & modal terakhir mengikuti cabang terpilih).
  const initialItems = initial?.items;
  useEffect(() => {
    if (!initialItems?.length || !branchId) return;
    let cancelled = false;
    setLoadingInitial(true);
    loadInitialItems(branchId, initialItems)
      .then(({ items: loaded, skipped }) => {
        if (cancelled) return;
        setItems(loaded);
        setInitialNote(skipped > 0 ? `${skipped} barang tidak ikut karena produk/satuannya sudah tidak aktif.` : '');
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoadingInitial(false); });
    return () => { cancelled = true; };
    // Hanya sekali saat dialog dibuka; ganti cabang sesudahnya tidak menimpa isian pengguna.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc saat jendela pilih produk terbuka hanya menutup jendela itu, bukan seluruh form.
      if (e.key === 'Escape' && !isSubmitting && !showPicker) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose, showPicker]);

  const handlePickProduct = (product: PoProduct, choice: PoPickChoice) => {
    if (items.some(it => it.productId === product.id)) return;
    setItems(prev => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        availableUoms: product.uoms,
        uomId: choice.uomId,
        qtyOrdered: choice.qty,
        unitCost: choice.unitCost,
      },
    ]);
  };

  // Ganti satuan = harga satuan ikut berubah artinya, jadi diisi ulang dari modal satuan baru.
  const handleUomChange = (index: number, uomId: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const cost = defaultUnitCost(item.availableUoms, uomId);
      return { ...item, uomId, unitCost: cost ? String(cost) : '' };
    }));
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof POItem, value: string | number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const pendingPriceCount = items.filter(item => !(parseFloat(item.unitCost) > 0)).length;

  const clearAllPrices = () => {
    setItems(prev => prev.map(item => ({ ...item, unitCost: '' })));
  };

  const totalAmount = items.reduce((sum, item) => {
    return sum + (parseFloat(item.qtyOrdered) || 0) * (parseFloat(item.unitCost) || 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!supplierId) return setError('Pilih supplier');
    if (!branchId) return setError('Pilih cabang');
    if (items.length === 0) return setError('Tambahkan minimal satu item');

    for (const item of items) {
      if (!item.qtyOrdered || parseFloat(item.qtyOrdered) <= 0) {
        return setError(`Qty untuk ${item.productName} harus lebih dari 0`);
      }
      if (item.unitCost && !(parseFloat(item.unitCost) >= 0)) {
        return setError(`Harga satuan untuk ${item.productName} tidak valid`);
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/bo/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: parseInt(branchId),
          supplierId: parseInt(supplierId),
          createdById: currentUserId,
          role,
          items: items.map(item => ({
            productId: item.productId,
            uomId: item.uomId,
            qtyOrdered: Math.round(parseFloat(item.qtyOrdered)),
            unitCost: Math.round(parseFloat(item.unitCost) || 0),
          })),
          notes: notes.trim() || null,
          targetDeliveryDate: targetDeliveryDate || null,
          ...(keepCurrentCost && { keepCurrentCost: true }),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal membuat Purchase Order');
        return;
      }

      onSuccess(data.po.id);
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{initial?.title ?? 'Buat Purchase Order'}</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {/* Supplier & Branch */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Supplier <span className="text-destructive">*</span>
                </label>
                <select
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">-- Pilih Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Cabang <span className="text-destructive">*</span>
                </label>
                <select
                  value={branchId}
                  onChange={e => setBranchId(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">-- Pilih Cabang --</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Target Delivery & Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Target Tanggal Terima
                </label>
                <input
                  type="date"
                  value={targetDeliveryDate}
                  onChange={e => setTargetDeliveryDate(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Catatan</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Opsional"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {canReturnedGoods && (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={keepCurrentCost}
                  onChange={e => setKeepCurrentCost(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <span>
                  <span className="font-medium text-foreground">Barang kembali (tidak mengubah modal)</span>{' '}
                  <NewBadge feature="fitur/po-barang-kembali" />
                  <span className="block text-xs text-muted-foreground">
                    Harga di PO = nilai sebenarnya (hutang & PDF). Modal di Manajemen Harga tidak berubah; HPP stok memakai modal cabang.
                  </span>
                </span>
              </label>
            )}

            {/* Items */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Item Produk <span className="text-destructive">*</span>
              </label>

              {/* Product Search — pola Bulk Sale: jendela pilih produk terpisah */}
              <input
                type="text"
                readOnly
                value=""
                onFocus={() => branchId && setShowPicker(true)}
                onClick={() => branchId && setShowPicker(true)}
                disabled={!branchId}
                placeholder={branchId ? 'Klik / Enter untuk cari produk — daftar terbuka di jendela baru...' : 'Pilih cabang dulu untuk menambah produk'}
                className="mb-3 w-full cursor-pointer border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {showPicker && (
                <PoProductPicker
                  branchId={branchId}
                  addedIds={new Set(items.map(it => it.productId))}
                  onPick={handlePickProduct}
                  onClose={() => setShowPicker(false)}
                />
              )}

              {items.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Harga belum tahu (invoice datang belakangan)? Kosongkan harganya — barang tetap bisa diterima,
                    harga beli diisi nanti dari tab <span className="font-medium text-foreground">Harga Belum Diisi</span>.
                  </span>
                  <button
                    type="button"
                    onClick={clearAllPrices}
                    className="rounded border border-border px-2 py-1 font-medium text-foreground hover:bg-muted/50"
                  >
                    Kosongkan semua harga
                  </button>
                </div>
              )}

              {/* Items Table */}
              {items.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Produk</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">UOM</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-24">Qty</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-36">Harga Satuan</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground w-32">Subtotal</th>
                        <th className="px-3 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((item, i) => {
                        const subtotal = (parseFloat(item.qtyOrdered) || 0) * (parseFloat(item.unitCost) || 0);
                        return (
                          <tr key={item.productId}>
                            <td className="px-3 py-2 text-foreground font-medium text-xs">{item.productName}</td>
                            <td className="px-3 py-2">
                              {item.availableUoms.length === 1 ? (
                                <span className="text-xs font-medium text-foreground px-2 py-1 bg-muted rounded">
                                  {item.availableUoms[0].code}
                                </span>
                              ) : (
                                <select
                                  value={item.uomId}
                                  onChange={e => handleUomChange(i, parseInt(e.target.value))}
                                  className="w-full border border-border rounded px-2 py-1 text-xs bg-background text-foreground focus:outline-none"
                                >
                                  {[...item.availableUoms].sort((a, b) => b.ratio - a.ratio).map(u => (
                                    <option key={u.uomId} value={u.uomId}>
                                      {u.code}{u.isBase ? ' (dasar)' : ` (${u.ratio})`}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={item.qtyOrdered}
                                onChange={e => handleItemChange(i, 'qtyOrdered', e.target.value)}
                                className="w-full border border-border rounded px-2 py-1 text-xs bg-background text-foreground focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={formatRupiahInput(item.unitCost)}
                                  onChange={e => handleItemChange(i, 'unitCost', digitsOnly(e.target.value))}
                                  placeholder="menyusul"
                                  className="w-full min-w-24 border border-border rounded px-2 py-1 text-xs bg-background text-foreground focus:outline-none"
                                />
                                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                  terakhir {lastCostLabel(item.availableUoms, item.uomId)}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-foreground text-xs">
                              Rp {subtotal.toLocaleString('id-ID')}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(i)}
                                className="text-destructive hover:opacity-70 transition-opacity text-xs"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {initialNote && <p className="mt-2 text-xs text-amber-700">{initialNote}</p>}

              {items.length === 0 && (
                <div className="border border-dashed border-border rounded-lg py-8 text-center text-sm text-muted-foreground">
                  {loadingInitial ? 'Memuat barang dari PO asal…' : 'Belum ada item. Cari produk di atas untuk menambahkan.'}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between gap-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Total: </span>
              <span className="font-semibold text-foreground text-base">
                Rp {totalAmount.toLocaleString('id-ID')}
              </span>
              {pendingPriceCount > 0 && (
                <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  {pendingPriceCount} item harga menyusul
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {error && (
                <span className="text-xs text-destructive">{error}</span>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : 'Buat Purchase Order'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
