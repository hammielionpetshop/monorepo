import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Package, Truck, Receipt } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatRupiah } from '@/lib/utils';

interface POItem {
  productId: number;
  productName: string;
  qtyOrdered: number;
  unitCost: number;
  uomId: number;
}

interface POFormProps {
  items: POItem[];
  suppliers: any[];
  onRemoveItem: (id: number) => void;
  onUpdateItem: (id: number, qty: number, cost: number) => void;
  onSupplierChange: (id: number) => void;
  onSubmit: () => void;
  loading: boolean;
}

export const POForm: React.FC<POFormProps> = ({ 
  items, 
  suppliers, 
  onRemoveItem, 
  onUpdateItem, 
  onSupplierChange, 
  onSubmit,
  loading 
}) => {
  const totalEstimation = items.reduce((acc, curr) => acc + (curr.qtyOrdered * curr.unitCost), 0);

  return (
    <Card className="h-full flex flex-col bg-[#111] border-white/5 overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
            <Package className="w-5 h-5 text-orange-400" />
          </div>
          <h2 className="text-xl font-black text-white">Item Purchase Order</h2>
        </div>
        <div className="flex items-center space-x-2 text-neutral-500 bg-neutral-900/50 px-3 py-1.5 rounded-lg border border-white/5">
          <Truck className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Alur Pengadaan</span>
        </div>
      </div>

      <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
        {/* Supplier Selector */}
        <div className="p-6 border-b border-white/5 space-y-3 bg-neutral-900/20 shrink-0">
          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest pl-1">Target Supplier</label>
          <Select onValueChange={(val) => onSupplierChange(parseInt(val))}>
            <SelectTrigger className="h-12 bg-neutral-900 border-white/10 text-white rounded-xl focus:ring-brand-500/20 transition-all">
              <SelectValue placeholder="--- Pilih Supplier ---" />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-white/10 text-white">
              {suppliers.map(s => (
                <SelectItem key={s.id} value={s.id.toString()} className="focus:bg-brand-500 focus:text-white">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="text-[10px] font-black text-neutral-500 uppercase tracking-widest border-b border-white/5">
                <th className="pb-4 text-left font-black">Detail Produk</th>
                <th className="pb-4 text-center w-32 font-black">Kuantitas</th>
                <th className="pb-4 text-right w-44 font-black">Estimasi Harga</th>
                <th className="pb-4 text-right w-16 font-black"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-neutral-600 space-y-4">
                       <Package className="w-16 h-16 opacity-5" />
                       <p className="text-sm font-medium">Belum ada item ditambahkan.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.productId} className="group hover:bg-white/5 transition-colors">
                    <td className="py-5 pr-4 align-top">
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-base leading-tight mb-1">{item.productName}</span>
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">ID: {item.productId}</span>
                      </div>
                    </td>
                    <td className="py-5 px-2 align-top">
                      <div className="flex items-center justify-center">
                        <input 
                          type="number" 
                          className="w-24 h-10 bg-neutral-900 border border-white/10 rounded-xl text-center font-bold text-white focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/10 transition-all outline-none"
                          value={item.qtyOrdered}
                          onChange={(e) => onUpdateItem(item.productId, parseFloat(e.target.value) || 0, item.unitCost)}
                        />
                      </div>
                    </td>
                    <td className="py-5 px-2 align-top text-right">
                      <div className="flex flex-col items-end">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-500 uppercase">Rp</span>
                          <input 
                            type="number" 
                            className="w-40 h-10 bg-neutral-900 border border-white/10 rounded-xl pl-10 pr-4 text-right font-mono font-bold text-white focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/10 transition-all outline-none"
                            value={item.unitCost}
                            onChange={(e) => onUpdateItem(item.productId, item.qtyOrdered, parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-neutral-600 mt-2 uppercase tracking-tighter">Subtotal: {formatRupiah(item.qtyOrdered * item.unitCost)}</span>
                      </div>
                    </td>
                    <td className="py-5 pl-4 align-top text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-10 h-10 rounded-xl hover:bg-red-500/10 hover:text-red-400 group"
                        onClick={() => onRemoveItem(item.productId)}
                      >
                        <Trash2 className="w-4 h-4 text-neutral-600 group-hover:text-red-400 transition-colors" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-8 border-t border-white/5 bg-white/5 shrink-0">
          <div className="flex items-center justify-between mb-8 group">
             <div className="flex items-center space-x-3">
               <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                 <Receipt className="w-6 h-6 text-brand-400" />
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest pl-0.5">Estimasi Total Biaya</span>
                 <span className="text-sm font-bold text-neutral-400">Termasuk pajak & biaya admin estimasi</span>
               </div>
             </div>
             <div className="text-right">
                <span className="text-3xl font-black text-brand-400 font-mono tracking-tighter">
                  {formatRupiah(totalEstimation)}
                </span>
             </div>
          </div>
          
          <Button 
            className="w-full h-16 text-lg font-black uppercase tracking-widest bg-brand-500 hover:bg-brand-400 text-neutral-950 rounded-[20px] shadow-xl shadow-brand-500/10 transition-all active:scale-[0.98] disabled:opacity-30" 
            disabled={items.length === 0 || loading || !selectedSupplierId}
            onClick={onSubmit}
          >
            {loading ? (
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                <span>Mengirim...</span>
              </div>
            ) : (
              'Kirim Permintaan PO'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
