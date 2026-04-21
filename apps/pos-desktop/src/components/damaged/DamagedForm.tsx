import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, PackageX, AlertTriangle, MessageSquare, ClipboardList, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DamagedItem {
  productId: number;
  productName: string;
  qty: number;
  uomId: number;
  uomCode: string;
}

interface DamagedFormProps {
  items: DamagedItem[];
  onRemoveItem: (id: number) => void;
  onUpdateQty: (id: number, qty: number) => void;
  onSubmit: (reason: string, notes: string) => void;
  loading: boolean;
}

export const DamagedForm: React.FC<DamagedFormProps> = ({ 
  items, 
  onRemoveItem, 
  onUpdateQty, 
  onSubmit, 
  loading 
}) => {
  const [reason, setReason] = useState<string>('RUSAK');
  const [notes, setNotes] = useState<string>('');

  return (
    <Card className="h-full flex flex-col bg-[#111] border-white/5 overflow-hidden shadow-2xl rounded-3xl relative">
      
      {/* Header Panel */}
      <div className="p-6 border-b border-white/5 bg-white/5 shrink-0">
        <div className="flex items-center space-x-3 mb-6">
           <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-400" />
           </div>
           <div>
              <h2 className="text-xl font-black text-white leading-tight uppercase tracking-tight">Detail Laporan</h2>
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Entry Data Write-Off</span>
           </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Alasan Pelaporan</label>
              <Info className="w-3 h-3 text-neutral-700" />
            </div>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="bg-neutral-900 border-white/5 h-12 text-white font-bold rounded-xl focus:ring-brand-500/20 focus:border-brand-500/50 transition-all">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-white/10 text-white font-bold">
                <SelectItem value="RUSAK">Barang Rusak</SelectItem>
                <SelectItem value="EXPIRED">Sudah Kedaluwarsa</SelectItem>
                <SelectItem value="HILANG">Barang Hilang / Selisih</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Catatan Tambahan</label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-neutral-600" />
              <Input 
                placeholder="Contoh: Pecah saat pemindahan" 
                className="bg-neutral-900 border-white/5 h-14 pl-10 text-white text-sm rounded-xl focus:ring-brand-500/20 focus:border-brand-500/50 transition-all placeholder:text-neutral-700"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Item List Panel */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="flex items-center justify-between mb-4 px-1">
           <div className="flex items-center space-x-2 text-neutral-500">
              <ClipboardList className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Daftar Produk ({items.length})</span>
           </div>
        </div>

        {items.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-2xl bg-white/0 space-y-3 opacity-30 mt-4">
             <PackageX className="w-8 h-8" />
             <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-center px-8 leading-relaxed">Pilih produk dari daftar pencarian sebelah kiri</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div 
                key={item.productId} 
                className="group p-4 bg-white/5 border border-white/5 hover:border-white/20 transition-all rounded-2xl flex items-center justify-between"
              >
                <div className="flex-1 min-w-0 pr-4">
                   <h4 className="text-sm font-bold text-white truncate leading-tight uppercase tracking-tight">{item.productName}</h4>
                   <span className="text-[10px] font-bold text-neutral-600 uppercase mt-1 block tracking-tighter">{item.uomCode}</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="flex items-center bg-neutral-900 border border-white/5 rounded-xl h-10 px-1 overflow-hidden shrink-0">
                    <Input 
                      type="number" 
                      className="w-14 bg-transparent border-none text-center font-mono font-black text-white text-base h-full focus:ring-0"
                      value={item.qty}
                      onChange={(e) => onUpdateQty(item.productId, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 rounded-xl bg-white/5 hover:bg-red-500/10 text-neutral-500 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20" 
                    onClick={() => onRemoveItem(item.productId)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Submission Panel */}
      <div className="p-6 border-t border-white/5 bg-neutral-950/30 shrink-0">
        <Button 
          className={cn(
            "w-full h-16 rounded-2xl font-black uppercase tracking-widest text-lg shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3",
            items.length === 0 ? "bg-neutral-800 text-neutral-600 cursor-not-allowed" : "bg-red-600 hover:bg-red-500 text-white shadow-red-600/10"
          )}
          disabled={items.length === 0 || loading}
          onClick={() => onSubmit(reason, notes)}
        >
          {loading ? (
             <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
             <PackageX className="w-6 h-6" />
          )}
          <span>{loading ? 'Processing...' : 'Submit Write-Off'}</span>
        </Button>
        
        <div className="mt-4 text-center">
           <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-[0.2em] leading-normal">
              Penyesuaian stok akan diproses segera setelah approval tervalidasi oleh sistem
           </p>
        </div>
      </div>
      
      {/* Subtle Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-3xl rounded-full pointer-events-none" />
    </Card>
  );
};
