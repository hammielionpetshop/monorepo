import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, PackageCheck, ClipboardCheck, Info, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface POItem {
  id: number;
  productId: number;
  productName: string;
  qtyOrdered: string;
  qtyReceived: string;
  unitCost: string;
  product: { name: string };
}

interface ReceivingFormProps {
  po: any;
  onBack: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
}

export const ReceivingForm: React.FC<ReceivingFormProps> = ({ po, onBack, onSubmit, loading }) => {
  const [items, setItems] = useState<any[]>([]);
  const [invoiceReceived, setInvoiceReceived] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (po && po.items) {
      setItems(po.items.map((item: any) => ({
        poItemId: item.id,
        productName: item.product.name,
        qtyOrdered: parseFloat(item.qtyOrdered),
        qtyAlreadyReceived: parseFloat(item.qtyReceived),
        qtyReceived: 0,
        qtyDamaged: 0,
        expiryDate: '',
        note: ''
      })));
    }
  }, [po]);

  const handleUpdate = (id: number, field: string, value: any) => {
    setItems(items.map(i => i.poItemId === id ? { ...i, [field]: value } : i));
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      {/* Header / Active PO Info */}
      <div className="flex items-center justify-between bg-white/5 border border-white/5 p-4 rounded-3xl shrink-0">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon"
            className="w-12 h-12 rounded-2xl hover:bg-white/10 text-neutral-400 hover:text-white transition-all bg-neutral-900 border border-white/10" 
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] leading-none">Purchase Order Detail</span>
              <div className="w-1 h-1 bg-neutral-700 rounded-full" />
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none">#{po.poNumber}</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">{po.supplier.name}</h2>
          </div>
        </div>

        <Button 
          className="h-14 px-8 bg-brand-500 hover:bg-brand-400 text-neutral-950 font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-500/10 transition-all active:scale-[0.98] flex items-center gap-3 disabled:opacity-50" 
          onClick={() => onSubmit({ items, invoiceReceived, note })}
          disabled={loading}
        >
           {loading ? (
             <div className="w-5 h-5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
           ) : (
             <PackageCheck className="w-5 h-5" />
           )}
           <span>{loading ? 'Menyimpan...' : 'Submit Penerimaan'}</span>
        </Button>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col bg-[#111] border-white/5 shadow-2xl relative">
        <div className="p-6 border-b border-white/5 bg-neutral-950/20 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-3 group cursor-pointer lg:pr-8 lg:border-r lg:border-white/5">
              <div className={cn(
                "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                invoiceReceived ? "bg-brand-500 border-brand-500" : "bg-neutral-800 border-white/10 group-hover:border-white/30"
              )} onClick={() => setInvoiceReceived(!invoiceReceived)}>
                {invoiceReceived && <ClipboardCheck className="w-4 h-4 text-neutral-950" />}
              </div>
              <span 
                 className={cn("text-xs font-bold uppercase tracking-wider transition-colors select-none", invoiceReceived ? "text-white" : "text-neutral-500")}
                 onClick={() => setInvoiceReceived(!invoiceReceived)}
              >
                Invoicing Berjalan
              </span>
            </div>
            
            <div className="flex items-center space-x-3 min-w-[300px]">
               <div className="text-neutral-500">
                  <Info className="w-4 h-4" />
               </div>
               <Input 
                 placeholder="Berikan catatan tambahan jika ada selisih..." 
                 className="h-10 bg-neutral-900 border-white/10 text-white text-xs rounded-xl focus:ring-brand-500/20 focus:border-brand-500/50 transition-all"
                 value={note}
                 onChange={(e) => setNote(e.target.value)}
               />
            </div>
          </div>
          
          <div className="hidden xl:flex items-center space-x-4 opacity-30">
             <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Inventory Sync Active</span>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-[#111]">
              <tr className="text-[10px] font-black text-neutral-500 uppercase tracking-widest border-b border-white/5">
                <th className="py-5 px-8 text-left font-black">Spesifikasi Produk</th>
                <th className="py-5 px-4 text-center w-24 font-black">Target PO</th>
                <th className="py-5 px-4 text-center w-24 font-black">Aktual</th>
                <th className="py-5 px-4 text-center w-32 font-black">Penerimaan Baru</th>
                <th className="py-5 px-4 text-center w-32 font-black">Selisih/Rusak</th>
                <th className="py-5 px-8 text-center w-48 font-black">Expired Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map(item => (
                <tr key={item.poItemId} className="group hover:bg-white/5 transition-colors">
                  <td className="py-5 px-8 font-bold text-white text-base">
                    <div className="flex flex-col">
                       {item.productName}
                       <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-tighter mt-1">PO-ITEM: {item.poItemId}</span>
                    </div>
                  </td>
                  <td className="py-5 px-4 text-center">
                    <span className="text-sm font-mono font-bold text-neutral-500">{item.qtyOrdered}</span>
                  </td>
                  <td className="py-5 px-4 text-center">
                    <span className="text-sm font-mono font-bold text-emerald-500/50">{item.qtyAlreadyReceived}</span>
                  </td>
                  <td className="py-5 px-4">
                    <Input 
                      type="number" 
                      className="h-11 bg-neutral-900 border-white/10 text-center font-mono font-bold text-white rounded-xl focus:ring-brand-500/20 focus:border-brand-500/50 transition-all outline-none" 
                      value={item.qtyReceived}
                      onChange={(e) => handleUpdate(item.poItemId, 'qtyReceived', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="py-5 px-4">
                    <Input 
                      type="number" 
                      className={cn(
                        "h-11 bg-neutral-900 border-white/10 text-center font-mono font-bold rounded-xl transition-all outline-none",
                        item.qtyDamaged > 0 ? "text-red-400 border-red-500/30 ring-red-500/10 ring-2" : "text-neutral-500 focus:border-red-500/50"
                      )}
                      value={item.qtyDamaged}
                      onChange={(e) => handleUpdate(item.poItemId, 'qtyDamaged', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="py-5 px-8">
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 pointer-events-none" />
                      <input 
                        type="date" 
                        className="w-full h-11 bg-neutral-900 border border-white/10 rounded-xl pl-10 pr-4 text-xs font-bold text-white hover:border-white/30 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/10 transition-all outline-none appearance-none"
                        value={item.expiryDate}
                        onChange={(e) => handleUpdate(item.poItemId, 'expiryDate', e.target.value)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Background Decorative Glow */}
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-brand-500/5 blur-[100px] rounded-full pointer-events-none" />
      </Card>
      
      {/* Visual System Footer */}
      <div className="flex items-center justify-between px-2 pt-2 opacity-30">
         <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
               <div className="w-2 h-2 bg-brand-500 rounded-full" />
               <span className="text-[10px] font-bold text-white uppercase tracking-widest">Hammielion POS receiving workflow v1.0</span>
            </div>
         </div>
      </div>
    </div>
  );
};
