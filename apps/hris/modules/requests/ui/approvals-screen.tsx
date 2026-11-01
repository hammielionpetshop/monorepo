import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import { cn } from '@/lib/cn';
import type { ApprovalTab, RequestCard } from '../server/queries';
import { RequestCardLink } from './shared';

type Data = {
  tab: ApprovalTab;
  cards: RequestCard[];
  overdueDays: number;
  branches: string[];
  types: { key: string; label: string }[];
  filter: { type: string; branch: string; q: string };
};

const TABS: { key: ApprovalTab; label: string }[] = [
  { key: 'waiting', label: 'Menunggu saya' },
  { key: 'decided', label: 'Sudah saya putuskan' },
  { key: 'all', label: 'Semua' },
];

/** BER-L20 Persetujuan. Tidak ada "Setujui semua" (PRI-40 butir 1); tiap pengajuan diputuskan satu per satu. */
export function ApprovalsScreen({ data }: { data: Data }) {
  const filtered = !!(data.filter.type || data.filter.branch || data.filter.q);
  return (
    <div className="space-y-4">
      <nav aria-label="Tab Persetujuan" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/persetujuan?tab=${tab.key}`}
            aria-current={data.tab === tab.key ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              data.tab === tab.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
            {tab.key === 'waiting' && data.tab === 'waiting' && data.cards.length > 0 && <> <Badge tone="warn">{data.cards.length}</Badge></>}
          </Link>
        ))}
      </nav>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={data.tab} />
        {data.types.length > 1 && (
          <label className="text-sm">
            <span className="mb-1 block text-ink-muted">Jenis</span>
            <Select name="type" defaultValue={data.filter.type}>
              <option value="">Semua jenis</option>
              {data.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
          </label>
        )}
        {data.branches.length > 1 && (
          <label className="text-sm">
            <span className="mb-1 block text-ink-muted">Cabang</span>
            <Select name="branch" defaultValue={data.filter.branch}>
              <option value="">Semua cabang</option>
              {data.branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
          </label>
        )}
        <label className="text-sm">
          <span className="mb-1 block text-ink-muted">Pengaju</span>
          <Input name="q" defaultValue={data.filter.q} placeholder="Cari nama" />
        </label>
        <Button type="submit" size="sm" variant="secondary">Saring</Button>
        {filtered && <Link href={`/persetujuan?tab=${data.tab}`} className="text-sm text-brand-700">Hapus saringan</Link>}
      </form>

      {data.tab === 'waiting' && (
        <p className="text-xs text-ink-muted">
          Terlama di atas. Garis kuning: menunggu lebih dari 1 hari; merah: {data.overdueDays} hari atau lebih.
        </p>
      )}

      {data.cards.length === 0 ? (
        <Card>
          <EmptyState title={data.tab === 'waiting' ? 'Tidak ada yang menunggu keputusan Anda' : 'Belum ada pengajuan'}>
            {filtered ? 'Coba ubah saringan.' : undefined}
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.cards.map((card) => <RequestCardLink key={card.id} card={card} href={`/persetujuan/${card.id}`} mode="approvals" />)}
        </div>
      )}
    </div>
  );
}

type TypeRow = {
  key: string; label: string; module: string; approvers: string[]; reviewers: string[]; viewers: string[];
  deadline: string; attachments: string; confidential: boolean; cancelAfterApproval: boolean; guideLine: string;
};

/** BER-L42 Jenis Pengajuan (hanya-lihat). Penyetuju diubah lewat Hak Akses Jabatan (spec L2f-1 §9 butir 2). */
export function RequestTypesScreen({ rows }: { rows: TypeRow[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Penyetuju tiap jenis = jabatan yang punya hak &quot;Putuskan&quot; jenis itu di{' '}
        <Link href="/pengaturan/hak-akses" className="text-brand-700">Hak Akses Jabatan</Link>. Menambah jenis baru adalah pekerjaan pembangunan.
      </p>
      {rows.map((row) => (
        <Card key={row.key}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-semibold">{row.label}</h2>
            <Badge>{row.module}</Badge>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-muted">Penyetuju</dt><dd>{row.approvers.join(', ') || '—'}</dd></div>
            <div><dt className="text-ink-muted">Pemeriksa</dt><dd>{row.reviewers.join(', ') || 'Tidak ada'}</dd></div>
            <div><dt className="text-ink-muted">Ikut melihat</dt><dd>{row.viewers.join(', ') || 'Tidak ada'}</dd></div>
            <div><dt className="text-ink-muted">Batas waktu</dt><dd>{row.deadline}</dd></div>
            <div><dt className="text-ink-muted">Lampiran</dt><dd>{row.attachments}</dd></div>
            <div><dt className="text-ink-muted">Tertutup</dt><dd>{row.confidential ? 'Ya — hanya pengaju, penyetuju, dan Pemilik/GM' : 'Tidak'}</dd></div>
            <div><dt className="text-ink-muted">Minta dibatalkan setelah disetujui</dt><dd>{row.cancelAfterApproval ? 'Boleh' : 'Tidak'}</dd></div>
            <div><dt className="text-ink-muted">Pedoman lapor</dt><dd>{row.guideLine}</dd></div>
          </dl>
        </Card>
      ))}
    </div>
  );
}
