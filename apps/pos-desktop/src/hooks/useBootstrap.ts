import { useEffect } from 'react';
import { usePOSStore } from '@/store/pos-store';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { syncService } from '@/services/sync-service';
import { bootstrapService } from '@/services/bootstrap-service';
import { toast } from 'sonner';

export function useBootstrap() {
  const { user } = useAuthStore();
  const { setBootstrapData, setLoading, isInitialized } = usePOSStore();

  useEffect(() => {
    if (!user || !isInitialized) return;
    syncService.startAutoSync();
    return () => syncService.stopAutoSync();
  }, [user, isInitialized]);

  useEffect(() => {
    if (isInitialized || !user) return;

    const bootstrap = async () => {
      console.log('[Bootstrap] Memulai inisialisasi POS...');
      setLoading(true);
      try {
        // Ambil branchId dari profile user (Fix 4)
        const branchId = (user as any).branchId || 1; 
        const data = await apiClient(`/pos/bootstrap?branchId=${branchId}`);
        
        // Simpan ke Dexie (ADR-001/002)
        await bootstrapService.populate(data);
        
        console.log('[Bootstrap] Master data berhasil diperbarui dari server');
        setBootstrapData(data);
        toast.success('Data master berhasil diperbarui');
      } catch (error: any) {
        console.warn('[Bootstrap] Gagal memuat dari server, mencoba data lokal...', error);
        
        try {
          // Fallback ke data lokal (ADR-002)
          const localData = await bootstrapService.loadFromLocal();
          
          if (localData.products.length > 0) {
            setBootstrapData(localData);
            console.log('[Bootstrap] Berhasil memuat data dari penyimpanan lokal');
            toast.info('Bekerja dalam mode offline dengan data lokal');
          } else {
            throw new Error('Data lokal kosong. Silakan hubungkan internet untuk sinkronisasi pertama.');
          }
        } catch (localError: any) {
          console.error('[Bootstrap] Gagal memuat data lokal:', localError);
          toast.error('Gagal inisialisasi: ' + (localError.message || 'Koneksi bermasalah'));
        }
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [user, isInitialized]);
}
