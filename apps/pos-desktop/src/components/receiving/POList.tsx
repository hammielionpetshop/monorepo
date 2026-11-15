import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, ChevronRight, Calendar, User, PackageSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';

interface PO {
  id: number;
  poNumber: string;
  status: string;
  createdAt: string;
  supplier: {
    name: string;
  };
}

interface POListProps {
  branchId: number;
  onSelectPO: (po: PO) => void;
}

export const POList: React.FC<POListProps> = ({ branchId, onSelectPO }) => {
  const [pos, setPos] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient(`/pos/purchase-orders?branchId=${branchId}`)
      .then((data: any[]) => {
        setPos(data.filter((p: any) => p.status === 'APPROVED' || p.status === 'IN_TRANSIT'));
        setLoading(false);
      })
      .catch(err => {
        console.error('Gagal memuat daftar PO:', err);
        setLoading(false);
      });
  }, [branchId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 w-full bg-white/5 border border-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-3xl border border-white/5 border-dashed">
          <PackageSearch className="w-16 h-16 text-neutral-800 mb-4" />
          <p className="text-neutral-500 font-bold uppercase tracking-widest text-sm">Tidak ada pengiriman aktif</p>
          <span className="text-xs text-neutral-600 mt-2">Semua Purchase Order telah diterima atau belum dikirim.</span>
        </div>
      ) : (
        pos.map(po => (
          <Card 
            key={po.id} 
            className="group relative overflow-hidden cursor-pointer bg-white/5 border-white/5 hover:border-brand-500/50 hover:bg-white/10 transition-all duration-300 rounded-2xl active:scale-[0.98]"
            onClick={() => onSelectPO(po)}
          >
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 group-hover:scale-110 transition-transform duration-500">
                  <Truck className="w-7 h-7 text-brand-400" />
                </div>
                <div className="space-y-1.5 font-bold">
                  <div className="flex items-center space-x-3">
                    <h4 className="text-xl text-white tracking-tight leading-none uppercase">#{po.poNumber}</h4>
                    <Badge className={cn(
                      "text-[9px] uppercase font-black px-2 py-0.5 border-none",
                      po.status === 'IN_TRANSIT' ? "bg-emerald-500/20 text-emerald-400" : "bg-brand-500/20 text-brand-400"
                    )}>
                      {po.status === 'IN_TRANSIT' ? 'Transit' : 'Ready'}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-4 text-neutral-500">
                    <div className="flex items-center space-x-1.5">
                       <User className="w-3.5 h-3.5" />
                       <span className="text-xs truncate max-w-[150px]">{po.supplier.name}</span>
                    </div>
                    <div className="h-3 w-px bg-white/10" />
                    <div className="flex items-center space-x-1.5">
                       <Calendar className="w-3.5 h-3.5" />
                       <span className="text-xs">{new Date(po.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-neutral-500 group-hover:bg-brand-500/20 group-hover:text-brand-400 transition-all">
                <ChevronRight className="w-6 h-6" />
              </div>

              {/* Decorative background element */}
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-brand-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
