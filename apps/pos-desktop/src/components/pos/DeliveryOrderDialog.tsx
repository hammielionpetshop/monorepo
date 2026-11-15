import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Printer } from 'lucide-react';
import { useShiftStore } from '@/store/shift-store';
import { toast } from 'sonner';

interface DeliveryOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
}

export const DeliveryOrderDialog: React.FC<DeliveryOrderDialogProps> = ({ 
  isOpen, 
  onClose, 
  transaction 
}) => {
  const [customerName, setCustomerName] = useState(transaction?.customer?.name || '');
  const [address, setAddress] = useState(transaction?.customer?.address || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { activeShift, activeCashierId } = useShiftStore();
  

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pos/delivery-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: transaction.id,
          branchId: activeShift?.branchId || 1, // Context
          printedById: activeCashierId || 1, // Context
          customerName,
          customerAddress: address,
          notes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Surat Jalan Dibuat", { description: `No: ${data.data.doNumber}` });
        // In real app, trigger print here
        onClose();
      } else {
        toast.error("Gagal membuat surat jalan.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Cetak Surat Jalan
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nama Penerima</label>
            <Input 
              value={customerName} 
              onChange={(e) => setCustomerName(e.target.value)} 
              placeholder="Nama customer / penerima"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Alamat Pengiriman</label>
            <Textarea 
              value={address} 
              onChange={(e) => setAddress(e.target.value)} 
              placeholder="Alamat lengkap tujuan"
              className="h-20"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Catatan (opsional)</label>
            <Input 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Contoh: Titip di satpam"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button className="gap-2" onClick={handleCreate} disabled={loading}>
            <Printer className="w-4 h-4" />
            {loading ? 'Memproses...' : 'Simpan & Cetak'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
