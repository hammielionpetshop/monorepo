import React, { useState } from 'react';
import { POSLayout } from '@/components/layout/POSLayout';
import { POList } from '@/components/receiving/POList';
import { ReceivingForm } from '@/components/receiving/ReceivingForm';
import { useAuthStore } from '@/store/auth-store';
import { useShiftStore } from '@/store/shift-store';
import { Calendar, Store, Truck, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';

export const ReceivingPage: React.FC = () => {
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const { activeShift, activeCashierId } = useShiftStore();

  const handleSelectPO = async (po: any) => {
    // Fetch full detail with items
    try {
      const res = await fetch(`/api/bo/purchase-orders/${po.id}`); // Using BO detail endpoint for simple fetch
      const fullPO = await res.json();
      setSelectedPO(fullPO);
    } catch (err) {
      toast.error("Gagal mengambil detail PO.");
    }
  };

  const handleSubmitReceiving = async (data: any) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/purchase-orders/${selectedPO.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedById: activeCashierId || 1, // Context
          ...data
        }),
      });

      if (res.ok) {
        toast.success("Penerimaan barang berhasil dicatat.");
        setSelectedPO(null); // Back to list
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal mencatat penerimaan.");
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
              Penerimaan <span className="text-brand-400">Barang</span>
            </h1>
            <p className="text-neutral-400 font-medium whitespace-nowrap">Catat barang masuk dari Purchase Order yang telah dikirim supplier</p>
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
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {selectedPO ? (
            <ReceivingForm 
              po={selectedPO} 
              onBack={() => setSelectedPO(null)} 
              onSubmit={handleSubmitReceiving}
              loading={loading}
            />
          ) : (
            <div className="max-w-3xl mx-auto w-full py-8 space-y-8 flex flex-col h-full overflow-hidden">
               <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-neutral-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white uppercase tracking-tight">Pilih Pengiriman Masuk</h2>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  <POList branchId={activeShift?.branchId || 1} onSelectPO={handleSelectPO} />
               </div>
            </div>
          )}
        </div>

      </div>
    </POSLayout>
  );
};
