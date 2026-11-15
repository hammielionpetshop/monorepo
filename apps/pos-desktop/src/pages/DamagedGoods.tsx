import React, { useState } from 'react';
import { POSLayout } from '@/components/layout/POSLayout';
import { DamagedForm } from '@/components/damaged/DamagedForm';
import { ProductSearch } from '@/components/pos/ProductSearch';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { usePOSStore } from '@/store/pos-store';
import { useShiftStore } from '@/store/shift-store';
import { Calendar, Store, Trash2, Search, PackageX } from 'lucide-react';
import { toast } from 'sonner';

export const DamagedGoodsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { user } = useAuthStore();
  const { uoms } = usePOSStore();
  const { activeShift, activeCashierId } = useShiftStore();

  const handleSearch = async (query: string, categoryId: number | null) => {
    try {
      let url = `/products?q=${query}&limit=12`;
      if (categoryId) url += `&categoryId=${categoryId}`;
      const results = await apiClient(url);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleAddProduct = (product: any) => {
    if (items.find(i => i.productId === product.id)) {
      toast.info(`${product.name} sudah ada di daftar.`);
      return;
    }
    
    const uom = uoms.find(u => u.id === product.baseUomId);
    
    setItems([...items, {
      productId: product.id,
      productName: product.name,
      qty: 1,
      uomId: product.baseUomId,
      uomCode: uom?.code || 'PCS'
    }]);
    
    toast.success(`${product.name} ditambahkan.`);
  };

  const handleUpdateQty = (id: number, qty: number) => {
    setItems(items.map(i => i.productId === id ? { ...i, qty } : i));
  };

  const handleRemoveItem = (id: number) => {
    setItems(items.filter(i => i.productId !== id));
  };

  const handleSubmit = async (reason: string, notes: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/pos/damaged-goods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: activeShift?.branchId || 1, // Context
          shiftId: activeShift?.id,
          reportedById: activeCashierId,
          reason,
          notes,
          items: items.map(i => ({
            productId: i.productId,
            uomId: i.uomId,
            qty: i.qty
          }))
        }),
      });

      if (res.ok) {
        toast.success("Laporan barang rusak berhasil disimpan.");
        setItems([]);
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal menyimpan laporan.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <POSLayout>
      <div className="p-8 max-w-[1600px] mx-auto space-y-8 h-full flex flex-col overflow-hidden">
        
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5 shrink-0">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-neutral-500 font-bold uppercase tracking-widest text-xs">
              <Calendar className="w-4 h-4" />
              <span>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <h1 className="text-4xl font-black text-white leading-tight">
              Barang <span className="text-red-400">Rusak</span> & Write-Off
            </h1>
            <p className="text-neutral-400 font-medium">Laporkan barang rusak, hilang, atau kedaluwarsa untuk penyesuaian stok</p>
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
          
          {/* Left: Search & Selection */}
          <div className="flex-1 flex flex-col space-y-6 overflow-hidden">
            <div className="bg-white/5 border border-white/5 p-2 rounded-2xl shrink-0">
               <ProductSearch onSearch={handleSearch} />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
                {searchResults.length === 0 ? (
                  <div className="col-span-full py-40 flex flex-col items-center justify-center space-y-4 opacity-20">
                    <Search className="w-20 h-20 text-white" />
                    <p className="text-xl font-bold text-white uppercase tracking-widest">Cari Produk Inventaris</p>
                  </div>
                ) : (
                  searchResults.map(p => (
                    <Card 
                      key={p.id} 
                      className="group relative overflow-hidden bg-white/5 border-white/5 hover:border-brand-500/50 hover:bg-white/10 transition-all duration-300 cursor-pointer rounded-2xl active:scale-[0.98]"
                      onClick={() => handleAddProduct(p)}
                    >
                      <CardContent className="p-5 flex flex-col h-full justify-between space-y-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-white text-sm line-clamp-2 leading-tight group-hover:text-brand-400 transition-colors uppercase">{p.name}</h4>
                          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">SKU: {p.sku}</span>
                        </div>
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Pilih Barang</span>
                           <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-neutral-500 group-hover:bg-brand-500 group-hover:text-neutral-950 transition-all">
                              <Search className="w-4 h-4" />
                           </div>
                        </div>
                        
                        {/* Accent line */}
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-brand-500/0 group-hover:bg-brand-500/50 transition-all" />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Form Panel */}
          <div className="w-[500px] shrink-0 h-full overflow-hidden flex flex-col">
            <DamagedForm 
              items={items}
              onRemoveItem={handleRemoveItem}
              onUpdateQty={handleUpdateQty}
              onSubmit={handleSubmit}
              loading={loading}
            />
          </div>

        </div>

      </div>
    </POSLayout>
  );
};
