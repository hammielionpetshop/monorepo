import { useEffect } from 'react';
import { usePOSStore } from '@/store/pos-store';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';

export function useBootstrap() {
  const { user } = useAuthStore();
  const { setBootstrapData, setLoading, isInitialized } = usePOSStore();

  useEffect(() => {
    if (isInitialized || !user) return;

    const bootstrap = async () => {
      console.log('[Bootstrap] Starting POS initialization...');
      setLoading(true);
      try {
        // In real app, branchId comes from user profile
        const branchId = 1; 
        const data = await apiClient(`/pos/bootstrap?branchId=${branchId}`);
        console.log('[Bootstrap] Successfully loaded POS data');
        setBootstrapData(data);
      } catch (error: any) {
        console.error('[Bootstrap] Failed to bootstrap POS:', error);
        // Optionally alert the user or show an error state
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [user, isInitialized]);
}
