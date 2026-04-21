import React, { useState, useEffect } from 'react';
import { POSLayout } from '@/components/layout/POSLayout';
import { POSuggestionList } from '@/components/po/POSuggestionList';
import { POForm } from '@/components/po/POForm';
import { useAuthStore } from '@/store/auth-store';
import { useShiftStore } from '@/store/shift-store';
import { Calendar, Store, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';

export const PORequestPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const { activeShift, activeCashierId } = useShiftStore();

  // Fetch suppliers on load
  useEffect(() => {
    fetch('/api/pos/bootstrap') // Assuming bootstrap returns suppliers
      .then(res => res.json())
      .then(data => setSuppliers(data.suppliers || []))
      .catch(err => console.error('Failed to fetch suppliers:', err));
  }, []);

  const handleAddToPO = (product: any) => {
    if (items.find(i => i.productId === product.productId)) {
      toast.error("Produk sudah masuk dalam daftar PO.");
      return;
    }

    setItems([...items, {
      productId: product.productId,
      productName: product.productName,
      qtyOrdered: 10, // Default qty
      unitCost: parseFloat(product.lastPurchasePrice || '0'), 
      uomId: product.baseUomId
    }]);
  };

  const handleUpdateItem = (id: number, qty: number, cost: number) => {
    setItems(items.map(i => i.productId === id ? { ...i, qtyOrdered: qty, unitCost: cost } : i));
  };

  const handleRemoveItem = (id: number) => {
    setItems(items.filter(i => i.productId !== id));
  };

  const handleSubmit = async () => {
    if (!selectedSupplierId) {
      toast.error("Anda harus memilih supplier terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/pos/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: activeShift?.branchId || 1, 
          supplierId: selectedSupplierId,
          createdById: activeCashierId || 1, 
          items: items,
          notes: "",
        }),
      });

      if (res.ok) {
        toast.success("Permintaan Purchase Order berhasil dikirim ke Backoffice.");
        setItems([]);
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal mengirim PO.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <POSLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-8 h-full flex flex-col overflow-hidden">
        
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5 shrink-0">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-neutral-500 font-bold uppercase tracking-widest text-xs">
              <Calendar className="w-4 h-4" />
              <span>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <h1 className="text-4xl font-black text-white leading-tight">
              Purchase Order <span className="text-brand-400">Request</span>
            </h1>
            <p className="text-neutral-400 font-medium">Buat pengajuan stok barang baru ke supplier</p>
          </div>

          <div className="bg-brand-500/10 border border-brand-500/20 rounded-2xl px-6 py-4 flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
              <Store className="w-5 h-5 text-brand-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest leading-none mb-1">Lokasi Cabang</span>
              <span className="text-sm font-bold text-white leading-none">{user?.branch || 'Utama'}</span>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex gap-8 min-h-0 overflow-hidden">
          <div className="flex-grow max-w-4xl h-full overflow-hidden flex flex-col">
            <POForm 
              items={items}
              suppliers={suppliers}
              onRemoveItem={handleRemoveItem}
              onUpdateItem={handleUpdateItem}
              onSupplierChange={setSelectedSupplierId}
              onSubmit={handleSubmit}
              loading={loading}
            />
          </div>
          <div className="w-96 shrink-0 h-full overflow-hidden flex flex-col">
            <POSuggestionList 
              branchId={activeShift?.branchId || 1} 
              onAddToPO={handleAddToPO} 
            />
          </div>
        </div>

      </div>
    </POSLayout>
  );
};
