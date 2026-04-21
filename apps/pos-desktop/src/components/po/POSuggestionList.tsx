import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Plus, Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Suggestion {
  productId: number;
  productName: string;
  sku: string;
  currentStock: string;
  baseUomId: number;
}

interface POSuggestionListProps {
  branchId: number;
  onAddToPO: (product: any) => void;
}

export const POSuggestionList: React.FC<POSuggestionListProps> = ({ branchId, onAddToPO }) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/pos/purchase-orders/suggestions?branchId=${branchId}`)
      .then(res => res.json())
      .then(data => {
        setSuggestions(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch suggestions:', err);
        setLoading(false);
      });
  }, [branchId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#111] border border-white/5 rounded-3xl">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest text-center">Menganalisis Stok...</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="h-full flex flex-col bg-[#111] border-white/5 overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
            <Sparkles className="w-5 h-5 text-brand-400" />
          </div>
          <h2 className="text-xl font-black text-white">Saran Stok</h2>
        </div>
        <div className="w-8 h-8 rounded-full bg-neutral-900 border border-white/5 flex items-center justify-center text-neutral-500" title="AI Suggestion Engine">
          <Info className="w-4 h-4" />
        </div>
      </div>

      <CardContent className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
        {suggestions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-600 space-y-4 py-20 px-4">
             <AlertCircle className="w-12 h-12 opacity-10" />
             <p className="text-center text-sm font-medium leading-relaxed">
               Stok saat ini masih di atas batas minimum. Belum ada saran restocking.
             </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 pl-1">Produk di bawah limit (10)</p>
            {suggestions.map((item) => (
              <div 
                key={item.productId} 
                className="group relative overflow-hidden p-4 rounded-2xl bg-brand-500/5 border border-brand-500/10 hover:border-brand-500/30 transition-all hover:bg-brand-500/10 active:scale-[0.98]"
              >
                <div className="flex flex-col space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-2">
                      <h4 className="font-bold text-white text-sm leading-tight line-clamp-2">{item.productName}</h4>
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">SKU: {item.sku}</span>
                    </div>
                    <div className="bg-red-500/20 border border-red-500/30 px-2 py-1 rounded-lg">
                      <span className="text-[10px] font-black text-red-400 uppercase leading-none">Stok: {parseFloat(item.currentStock).toFixed(0)}</span>
                    </div>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    className="w-full h-10 gap-2 bg-brand-500/10 hover:bg-brand-500 hover:text-neutral-900 border border-brand-500/20 text-brand-400 font-bold text-xs uppercase tracking-widest transition-all"
                    onClick={() => onAddToPO(item)}
                  >
                    <Plus className="w-4 h-4" />
                    Tambah ke PO
                  </Button>
                </div>
                
                {/* Visual Accent */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-brand-500/5 blur-2xl rounded-full pointer-events-none group-hover:bg-brand-500/10 transition-all" />
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Footer info */}
      <div className="p-4 border-t border-white/5 bg-neutral-950/30 text-center shrink-0">
         <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-[0.2em]">Saran diperbarui setiap transaksi</span>
      </div>
    </Card>
  );
};
