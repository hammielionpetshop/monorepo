import Link from 'next/link';
import { DataList, type Column } from '@/components/ui/data-list';
import { Badge } from '@/components/ui/surface';
import { cn } from '@/lib/cn';
import { EMERGENCY_STATUS_LABELS } from '../rules/emergency';
import type { EmergencyRow } from '../server/emergency';
import { whenWib } from './shared';

export type AnnouncementTab = 'showing' | 'done';

/** Kantor › Pengumuman (BER-L22): daftar pengumuman darurat. Perubahan aturan di `rule-office-screen.tsx` (F3-3). */
export function AnnouncementsScreen({ rows, tab }: { rows: EmergencyRow[]; tab: AnnouncementTab }) {
  const shown = rows.filter((row) => (tab === 'showing' ? row.status === 'SHOWING' : row.status !== 'SHOWING'));
  const columns: Column<EmergencyRow>[] = [
    {
      key: 'title', header: 'Judul', primary: true,
      render: (row) => (
        <Link href={`/announcements/${row.id}`} className="font-medium text-brand-700 hover:underline">
          <Badge tone="danger">Darurat</Badge> {row.title}
        </Link>
      ),
    },
    { key: 'target', header: 'Sasaran', render: (row) => row.targetText },
    { key: 'sent', header: 'Dikirim', render: (row) => `${whenWib(row.createdAt)}${row.senderName ? ` · ${row.senderName}` : ''}` },
    { key: 'until', header: 'Tayang sampai', render: (row) => whenWib(row.showsUntil) },
    {
      key: 'status', header: 'Status',
      render: (row) => <Badge tone={row.status === 'SHOWING' ? 'warn' : 'info'}>{EMERGENCY_STATUS_LABELS[row.status]}</Badge>,
    },
    {
      key: 'read', header: 'Sudah baca',
      render: (row) => <Link href={`/announcements/${row.id}`} className="hover:underline">{row.readCount} dari {row.recipientCount}</Link>,
    },
  ];
  const tabs: { id: AnnouncementTab; label: string }[] = [{ id: 'showing', label: 'Tayang' }, { id: 'done', label: 'Selesai' }];
  return (
    <div className="space-y-4">
      <nav className="flex gap-2" aria-label="Tab pengumuman">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={item.id === 'showing' ? '/announcements?view=emergency' : '/announcements?view=emergency&tab=done'}
            className={cn('rounded-full border px-3 py-1.5 text-sm', item.id === tab ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface text-ink')}
          >
            {item.label} ({rows.filter((row) => (item.id === 'showing' ? row.status === 'SHOWING' : row.status !== 'SHOWING')).length})
          </Link>
        ))}
      </nav>
      <DataList rows={shown} columns={columns} rowKey={(row) => row.id} empty={tab === 'showing' ? 'Tidak ada pengumuman darurat yang sedang tayang.' : 'Belum ada pengumuman darurat yang selesai.'} />
    </div>
  );
}
