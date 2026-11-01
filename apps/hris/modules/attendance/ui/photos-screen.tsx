'use client';

import { useRouter } from 'next/navigation';
import { Field, Input, Select } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import { KIND_LABELS, type AttendanceKind } from '../rules/attendance';

type Row = {
  id: number; name: string; kind: AttendanceKind; clock: string; branch: string; latitude: number | null; longitude: number | null;
  accuracyM: number | null; distanceM: number | null; needsReview: boolean; available: boolean;
};

/** KEH-L14. Hanya melihat; stempel ditampilkan dari data absen (spec L3b §9 butir 4). */
export function PhotosScreen({ today, date, earliest, branchId, branches, rows }: {
  today: string; date: string; earliest: string; branchId: number | null; branches: { id: number; name: string }[]; rows: Row[];
}) {
  const router = useRouter();
  const go = (next: { date?: string; branch?: string }) => {
    const params = new URLSearchParams();
    const nextDate = next.date ?? date;
    const nextBranch = next.branch ?? (branchId ? String(branchId) : '');
    if (nextDate !== today) params.set('date', nextDate);
    if (nextBranch) params.set('branch', nextBranch);
    router.push(`/kehadiran/foto-hari-ini${params.size ? `?${params}` : ''}`);
  };
  return (
    <div className="space-y-4">
      <div className="grid max-w-lg gap-3 sm:grid-cols-2">
        <Field id="photo-date" label="Tanggal" hint="Paling jauh sepanjang masa simpan foto.">
          <div className="flex items-center gap-2">
            <Input id="photo-date" type="date" min={earliest} max={today} value={date} onChange={(event) => event.target.value && go({ date: event.target.value })} />
            <NewBadge feature="fitur/foto-absen-pilih-tanggal" />
          </div>
        </Field>
        <Field id="photo-branch" label="Cabang">
          <Select id="photo-branch" value={branchId ?? ''} onChange={(event) => go({ branch: event.target.value })}>
            <option value="">Semua yang boleh dilihat</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </Field>
      </div>
      {!rows.length && <EmptyState title={date === today ? 'Belum ada yang absen di cabang ini hari ini.' : 'Tidak ada foto absen pada tanggal ini.'}>Tanggal {date}.</EmptyState>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((row) => (
          <li key={row.id}>
            <Card className="space-y-2">
              <div className="relative overflow-hidden rounded-lg bg-canvas">
                {row.available
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`/api/attendance/photos/${row.id}`} alt={`Foto absen ${row.name}`} loading="lazy" className="aspect-square w-full object-cover" onContextMenu={(event) => event.preventDefault()} draggable={false} />
                  : <div className="flex aspect-square items-center justify-center p-4 text-center text-sm text-ink-muted">Foto sudah dihapus; jam dan jarak tetap tercatat</div>}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-xs text-white">
                  <p>{row.name} · {KIND_LABELS[row.kind]} {row.clock}</p>
                  <p>{row.branch}</p>
                  {row.latitude != null && <p>{row.latitude.toFixed(6)}, {row.longitude?.toFixed(6)} · {row.distanceM} m</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                {row.needsReview && <Badge tone="warn">Perlu ditinjau</Badge>}
                {row.accuracyM != null && <span>Akurasi GPS ±{row.accuracyM} m</span>}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
