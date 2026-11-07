import Link from 'next/link';
import { NewBadge } from '@/components/ui/new-badge';
import { Badge } from '@/components/ui/surface';
import type { LoadPhotoState } from '../server/load-reports';

/** Foto Laporan Muat sebuah nota (butir C): tautan ke laporannya, atau tanda belum ada foto muat. */
export function LoadPhotoBadge({ load }: { load: LoadPhotoState | null }) {
  if (!load) return null;
  if ('missing' in load) {
    return <span className="inline-flex items-center gap-1"><Badge tone="warn">⚠️ Belum ada foto muat</Badge><NewBadge feature="fitur/foto-muat-surat-jalan" /></span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Link href={`/logistik/laporan-muat/${load.reportId}`} className="text-xs underline">
        📷 Foto muat ({load.photos}){load.done ? '' : ' · masih Proses'}
      </Link>
      <NewBadge feature="fitur/foto-muat-surat-jalan" />
    </span>
  );
}
