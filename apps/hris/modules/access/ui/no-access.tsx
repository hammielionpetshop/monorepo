import { EmptyState } from '@/components/ui/surface';

/** Halaman tanpa akses. Penjaganya tetap server; ini hanya tampilan saat ditolak. */
export function NoAccess() {
  return (
    <EmptyState title="Anda tidak punya akses ke halaman ini">
      Hak akses diatur per jabatan. Hubungi Pemilik atau GM bila Anda memerlukannya.
    </EmptyState>
  );
}
