import React, { useEffect, useState } from 'react';
import { X, Clock, Trash2, ArrowRightCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { usePOSStore } from '@/store/pos-store';
import { useCartStore } from '@/store/cart-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export const OpenBillsDrawer: React.FC = () => {
  const { showOpenBillsDrawer, setShowOpenBillsDrawer } = usePOSStore();
  const { clearCart, addItem } = useCartStore();
  const [bills, setBills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteBillId, setDeleteBillId] = useState<number | null>(null);

  const fetchBills = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient('/pos/open-bills?branchId=1');
      setBills(data);
    } catch (err) {
      console.error('Failed to fetch open bills:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (showOpenBillsDrawer) {
      fetchBills();
    }
  }, [showOpenBillsDrawer]);

  const handleResume = async (bill: any) => {
    try {
      const items = JSON.parse(bill.items);
      clearCart();
      items.forEach((item: any) => addItem(item));
      
      // Delete from DB after resume
      await apiClient(`/pos/open-bills/${bill.id}`, { method: 'DELETE' });
      
      setShowOpenBillsDrawer(false);
    } catch (err) {
       console.error('Failed to resume bill:', err);
       toast.error('Gagal mengambil data transaksi');
    }
  };

  const handleDelete = (id: number) => {
    setDeleteBillId(id);
  };

  const confirmDelete = async () => {
    if (deleteBillId === null) return;
    try {
      await apiClient(`/pos/open-bills/${deleteBillId}`, { method: 'DELETE' });
      setBills(bills.filter(b => b.id !== deleteBillId));
      toast.success('Antrean berhasil dihapus');
    } catch (err) {
      console.error('Failed to delete bill:', err);
      toast.error('Gagal menghapus antrean');
    } finally {
      setDeleteBillId(null);
    }
  };

  if (!showOpenBillsDrawer) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setShowOpenBillsDrawer(false)}
      />
      
      <div className="relative w-full max-w-md bg-[#0d0d0d] border-l border-white/5 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#111]">
          <div>
            <h2 className="text-xl font-bold text-white">Daftar Tunggu</h2>
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">Transaksi Ditahan</p>
          </div>
          <button 
            onClick={() => setShowOpenBillsDrawer(false)}
            className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
               <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500"></div>
            </div>
          ) : bills.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-600 space-y-4">
              <Clock className="w-12 h-12 opacity-20" />
              <p className="text-sm font-medium italic">Tidak ada transaksi yang ditahan</p>
            </div>
          ) : (
            bills.map((bill) => (
              <div 
                key={bill.id}
                className="group bg-[#161616] border border-white/5 rounded-2xl p-4 hover:border-brand-500/30 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-brand-400 transition-colors">{bill.holdName}</h3>
                    <div className="flex items-center text-[10px] text-neutral-500 font-bold mt-1 space-x-2">
                       <Clock className="w-3 h-3" />
                       <span>{new Date(bill.createdAt).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => handleDelete(bill.id)}
                      className="p-2 text-neutral-700 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                    {JSON.parse(bill.items).length} Item
                  </div>
                  <button 
                    onClick={() => handleResume(bill)}
                    className="flex items-center space-x-2 px-4 py-2 bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-neutral-950 text-xs font-black rounded-xl transition-all"
                  >
                    <span>Lanjutkan</span>
                    <ArrowRightCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog 
        isOpen={deleteBillId !== null}
        onClose={() => setDeleteBillId(null)}
        onConfirm={confirmDelete}
        title="Hapus Antrean"
        message="Anda yakin ingin menghapus transaksi yang sedang ditahan ini? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Hapus"
        variant="danger"
      />
    </div>
  );
};
