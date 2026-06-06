'use client';

import { useState, useEffect, useRef } from 'react';

interface Supplier { id: number; name: string }
interface Branch { id: number; name: string }

interface ProductUOM {
  id: number;
  code: string;
  name: string;
  isBase: boolean;
}

interface ProductResult {
  id: number;
  name: string;
  sku: string | null;
  baseUomId: number;
  uoms: ProductUOM[];
}

interface POItem {
  productId: number;
  productName: string;
  availableUoms: ProductUOM[];
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
  onSuccess: () => void;
}

export function CreatePODialog({
  suppliers,
  branches,
  currentUserId,
  role,
  onClose,
  onSuccess,
}: CreatePODialogProps) {
  const [supplierId, setSupplierId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [targetDeliveryDate, setTargetDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<POItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchProduct = (q: string) => {
    setSearchQuery(q);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!q.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=10`);
        const data: ProductResult[] = await res.json();
        setSearchResults(data);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectProduct = (product: ProductResult) => {
    // Prevent duplicate products
    if (items.some(it => it.productId === product.id)) {
      setSearchQuery('');
      setShowDropdown(false);
      return;
    }
    setItems(prev => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        availableUoms: product.uoms.length > 0 ? product.uoms : [{ id: product.baseUomId, code: '—', name: '—', isBase: true }],
        uomId: product.baseUomId,
        qtyOrdered: '1',
        unitCost: '',
      },
    ]);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof POItem, value: string | number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
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
      if (!item.unitCost || parseFloat(item.unitCost) <= 0) {
        return setError(`Harga satuan untuk ${item.productName} harus lebih dari 0`);
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
            unitCost: Math.round(parseFloat(item.unitCost)),
          })),
          notes: notes.trim() || null,
          targetDeliveryDate: targetDeliveryDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal membuat Purchase Order');
        return;
      }

      onSuccess();
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
          <h2 className="text-base font-semibold text-foreground">Buat Purchase Order</h2>
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

            {/* Items */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Item Produk <span className="text-destructive">*</span>
              </label>

              {/* Product Search */}
              <div ref={searchRef} className="relative mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchProduct(e.target.value)}
                  placeholder="Cari produk untuk ditambahkan..."
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {isSearching && (
                  <div className="absolute right-3 top-2.5 text-xs text-muted-foreground">Mencari...</div>
                )}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map(p => {
                      const alreadyAdded = items.some(it => it.productId === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProduct(p)}
                          disabled={alreadyAdded}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <span className="font-medium text-foreground">{p.name}</span>
                          {p.sku && <span className="ml-2 text-xs text-muted-foreground">{p.sku}</span>}
                          {alreadyAdded && <span className="ml-2 text-xs text-muted-foreground italic">sudah ditambahkan</span>}
                          {p.uoms.length > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              [{p.uoms.map(u => u.code).join(', ')}]
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {showDropdown && !isSearching && searchResults.length === 0 && searchQuery && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-sm px-3 py-2 text-sm text-muted-foreground">
                    Produk tidak ditemukan
                  </div>
                )}
              </div>

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
                                  onChange={e => handleItemChange(i, 'uomId', parseInt(e.target.value))}
                                  className="w-full border border-border rounded px-2 py-1 text-xs bg-background text-foreground focus:outline-none"
                                >
                                  {item.availableUoms.map(u => (
                                    <option key={u.id} value={u.id}>
                                      {u.code}{u.isBase ? ' (base)' : ''}
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
                              <input
                                type="number"
                                min="0"
                                value={item.unitCost}
                                onChange={e => handleItemChange(i, 'unitCost', e.target.value)}
                                placeholder="0"
                                className="w-full border border-border rounded px-2 py-1 text-xs bg-background text-foreground focus:outline-none"
                              />
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

              {items.length === 0 && (
                <div className="border border-dashed border-border rounded-lg py-8 text-center text-sm text-muted-foreground">
                  Belum ada item. Cari produk di atas untuk menambahkan.
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
